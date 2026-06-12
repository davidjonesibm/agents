# Migration — Migrating from xUnit.net v2 to v3

Covers package replacements, csproj changes, namespace moves, API changes, and common migration blockers when upgrading from xUnit.net v2 to v3.

## Package Changes

| v2 Package                  | v3 Replacement                    | Notes                              |
| --------------------------- | --------------------------------- | ---------------------------------- |
| `xunit`                     | `xunit.v3`                        | Meta-package; use v3 equivalent    |
| `xunit.abstractions`        | _(Remove)_                        | Merged into core; no longer needed |
| `xunit.core`                | `xunit.v3.core`                   |                                    |
| `xunit.assert`              | `xunit.v3.assert`                 |                                    |
| `xunit.runner.console`      | `xunit.v3.runner.console`         |                                    |
| `xunit.runner.visualstudio` | Keep — upgrade to `3.x.y` version | Must use the **3.x** series        |
| `xunit.analyzers`           | Keep — package name unchanged     |                                    |

```xml
<!-- Before (v2 packages) -->
<PackageReference Include="xunit" Version="2.9.3" />
<PackageReference Include="xunit.abstractions" Version="2.*" />
<PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />

<!-- After (v3 packages) -->
<PackageReference Include="xunit.v3" Version="4.0.0" />
<PackageReference Include="xunit.runner.visualstudio" Version="3.0.0" />
<PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
```

## Required csproj Change — OutputType

The most critical change: test projects must produce an **executable**, not a library.

```xml
<!-- Before (v2 — library) -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>

<!-- After (v3 — executable) -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <OutputType>Exe</OutputType>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>
</Project>
```

- Without `<OutputType>Exe</OutputType>`, the project produces a DLL that cannot self-execute.
- `<IsTestProject>true</IsTestProject>` is required for `dotnet test` discovery.

## Namespace Changes

```csharp
// Before (v2 — ITestOutputHelper in Xunit.Abstractions)
using Xunit.Abstractions;

public class MyTests
{
    private readonly ITestOutputHelper _output;
    public MyTests(ITestOutputHelper output) => _output = output;
}

// After (v3 — ITestOutputHelper in Xunit namespace)
// using Xunit.Abstractions; ← Remove this line
// using Xunit; ← or rely on implicit global using via csproj

public class MyTests(ITestOutputHelper output)
{
    [Fact]
    public void Test() => output.WriteLine("hello");
}
```

Key namespace moves:

| Symbol                     | v2 Namespace         | v3 Namespace          |
| -------------------------- | -------------------- | --------------------- |
| `ITestOutputHelper`        | `Xunit.Abstractions` | `Xunit`               |
| Extensibility runner types | `Xunit.Sdk`          | `Xunit.v3`            |
| Runner/reporter types      | `Xunit.Runner.*`     | `Xunit.Runner.Common` |

## async void Tests — Breaking Change

`async void` tests are **not supported** in v3 and will not be detected by the runner.

```csharp
// Before (v2 — async void compiled but was unreliable)
[Fact]
public async void GetUser_ReturnsData()
{
    var result = await _service.GetAsync();
    Assert.NotNull(result);
}

// After (v3 — must use Task or ValueTask)
[Fact]
public async Task GetUser_ReturnsData()
{
    var result = await _service.GetAsync();
    Assert.NotNull(result);
}
```

Run the following to find all `async void` tests before migrating:

```shell
grep -rn "async void" tests/
```

## IAsyncLifetime — ValueTask Return Type

```csharp
// Before (v2 — Task)
public class MyFixture : IAsyncLifetime
{
    public Task InitializeAsync() => _db.StartAsync();
    public Task DisposeAsync() => _db.StopAsync();
}

// After (v3 — ValueTask)
public class MyFixture : IAsyncLifetime
{
    public ValueTask InitializeAsync() => new(_db.StartAsync());
    public async ValueTask DisposeAsync() => await _db.StopAsync();
}
```

- Both `Task` and `ValueTask` work at runtime, but `ValueTask` is the canonical v3 signature.
- Returning `new ValueTask(someTask)` wraps an existing `Task` cheaply.

## Collection Attribute — Generic Syntax Preferred

```csharp
// Before (v2 — string-based, typo-prone)
[Collection("DatabaseTests")]
public class UserTests { }

[CollectionDefinition("DatabaseTests")]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture> { }

// After (v3 — generic syntax, compile-time safe)
[Collection<DatabaseCollection>]
public class UserTests { }

[CollectionDefinition]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture> { }
```

- String-based `[Collection("Name")]` still works in v3 for backward compatibility.
- Prefer `[Collection<T>]` for new code and migrate string-based usages over time.

## Assert API Changes

| v2                               | v3                                           |
| -------------------------------- | -------------------------------------------- |
| `Assert.Equal(expected, actual)` | Unchanged                                    |
| _(no Assert.Skip)_               | `Assert.Skip(reason)` — new                  |
| _(no Assert.Equivalent)_         | `Assert.Equivalent(expected, actual)` — new  |
| `Assert.NotNull(x)` → void       | `Assert.NotNull(x)` → returns `x` (non-null) |

See `references/assertions.md` for full Assert API coverage.

## Removed Features

- **`ITestCase.UniqueID`** format changed — serialized test case IDs from v2 are not compatible with v3. Stored IDs (e.g., in CI caches or filters) must be regenerated.
- **`xunit.abstractions`** no longer ships as a separate package — remove it.
- **`[CollectionDefinition(Name)]`** string name is no longer required when using `[Collection<T>]`.

## Migration Checklist

- [ ] Replace `xunit` → `xunit.v3` in all test `.csproj` files.
- [ ] Remove `xunit.abstractions` package references.
- [ ] Upgrade `xunit.runner.visualstudio` to 3.x.y.
- [ ] Add `<OutputType>Exe</OutputType>` and `<IsTestProject>true</IsTestProject>` to each test project.
- [ ] Remove `using Xunit.Abstractions;` — replace with `using Xunit;` or rely on implicit using.
- [ ] Change all `async void` tests to return `Task` or `ValueTask`.
- [ ] Update `IAsyncLifetime.InitializeAsync`/`DisposeAsync` signatures to return `ValueTask`.
- [ ] Review classes that implement both `IAsyncDisposable` and `IDisposable` — only `DisposeAsync` will be called.
- [ ] Optionally migrate `[Collection("Name")]` to `[Collection<T>]` for compile-time safety.
- [ ] Add `xunit.runner.json` with `$schema` property for IDE support.
