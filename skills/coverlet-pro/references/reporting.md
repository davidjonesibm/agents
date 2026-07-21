# Coverlet Reporting

Output formats, threshold enforcement, result merging, ReportGenerator integration, and CI/CD patterns.

## Output Formats

| Format      | Flag value  | Output file                  | Use case                                       |
| ----------- | ----------- | ---------------------------- | ---------------------------------------------- |
| `json`      | `json`      | `coverage.json`              | Coverlet-native; required for `--merge-with`   |
| `cobertura` | `cobertura` | `coverage.cobertura.xml`     | Azure DevOps, GitHub Actions, ReportGenerator  |
| `opencover` | `opencover` | `coverage.opencover.xml`     | SonarQube, Codecov, Coveralls, ReportGenerator |
| `lcov`      | `lcov`      | `coverage.info`              | Codecov, LCOV viewer, VS Code Coverage Gutters |
| `teamcity`  | `teamcity`  | (service messages to stdout) | JetBrains TeamCity build statistics            |

### Specifying Output Path

Always append `/` to output a **directory** (required when emitting multiple formats):

```sh
# MSBuild — directory output
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=\"json,cobertura\" /p:CoverletOutput=./artifacts/coverage/

# Global tool — directory output with multiple formats
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" \
  -f json -f cobertura \
  -o ./artifacts/coverage/
```

---

## Threshold Enforcement

### Types

- `line` — statement/line coverage
- `branch` — branch coverage (if/else, switch, ternary)
- `method` — method coverage

### Stats

- `Minimum` (default) — each individual module must meet the threshold
- `Total` — combined coverage across all modules must meet the threshold
- `Average` — average across all modules must meet the threshold

### MSBuild

```sh
# Fail if any module's line, branch, or method coverage falls below 80%
dotnet test /p:CollectCoverage=true /p:Threshold=80

# Only enforce line coverage threshold
dotnet test /p:CollectCoverage=true /p:Threshold=80 /p:ThresholdType=line

# Per-type thresholds: line=80%, branch=70%, method=90%
dotnet test /p:CollectCoverage=true \
  /p:Threshold=\"80,70,90\" \
  /p:ThresholdType=\"line,branch,method\"

# Enforce against total combined coverage
dotnet test /p:CollectCoverage=true /p:Threshold=80 /p:ThresholdType=line /p:ThresholdStat=total
```

### Global Tool

```sh
# Fail with exit code 2 if line coverage below 80%
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" \
  --threshold 80 --threshold-type line --threshold-stat total

# Multiple threshold types
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" \
  --threshold 80 --threshold-type line --threshold-type branch
```

**Note:** VSTest (`coverlet.collector`) does **not** support threshold validation. Use MSBuild or the global tool for threshold gates, or post-process results with `reportgenerator`. See `references/troubleshooting.md`.

---

## Merging Results

Merging combines coverage from multiple test projects or test runs into a single report. The merge input **must** be Coverlet's own `json` format.

### MSBuild

```sh
# Run first project — produces coverage.json
dotnet test ./UnitTests /p:CollectCoverage=true /p:CoverletOutput=./artifacts/coverage/

# Run second project — merge into the same file
dotnet test ./IntegrationTests \
  /p:CollectCoverage=true \
  /p:MergeWith=./artifacts/coverage/coverage.json \
  /p:CoverletOutput=./artifacts/coverage/ \
  /p:CoverletOutputFormat=cobertura
```

### Global Tool

```sh
# Run first project
coverlet ./bin/UnitTests.dll --target dotnet --targetargs "test --no-build" \
  -f json -o ./artifacts/coverage/

# Run second project — merge
coverlet ./bin/IntegrationTests.dll --target dotnet --targetargs "test --no-build" \
  --merge-with ./artifacts/coverage/coverage.json \
  -f cobertura -o ./artifacts/coverage/
```

### VSTest Merge Workaround

VSTest (`coverlet.collector`) doesn't support built-in merge. Use `dotnet-coverage`:

```sh
# Install dotnet-coverage tool
dotnet tool install --global dotnet-coverage

# Merge all cobertura reports
dotnet-coverage merge artifacts/coverage/**/coverage.cobertura.xml \
  -f cobertura \
  -o artifacts/coverage/merged.xml
```

---

## ReportGenerator Integration

`reportgenerator` converts Coverlet output into HTML reports, badge images, and additional formats.

```sh
# Install
dotnet tool install --global dotnet-reportgenerator-globaltool

# Generate HTML report from cobertura output
reportgenerator \
  -reports:"**/coverage.cobertura.xml" \
  -targetdir:"artifacts/coverage-report" \
  -reporttypes:"Html;Cobertura"

# Azure DevOps — inline HTML report
reportgenerator \
  -reports:"$(Agent.TempDirectory)/**/coverage.cobertura.xml" \
  -targetdir:"$(Build.SourcesDirectory)/coverage-report" \
  -reporttypes:"HtmlInline_AzurePipelines_Dark;Cobertura"
```

### MSBuild AfterTargets Hook

```xml
<!-- Automatically generate HTML after test coverage runs -->
<Target Name="GenerateHtmlCoverageReport" AfterTargets="GenerateCoverageResultAfterTest">
  <ReportGenerator
    ReportFiles="@(CoverletReport)"
    TargetDirectory="../html-coverage-report" />
</Target>
```

---

## CI/CD Patterns

### GitHub Actions

```yaml
- name: Run tests with coverage
  run: |
    dotnet test --collect:"XPlat Code Coverage" \
      --results-directory ./artifacts/coverage

- name: Upload coverage report
  uses: actions/upload-artifact@v4
  with:
    name: coverage
    path: '**/coverage.cobertura.xml'

# Codecov
- name: Upload to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: '**/coverage.opencover.xml'
```

### Azure DevOps

```yaml
- task: DotNetCoreCLI@2
  displayName: 'Test with coverage'
  inputs:
    command: test
    arguments: >
      --configuration $(buildConfiguration)
      --no-build
      /p:CollectCoverage=true
      /p:CoverletOutputFormat=cobertura
      /p:CoverletOutput=$(Build.SourcesDirectory)/TestResults/Coverage/
      /p:Exclude="[MyApp.DebugHost]*%2c[MyApp.WebHost]*"

# Publish coverage results to Azure DevOps
- task: PublishCodeCoverageResults@2
  displayName: 'Publish coverage'
  inputs:
    summaryFileLocation: '$(Build.SourcesDirectory)/TestResults/Coverage/coverage.cobertura.xml'
```

---

## SourceLink

When builds use SourceLink, enable it in Coverlet so coverage reports reference source URLs instead of local file paths:

```sh
# MSBuild
dotnet test /p:CollectCoverage=true /p:UseSourceLink=true

# Global tool
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" --use-source-link
```

---

## Deterministic Builds

For reproducible builds (`<Deterministic>true</Deterministic>`), enable deterministic report mode to strip machine-specific paths:

```sh
# MSBuild
dotnet test /p:CollectCoverage=true /p:DeterministicReport=true

# With path mapping for global tool
coverlet ./bin/MyTests.dll --target dotnet --targetargs "test --no-build" \
  --source-mapping-file ./SourceRootsMappings.txt
```

`SourceRootsMappings.txt` format (one mapping per line):

```
|C:\git\myapp\=/_/
```
