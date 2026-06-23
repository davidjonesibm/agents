# Coverlet Troubleshooting

Known issues, common failures, driver incompatibilities, and diagnostic patterns.

## .NET 10: coverlet.collector / coverlet.msbuild Incompatible with MTP

**Symptom:** Coverage is not collected, or `dotnet test` fails with errors about Microsoft Testing Platform when using `coverlet.collector` or `coverlet.msbuild`.

**Cause:** .NET 10 enables Microsoft Testing Platform by default in `dotnet test`. `coverlet.collector` and `coverlet.msbuild` are VSTest-era drivers and cannot function with the MTP test host.

**Fix A — Switch to `coverlet.MTP`:**

```xml
<!-- Remove coverlet.collector or coverlet.msbuild, add coverlet.MTP -->
<PackageReference Include="coverlet.MTP" Version="10.0.1" />
```

**Fix B — Opt out of MTP in the test project:**

```xml
<PropertyGroup>
  <TestingPlatformDotnetTestSupport>false</TestingPlatformDotnetTestSupport>
</PropertyGroup>
```

---

## No Coverage Data / 0% Coverage

**Symptom:** All coverage metrics report 0%, or no `coverage.*` output file is generated.

**Common causes and fixes:**

| Cause                                                        | Fix                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Test assembly rebuilt between instrumentation and execution  | Add `--no-build` to the `--targetargs` when using the global tool                                             |
| `coverlet.collector` driver but using wrong `--collect` name | Use exactly `--collect:"XPlat Code Coverage"` (case-sensitive)                                                |
| PDB files missing from build output                          | Ensure `<DebugType>portable</DebugType>` or `full` in the test project                                        |
| Non-SDK-style `.csproj`                                      | Coverlet only supports SDK-style projects                                                                     |
| Assemblies filtered out by default VSTest excludes           | Check that your app assemblies aren't caught by `[coverlet.*]*` or similar — add an explicit `Include` filter |

**Global tool — verify `--no-build`:**

```sh
# WRONG — test project is rebuilt, coverage is invalid
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test"

# RIGHT
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build"
```

---

## VSTest Output in Non-Deterministic Folder

**Symptom:** `coverage.cobertura.xml` can't be found at a stable path after `dotnet test --collect:"XPlat Code Coverage"`.

**Cause:** VSTest places attachments in `TestResults/<guid>/` — the GUID is regenerated per run.

**Fix — Use glob patterns or stable results directory:**

```sh
# Stable results directory
dotnet test --collect:"XPlat Code Coverage" --results-directory ./artifacts/coverage

# GitHub Actions — glob pattern
path: '**/coverage.cobertura.xml'

# Azure DevOps
summaryFileLocation: '$(Build.SourcesDirectory)/**/coverage.cobertura.xml'
```

---

## Threshold Validation Not Working with coverlet.collector

**Symptom:** Build passes even when coverage is below the specified threshold.

**Cause:** VSTest integration (`coverlet.collector`) does not support threshold validation. It is only available via `coverlet.msbuild` and `coverlet.console`.

**Fix — Use MSBuild driver for threshold gates:**

```sh
# coverlet.msbuild — threshold enforced
dotnet test /p:CollectCoverage=true /p:Threshold=80 /p:ThresholdType=line

# Or use global tool
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" --threshold 80
```

---

## Merge Not Working with coverlet.collector

**Symptom:** Coverage from multiple test projects is not combined.

**Cause:** VSTest integration does not support built-in merge. Only `coverlet.msbuild` and `coverlet.console` support `MergeWith` / `--merge-with`.

**Fix — Post-process with `dotnet-coverage`:**

```sh
dotnet tool install --global dotnet-coverage
dotnet-coverage merge '**/coverage.cobertura.xml' -f cobertura -o merged.xml
```

See `references/reporting.md` for full merge patterns.

---

## Linux MSBuild Escaping Errors

**Symptom:** MSBuild error `Property is not valid` or `Switch: opencover/` on Linux CI when specifying multiple comma-separated values.

**Cause:** Linux MSBuild translates `\` to `/` in properties, corrupting escaped quotes.

**Fix — Use `dotnet msbuild` instead of raw `msbuild`:**

```sh
# WRONG — raw msbuild on Linux
msbuild /p:CoverletOutputFormat=\"json,opencover\"

# RIGHT — dotnet msbuild is not affected
dotnet msbuild /p:CoverletOutputFormat=\"json,opencover\"
# or
dotnet test /p:CoverletOutputFormat=\"json,opencover\"
```

---

## Incomplete Coverage from Forceful Process Termination (Global Tool)

**Symptom:** Coverage report is empty or partial when using the global tool with integration/e2e tests.

**Cause:** The global tool flushes hit data on `AppDomain.ProcessExit`. Forcefully killing the process (e.g., timeout kill) prevents the flush.

**Fix — Ensure graceful shutdown of the target process:**

```sh
# Ensure your test runner or app exits cleanly
# Avoid SIGKILL (kill -9) — use SIGTERM (kill) to allow AppDomain.ProcessExit to fire
```

---

## Missing PDB / BadImageFormatException on .NET Framework

**Symptom:** `BadImageFormatException` or no coverage data on .NET Framework 4.7.x / 4.8.x.

**Cause:** .NET Framework support has known limitations. See [KnownIssues.md](https://github.com/coverlet-coverage/coverlet/blob/master/Documentation/KnownIssues.md).

**Fix:**

- Ensure PDBs are generated alongside the test assembly (`<DebugType>full</DebugType>` for .NET Framework)
- Use `coverlet.msbuild` rather than the collector for .NET Framework projects
- Check the known issues document for current workarounds

---

## ExcludeAssembliesWithoutSources Values

Controls how Coverlet handles assemblies whose source files cannot be located on disk:

| Value                  | Behavior                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| `MissingAll` (default) | Include assembly if **at least one** source document matches on disk |
| `MissingAny`           | Include assembly only if **all** source documents match on disk      |
| `None`                 | Never exclude based on missing sources                               |

```sh
# MSBuild
dotnet test /p:CollectCoverage=true /p:ExcludeAssembliesWithoutSources=MissingAny

# Global tool
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" \
  --exclude-assemblies-without-sources MissingAny
```

Use `None` when working with NuGet packages or referenced assemblies that have embedded sources but no local source checkout.
