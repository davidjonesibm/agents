# Coverlet Patterns

Filter expressions, attribute exclusions, source file exclusions, idiomatic patterns, and anti-patterns.

## Filter Expression Syntax

Syntax: `[Assembly-Filter]Type-Filter`

- **Assembly-Filter** — matches the assembly name (without `.dll`)
- **Type-Filter** — matches the fully-qualified type name including namespace
- Wildcards: `*` = zero or more characters; `?` makes the preceding character optional

### Examples

| Filter                          | Effect                                                             |
| ------------------------------- | ------------------------------------------------------------------ |
| `[*]*`                          | Exclude/include all types in all assemblies                        |
| `[MyApp.*]*`                    | All types in assemblies matching `MyApp.*`                         |
| `[MyApp]MyApp.Services.*`       | All types in the `MyApp.Services` namespace in `MyApp` assembly    |
| `[MyApp]MyApp.Models.UserModel` | Only the `UserModel` class                                         |
| `[MyApp.*.Tests?]*`             | All types in assemblies matching `MyApp.*.Test` or `MyApp.*.Tests` |
| `[*]MyApp.Migrations.*`         | All migration types across any assembly                            |

### Exclude vs. Include

- **`Exclude` takes precedence** over `Include` when both match the same type.
- Default VSTest excludes: `[coverlet.*]*`, `[xunit.*]*`, `[NUnit3.*]*`, `[Microsoft.Testing.*]*`, `[Microsoft.Testplatform.*]*`, `[Microsoft.VisualStudio.TestPlatform.*]*` — user-supplied filters are **appended** to these defaults.
- Use `Include` to whitelist only your application assemblies; then exclusion filters refine within that set.

```sh
# WRONG — including everything and trying to exclude test assemblies
dotnet test /p:CollectCoverage=true /p:Include="[*]*" /p:Exclude="[*.Tests]*"

# RIGHT — include only your app assemblies explicitly
dotnet test /p:CollectCoverage=true /p:Include="[MyApp.*]*"
```

### Specifying Multiple Filters

**MSBuild** — comma-separated, escape quotes in shell:

```sh
dotnet test /p:CollectCoverage=true /p:Exclude=\"[MyApp.Tests]*,[MyApp.Migrations]*\"
```

**PowerShell / Azure DevOps** — use `%2c` instead of `,`:

```sh
/p:Exclude="[MyApp.Tests]*%2c[MyApp.Migrations]*"
```

**Global tool** — repeat the flag:

```sh
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" \
  --exclude "[MyApp.Tests]*" \
  --exclude "[MyApp.Migrations]*"
```

**VSTest runsettings** — comma-separated in XML:

```xml
<Exclude>[MyApp.Tests]*,[MyApp.Migrations]*</Exclude>
```

---

## Attribute Exclusions

### Built-in: ExcludeFromCodeCoverage

Apply `System.Diagnostics.CodeAnalysis.ExcludeFromCodeCoverage` to methods, classes, or assemblies. Coverlet always honors this attribute across all drivers.

```csharp
// Before — coverage noise from generated/scaffold code
public class Program
{
    public static void Main(string[] args) { /* scaffold */ }
}

// After — exclude scaffold entry point
[System.Diagnostics.CodeAnalysis.ExcludeFromCodeCoverage]
public class Program
{
    public static void Main(string[] args) { /* scaffold */ }
}
```

### Additional Attributes (ExcludeByAttribute)

Exclude any attribute by name, full name, or fully qualified type name.

**MSBuild:**

```sh
dotnet test /p:CollectCoverage=true /p:ExcludeByAttribute="Obsolete%2cGeneratedCodeAttribute%2cCompilerGeneratedAttribute"
```

**VSTest runsettings:**

```xml
<ExcludeByAttribute>Obsolete,GeneratedCodeAttribute,CompilerGeneratedAttribute</ExcludeByAttribute>
```

**Global tool:**

```sh
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" \
  --exclude-by-attribute Obsolete \
  --exclude-by-attribute GeneratedCodeAttribute \
  --exclude-by-attribute CompilerGeneratedAttribute
```

---

## Source File Exclusions

Exclude files by glob pattern — useful for generated code, migrations, scaffolding.

**MSBuild:**

```sh
dotnet test /p:CollectCoverage=true /p:ExcludeByFile=\"**/Migrations/*.cs,**/obj/**/*.cs,**/*.g.cs\"
```

**VSTest runsettings:**

```xml
<ExcludeByFile>**/Migrations/*.cs,**/obj/**/*.cs,**/*.g.cs,</ExcludeByFile>
```

**Global tool:**

```sh
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" \
  --exclude-by-file "**/Migrations/*.cs" \
  --exclude-by-file "**/obj/**/*.cs"
```

---

## SkipAutoProps

Neither track nor record auto-implemented properties. Reduces noise in coverage metrics for trivial getters/setters.

```sh
# MSBuild
dotnet test /p:CollectCoverage=true /p:SkipAutoProps=true

# Global tool
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" --skipautoprops
```

---

## DoesNotReturnAttribute

Methods decorated with these attributes are known to never return (e.g., throw helpers). Statements following them are excluded from coverage rather than appearing as uncovered branches.

```csharp
// Custom throw helper
[System.Diagnostics.CodeAnalysis.DoesNotReturn]
public static void ThrowIfNull(object? value, string name)
{
    throw new ArgumentNullException(name);
}
```

```sh
# MSBuild
dotnet test /p:CollectCoverage=true /p:DoesNotReturnAttribute="DoesNotReturnAttribute,ThrowHelperAttribute"

# Global tool
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" \
  --does-not-return-attribute DoesNotReturnAttribute
```

---

## Anti-Patterns

### ❌ Adding both coverlet.collector and coverlet.msbuild

```xml
<!-- WRONG — mutually exclusive, causes double instrumentation or build errors -->
<PackageReference Include="coverlet.collector" Version="10.0.1" />
<PackageReference Include="coverlet.msbuild" Version="10.0.1" />
```

```xml
<!-- RIGHT — pick one -->
<PackageReference Include="coverlet.collector" Version="10.0.1" />
```

### ❌ Missing --no-build with the global tool

```sh
# WRONG — dotnet test rebuilds the assembly, invalidating instrumentation
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test"

# RIGHT — always pass --no-build
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build"
```

### ❌ Using coverlet.collector with MTP (coverlet.MTP)

```xml
<!-- WRONG — collector cannot work with MTP test host -->
<PackageReference Include="Microsoft.Testing.Platform" Version="..." />
<PackageReference Include="coverlet.collector" Version="10.0.1" />
```

```xml
<!-- RIGHT — use coverlet.MTP for MTP-based projects -->
<PackageReference Include="coverlet.MTP" Version="10.0.1" />
```

### ❌ Hardcoding the TestResults GUID path

```yaml
# WRONG — the GUID subdirectory is non-deterministic
- name: Upload coverage
  uses: actions/upload-artifact@v4
  with:
    path: TestResults/abc123-.../coverage.cobertura.xml
```

```yaml
# RIGHT — use glob pattern
- name: Upload coverage
  uses: actions/upload-artifact@v4
  with:
    path: '**/coverage.cobertura.xml'
```

### ❌ Escaping multi-value properties incorrectly on Linux with MSBuild

```sh
# WRONG on Linux with raw MSBuild (not dotnet msbuild)
msbuild /p:CoverletOutputFormat="json,opencover"

# RIGHT — use dotnet msbuild instead (immune to Linux backslash issue)
dotnet msbuild /p:CoverletOutputFormat=\"json,opencover\"
```
