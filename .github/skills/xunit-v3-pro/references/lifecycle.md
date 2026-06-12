# Lifecycle — Test Lifecycle, IAsyncLifetime, Fixtures, and Disposal

Covers how xUnit.net v3 manages test instance creation, async setup/teardown, class fixtures, collection fixtures, and assembly fixtures.

## Test Instance Lifecycle

xUnit creates a **new instance** of the test class for every test method. Constructor = setup, `Dispose` = teardown.

```csharp
// Synchronous lifecycle
public class OrderTests : IDisposable
{
    private readonly FakeOrderRepository _repo;

    public OrderTests()           // runs before each test
    {
        _repo = new FakeOrderRepository();
    }

    [Fact]
    public void PlaceOrder_Succeeds() { /* ... */ }

    public void Dispose()         // runs after each test
    {
        _repo.Reset();
    }
}
```

## IAsyncLifetime (Async Setup and Teardown)

`IAsyncLifetime` now returns `ValueTask` (was `Task` in v2). Implement it for async initialization and cleanup.

```csharp
// Before (v2 — Task return type)
public class DatabaseTests : IAsyncLifetime
{
    public Task InitializeAsync() => _db.OpenAsync();
    public Task DisposeAsync() => _db.CloseAsync();
}

// After (v3 — ValueTask return type)
public class DatabaseTests : IAsyncLifetime
{
    private DatabaseConnection _db = null!;

    public async ValueTask InitializeAsync()
    {
        _db = await DatabaseConnection.OpenAsync("Server=localhost;");
    }

    public async ValueTask DisposeAsync()
    {
        await _db.CloseAsync();
    }

    [Fact]
    public async Task Query_ReturnsResults()
    {
        var results = await _db.QueryAsync("SELECT 1");
        Assert.NotEmpty(results);
    }
}
```

- `InitializeAsync` runs after the constructor and before the first test.
- `DisposeAsync` runs after the test and before the next test instance is created.
- Both return `ValueTask` in v3 — using `Task` will compile but is not idiomatic.

## IAsyncDisposable — Disposal Priority

When a class implements **both** `IAsyncDisposable` and `IDisposable`, xUnit v3 calls **only** `DisposeAsync`.

```csharp
// Before (v2 — called both Dispose and DisposeAsync for hybrid implementations)
public class HybridFixture : IAsyncDisposable, IDisposable
{
    public void Dispose() => _sync.Dispose();              // called in v2
    public ValueTask DisposeAsync() => _async.DisposeAsync(); // called in v2
}

// After (v3 — only DisposeAsync is called)
public class HybridFixture : IAsyncDisposable, IDisposable
{
    public void Dispose() => _sync.Dispose();              // NOT called in v3
    public async ValueTask DisposeAsync()
    {
        _sync.Dispose();           // dispose sync resource here too
        await _async.DisposeAsync();
    }
}
```

- Move all cleanup into `DisposeAsync` when implementing both interfaces.
- Keeping `Dispose()` for compatibility is fine, but understand xUnit v3 will not invoke it.

## Class Fixtures — Shared State Within a Class

Use `IClassFixture<T>` to share a single fixture instance across all tests in a class.

```csharp
// Fixture (created once per test class)
public class WebApiFixture : IAsyncLifetime
{
    public HttpClient Client { get; private set; } = null!;
    private WebApplicationFactory<Program> _factory = null!;

    public async ValueTask InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>();
        Client = _factory.CreateClient();
        await Task.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await _factory.DisposeAsync();
    }
}

// Test class consuming the fixture
public class UserApiTests(WebApiFixture fixture) : IClassFixture<WebApiFixture>
{
    [Fact]
    public async Task GetUser_Returns200()
    {
        var response = await fixture.Client.GetAsync("/users/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
```

- The fixture's constructor runs once; `InitializeAsync` runs once before the first test.
- The fixture is disposed after the last test in the class.
- Inject the fixture via constructor parameters (primary constructor syntax supported).

## Collection Fixtures — Shared State Across Multiple Classes

Use `ICollectionFixture<T>` when multiple test classes share the same expensive resource (e.g., a database).

```csharp
// Step 1: Define the collection
[CollectionDefinition]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture> { }

// Step 2: Apply to test classes — generic syntax preferred on .NET 8+
[Collection<DatabaseCollection>]
public class UserRepositoryTests(DatabaseFixture db)
{
    [Fact]
    public async Task Insert_PersistsUser()
    {
        await db.Connection.ExecuteAsync("INSERT INTO users ...");
        var count = await db.Connection.QuerySingleAsync<int>("SELECT COUNT(*) FROM users");
        Assert.Equal(1, count);
    }
}

[Collection<DatabaseCollection>]
public class OrderRepositoryTests(DatabaseFixture db)
{
    [Fact]
    public async Task Insert_PersistsOrder() { /* ... */ }
}
```

- Tests in the **same collection** run sequentially by default.
- The fixture is created once and shared across all classes in the collection.
- Use `[Collection<T>]` (generic, .NET 8+) instead of `[Collection("Name")]` (string) to avoid typo bugs.

## Assembly Fixtures — Process-Wide Shared State

New in v3: use `[assembly: AssemblyFixture(typeof(T))]` for fixtures that span the entire test process.

```csharp
// AssemblyFixture — initialized once for all tests in the assembly
public class GlobalSeeder : IAsyncLifetime
{
    public async ValueTask InitializeAsync()
    {
        await SeedReferenceDataAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await CleanupAsync();
    }
}

// In any file (typically AssemblyInfo.cs or GlobalUsings.cs)
[assembly: AssemblyFixture(typeof(GlobalSeeder))]

// Inject into test classes that need it
public class UserTests(GlobalSeeder seeder)
{
    [Fact]
    public void UserCount_MatchesSeedData() { /* ... */ }
}
```

- Assembly fixtures are created before any tests run and disposed after all tests finish.
- Useful for container startup, seeding reference data, or process-wide configuration.
- For container-based integration tests, combine with Testcontainers assembly fixtures (see `testcontainers-dotnet-pro` skill).

## Execution Order Summary

| Phase                                | Scope          | Who Runs                       |
| ------------------------------------ | -------------- | ------------------------------ |
| Constructor                          | Per test       | Test class                     |
| `InitializeAsync`                    | Per test       | `IAsyncLifetime` on test class |
| `[Fact]` / `[Theory]` body           | Per test       | Test method                    |
| `DisposeAsync` / `Dispose`           | Per test       | Test class                     |
| Class fixture `InitializeAsync`      | Per class      | `IClassFixture<T>`             |
| Class fixture `DisposeAsync`         | Per class      | `IClassFixture<T>`             |
| Collection fixture `InitializeAsync` | Per collection | `ICollectionFixture<T>`        |
| Collection fixture `DisposeAsync`    | Per collection | `ICollectionFixture<T>`        |
| Assembly fixture `InitializeAsync`   | Per process    | `[assembly: AssemblyFixture]`  |
| Assembly fixture `DisposeAsync`      | Per process    | `[assembly: AssemblyFixture]`  |
