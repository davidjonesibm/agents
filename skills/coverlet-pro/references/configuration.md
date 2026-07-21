# Coverlet Configuration

Driver selection, package installation, required SDK versions, runsettings setup, and .NET 10 compatibility.

## Driver Selection

Coverlet ships four integration drivers. Pick **exactly one** per test project:

| Driver               | Package                          | When to use                                                                                                                      |
| -------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `coverlet.MTP`       | `coverlet.MTP`                   | Test project uses **Microsoft Testing Platform** (MTP) — e.g., xUnit v3, TUnit, or any project with `Microsoft.Testing.Platform` |
| `coverlet.collector` | `coverlet.collector`             | Test project uses **VSTest** runner (`dotnet test`, VS Test Explorer) — the default for xUnit v2, NUnit, MSTest                  |
| `coverlet.msbuild`   | `coverlet.msbuild`               | MSBuild-driven coverage without VSTest data collector; useful for .NET Framework and standalone scenarios                        |
| `coverlet.console`   | `coverlet.console` (global tool) | Standalone integration/e2e tests not using a standard test runner; wraps any executable                                          |

**Critical:** `coverlet.collector` and `coverlet.msbuild` are **incompatible with MTP**. If your project targets .NET 10+ with MTP enabled by default, use `coverlet.MTP` or disable MTP (see .NET 10 section below).

---

## coverlet.MTP (Microsoft Testing Platform)

### Installation

```xml
<!-- test project .csproj -->
<ItemGroup>
  <PackageReference Include="coverlet.MTP" Version="10.0.1" />
</ItemGroup>
```

### Usage

```sh
# Run with MTP via dotnet test (MTP-enabled project)
dotnet test --coverlet

# Or run the test project directly
dotnet run --project ./MyTests -- --coverlet

# With options
dotnet test --coverlet --coverlet-output-format cobertura --coverlet-exclude "[xunit.]*"
```

### MTP Options (command-line flags)

| Flag                               | Description                                                          |
| ---------------------------------- | -------------------------------------------------------------------- |
| `--coverlet`                       | Enable code coverage                                                 |
| `--coverlet-output-format`         | `json`, `lcov`, `opencover`, `cobertura` (default: `json,cobertura`) |
| `--coverlet-include`               | Include filter `[Assembly]Type`                                      |
| `--coverlet-exclude`               | Exclude filter `[Assembly]Type`                                      |
| `--coverlet-include-test-assembly` | Include test assembly in results                                     |

### Requirements

- .NET 8.0 SDK or newer
- `Microsoft.Testing.Platform` configured in the test project

---

## coverlet.collector (VSTest)

### Installation

```xml
<!-- test project .csproj -->
<ItemGroup>
  <!-- Minimum 17.12.0; prefer 18.x -->
  <PackageReference Include="Microsoft.NET.Test.Sdk" Version="18.5.1" />
  <!-- Already present in dotnet new xunit — just update the version -->
  <PackageReference Include="coverlet.collector" Version="10.0.1" />
</ItemGroup>
```

### Usage

```sh
# Default: produces coverage.cobertura.xml in TestResults/<guid>/
dotnet test --collect:"XPlat Code Coverage"

# Inline format override (no runsettings file needed)
dotnet test --collect:"XPlat Code Coverage;Format=json"

# Multiple formats inline
dotnet test --collect:"XPlat Code Coverage;Format=json,lcov,cobertura"

# With runsettings file
dotnet test --collect:"XPlat Code Coverage" --settings coverlet.runsettings

# With stable output directory
dotnet test --collect:"XPlat Code Coverage" --results-directory ./artifacts/coverage
```

### runsettings File

```xml
<?xml version="1.0" encoding="utf-8" ?>
<RunSettings>
  <DataCollectionRunSettings>
    <DataCollectors>
      <DataCollector friendlyName="XPlat code coverage">
        <Configuration>
          <Format>json,cobertura,lcov,opencover</Format>
          <Exclude>[coverlet.*.tests?]*,[*]Coverlet.Core*</Exclude>
          <Include>[MyApp.*]*</Include>
          <ExcludeByAttribute>Obsolete,GeneratedCodeAttribute,CompilerGeneratedAttribute</ExcludeByAttribute>
          <ExcludeByFile>**/Migrations/*.cs,**/obj/**</ExcludeByFile>
          <IncludeTestAssembly>false</IncludeTestAssembly>
          <SingleHit>false</SingleHit>
          <UseSourceLink>false</UseSourceLink>
          <SkipAutoProps>false</SkipAutoProps>
          <DeterministicReport>false</DeterministicReport>
          <ExcludeAssembliesWithoutSources>MissingAll</ExcludeAssembliesWithoutSources>
        </Configuration>
      </DataCollector>
    </DataCollectors>
  </DataCollectionRunSettings>
</RunSettings>
```

Pass runsettings via command line without a file:

```sh
dotnet test --collect:"XPlat Code Coverage" -- \
  DataCollectionRunSettings.DataCollectors.DataCollector.Configuration.Format=json,cobertura
```

### Requirements

- .NET 8.0 SDK 8.0.112 or higher
- `Microsoft.NET.Test.Sdk` 17.12.0 or higher

**Note:** VSTest integration does **not** support threshold validation or built-in merge. Use `dotnet-coverage merge` or `reportgenerator` for merging (see `references/reporting.md`).

---

## coverlet.msbuild

### Installation

```xml
<!-- test project .csproj — do NOT add alongside coverlet.collector -->
<ItemGroup>
  <PackageReference Include="coverlet.msbuild" Version="10.0.1">
    <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    <PrivateAssets>all</PrivateAssets>
  </PackageReference>
</ItemGroup>
```

### Usage

```sh
# Basic run
dotnet test /p:CollectCoverage=true

# With output format and path
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=opencover /p:CoverletOutput=./artifacts/coverage/

# Multiple formats (escape quotes in shell)
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=\"json,opencover\"

# With threshold
dotnet test /p:CollectCoverage=true /p:Threshold=80 /p:ThresholdType=line /p:ThresholdStat=total
```

### Key MSBuild Properties

| Property               | Default              | Description                                               |
| ---------------------- | -------------------- | --------------------------------------------------------- |
| `CollectCoverage`      | `false`              | Enables coverage collection                               |
| `CoverletOutput`       | `./`                 | Output path; end with `/` for directory                   |
| `CoverletOutputFormat` | `json`               | Comma-separated: `json,lcov,opencover,cobertura,teamcity` |
| `Threshold`            | —                    | Minimum coverage %; comma-separated for multiple types    |
| `ThresholdType`        | `line,branch,method` | `line`, `branch`, `method`                                |
| `ThresholdStat`        | `Minimum`            | `Minimum`, `Total`, `Average`                             |
| `Exclude`              | —                    | Filter expressions `[Assembly]Type`                       |
| `Include`              | —                    | Filter expressions to include                             |
| `ExcludeByAttribute`   | —                    | Attribute names to exclude                                |
| `ExcludeByFile`        | —                    | Glob file patterns to exclude                             |
| `MergeWith`            | —                    | Path to prior `coverage.json` to merge                    |
| `UseSourceLink`        | `false`              | Use SourceLink URIs instead of file paths                 |
| `SkipAutoProps`        | `false`              | Skip auto-implemented properties                          |
| `IncludeTestAssembly`  | `false`              | Include test project in results                           |
| `DeterministicReport`  | `false`              | Deterministic report for deterministic builds             |

### Requirements

- .NET 8.0 SDK 8.0.112 or higher
- .NET Framework 4.7.2+ (for .NET Framework targets)

---

## coverlet.console (Global Tool)

### Installation

```sh
dotnet tool install --global coverlet.console
# or as a local tool
dotnet tool install coverlet.console
```

### Usage

```sh
# Basic — MUST use --no-build to avoid invalidating instrumented assembly
coverlet /path/to/MyTests.dll \
  --target "dotnet" \
  --targetargs "test /path/to/MyTests --no-build"

# With format and output path
coverlet ./bin/Debug/net8.0/MyTests.dll \
  --target "dotnet" \
  --targetargs "test ./MyTests --no-build" \
  --format cobertura \
  --output ./artifacts/coverage/

# Integration/e2e tests (instrument entire folder)
coverlet "/path/to/app-under-test" --target "/path/to/runner.exe"
```

### Exit Codes

| Code  | Meaning                                   |
| ----- | ----------------------------------------- |
| `0`   | Success                                   |
| `1`   | Test failure                              |
| `2`   | Coverage below threshold                  |
| `3`   | Test failure AND coverage below threshold |
| `101` | General exception                         |

### Requirements

- .NET 8.0 or above runtime installed globally

---

## .NET 10 Compatibility

.NET 10 enables Microsoft Testing Platform by default for `dotnet test`. This **breaks** `coverlet.collector` and `coverlet.msbuild`.

**Option A — Use `coverlet.MTP`** (recommended for new projects):

```xml
<ItemGroup>
  <PackageReference Include="coverlet.MTP" Version="10.0.1" />
</ItemGroup>
```

**Option B — Disable MTP in the test project** (to keep using `coverlet.collector`):

```xml
<!-- test project .csproj -->
<PropertyGroup>
  <TestingPlatformDotnetTestSupport>false</TestingPlatformDotnetTestSupport>
</PropertyGroup>
```
