# Setup — Project Setup, NuGet Packages, and csproj Configuration

Covers installation of xUnit.net v3 packages, required project file settings, and templates.

## Package References

Use the `xunit.v3` meta-package — it pulls in `xunit.v3.core`, `xunit.v3.assert`, and `xunit.analyzers`.

```xml
<!-- Before (v2 packages) -->
<PackageReference Include="xunit" Version="2.*" />
<PackageReference Include="xunit.runner.visualstudio" Version="2.*" />

<!-- After (v3 packages) -->
<PackageReference Include="xunit.v3" Version="4.0.0" />
<PackageReference Include="xunit.runner.visualstudio" Version="3.0.0" />
<PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.*" />
```

- `xunit.v3` is the only test-logic package needed.
- `xunit.runner.visualstudio` 3.x.y is required for Visual Studio / `dotnet test` integration — use the **3.x** version, not 2.x.
- `Microsoft.NET.Test.Sdk` is required when using `dotnet test`.
- Optionally add `xunit.v3.runner.console` for stand-alone console execution outside `dotnet test`.

### Microsoft Testing Platform (MTP)

To use the Microsoft Testing Platform runner instead of VSTest:

```xml
<PackageReference Include="xunit.v3.mtp-v2" Version="4.0.0" />
```

See `references/advanced.md` for MTP-specific behavior.

## Required csproj Settings

Test projects **must** be executables, not libraries. This is the most critical v3 project change.

```xml
<!-- Before (v2 — library output) -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>

<!-- After (v3 — executable output) -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <OutputType>Exe</OutputType>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>
</Project>
```

- `<OutputType>Exe</OutputType>` — **required**. Without this, the project will not run correctly.
- `<IsTestProject>true</IsTestProject>` — required for `dotnet test` discovery.
- `<IsPackable>false</IsPackable>` — prevents accidental NuGet packaging.

### Implicit Using for Xunit Namespace

Add the global using so tests don't need explicit `using Xunit;` statements:

```xml
<ItemGroup>
  <Using Include="Xunit" />
</ItemGroup>
```

This makes `[Fact]`, `[Theory]`, `Assert`, and `ITestOutputHelper` available without explicit imports.

## Full Minimal csproj Example

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <OutputType>Exe</OutputType>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <Using Include="Xunit" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="xunit.v3" Version="4.0.0" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.0.0" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
  </ItemGroup>
</Project>
```

## Templates

Use the official xUnit v3 template for new projects:

```shell
# Install templates (one-time)
dotnet new install xunit.v3.templates

# Create a new test project
dotnet new xunit3 -n MyProject.Tests

# Or with a specific framework target
dotnet new xunit3 -n MyProject.Tests -f net9.0
```

The template produces a correctly configured csproj with `OutputType=Exe` and the right package references.

## Running Tests

v3 projects can be executed three ways:

```shell
# Via dotnet test (standard — requires xunit.runner.visualstudio 3.x and Microsoft.NET.Test.Sdk)
dotnet test

# Via dotnet run (direct execution — no additional runner package needed)
dotnet run

# Via xunit.v3.runner.console (requires xunit.v3.runner.console package)
dotnet xunit
```

- Prefer `dotnet test` for CI pipelines and IDE integration.
- `dotnet run` is useful for debugging and ad-hoc execution without test runner infrastructure.
