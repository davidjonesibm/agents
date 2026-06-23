---
name: coverlet-pro
description: >-
  Comprehensively reviews and guides Coverlet .NET code coverage tooling.
  Covers all four integration drivers (coverlet.MTP, coverlet.collector VSTest,
  coverlet.msbuild, coverlet.console global tool), driver selection, filter
  expressions, attribute and source file exclusions, output formats (json, lcov,
  opencover, cobertura, teamcity), coverage threshold enforcement, result merging,
  ReportGenerator integration, CI/CD patterns, and known issues.
  USE WHEN reading, writing, or reviewing .NET projects that use Coverlet for code
  coverage measurement, CI coverage gates, runsettings configuration, or coverage
  report generation. Trigger keywords: Coverlet, coverlet.collector, coverlet.msbuild,
  coverlet.console, coverlet.MTP, XPlat Code Coverage, CollectCoverage, --collect,
  code coverage .NET, dotnet test coverage, cobertura .NET, opencover, lcov .NET,
  coverage threshold .NET, runsettings coverage, ExcludeFromCodeCoverage.
  DO NOT USE FOR: JaCoCo (Java), Istanbul/NYC (JavaScript), application business
  logic unrelated to coverage configuration, or non-.NET coverage tools.
---

Reviews and guides Coverlet v10.x .NET cross-platform code coverage setup, driver selection, filtering, reporting, and threshold enforcement.

Review process:

1. Verify driver selection and package setup using `references/configuration.md` — MTP vs VSTest vs MSBuild vs global tool, required SDK versions, package references, and .NET 10 compatibility.
2. Validate filter expressions and exclusion patterns using `references/patterns.md` — filter syntax, attribute exclusions, source file exclusions, `SkipAutoProps`, anti-patterns, and common mistakes.
3. Check output formats, thresholds, merging, and CI integration using `references/reporting.md` — format selection, threshold configuration, merge workflows, ReportGenerator integration, Azure DevOps / GitHub Actions patterns.
4. Diagnose failures using `references/troubleshooting.md` — known issues, .NET 10 MTP incompatibility, Linux MSBuild escaping, incomplete coverage, non-deterministic output paths.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target Coverlet **v10.x** (latest stable), requiring **.NET 8.0 SDK 8.0.112+** or later.
- Only SDK-style (`<Project Sdk="Microsoft.NET.Sdk">`) projects are supported — classic `.csproj` files are not.
- **Never add both `coverlet.msbuild` and `coverlet.collector` to the same test project** — they are mutually exclusive VSTest-era drivers.
- **Never use `coverlet.collector` or `coverlet.msbuild` with the Microsoft Testing Platform (MTP)** — use `coverlet.MTP` instead.
- The `--no-build` flag is **mandatory** when using the global tool — rebuilding the test assembly after instrumentation corrupts coverage data.
- Coverage results from `coverlet.collector` (VSTest) land in a **non-deterministic GUID subfolder** under `TestResults/` — use glob patterns or `--results-directory` to locate them reliably.

## Output Format

Organize findings by file. For each issue:

```
**[CRITICAL|WARNING|SUGGESTION]** `FileName` — description.
Before: <code>
After: <code>
```

End with a summary count: N critical, N warnings, N suggestions.
