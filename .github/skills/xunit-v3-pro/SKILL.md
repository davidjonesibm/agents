---
name: xunit-v3-pro
description: >-
  Comprehensively reviews and guides xUnit.net v3 test code for best practices
  on project setup, Fact/Theory/collection fixtures, IAsyncLifetime, Assert API
  (including Assert.Skip, Assert.Equivalent), TestContext, dynamic skipping,
  explicit tests, parallelization, xunit.runner.json configuration, theory data
  rows (TheoryDataRow, MatrixTheoryData), IXunitSerializer, test pipeline startup,
  output capture, and migration from v2 to v3. Use when reading, writing, or
  reviewing .NET test projects that use xUnit, xunit.v3, Fact, Theory,
  IAsyncLifetime, fixtures, test collections, TestContext, Assert, or migrating
  from xunit v2 to xunit v3. Trigger keywords: xUnit, xunit, v3, xunit.v3, Fact,
  Theory, Assert, IAsyncLifetime, IAsyncDisposable, fixtures, collection fixtures,
  assembly fixtures, TestContext, ClassFixture, CollectionFixture, TheoryDataRow,
  MatrixTheoryData, IXunitSerializer, test collections, migration, xunit v2 to v3.
---

Writes and reviews xUnit.net v3 test code targeting the `xunit.v3` 4.0.0+ packages on .NET 8+.

Review process:

1. Check project setup and package references using `references/setup.md`.
2. Validate idiomatic test patterns (facts, theories, fixtures, organization) using `references/patterns.md`.
3. Review assertion usage (Assert API, new v3 assertions) using `references/assertions.md`.
4. Check test lifecycle, fixture setup/teardown, and disposal using `references/lifecycle.md`.
5. Validate runner configuration (`xunit.runner.json`, parallelization) using `references/configuration.md`.
6. If migrating from v2, apply breaking-change guidance using `references/migration.md`.
7. Review advanced features (TestContext, dynamic skip, theory data, pipeline startup, MTP) using `references/advanced.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target xUnit.net v3 (`xunit.v3` 4.0.0+) on .NET 8 or later.
- Test projects must be executables (`<OutputType>Exe</OutputType>`), not libraries.
- `async void` tests are not supported — always use `Task` or `ValueTask`.
- `IAsyncLifetime` now returns `ValueTask`; when both `IAsyncDisposable` and `IDisposable` are implemented, only `DisposeAsync` is called.
- Never use `ITestOutputHelper` from the `Xunit.Abstractions` namespace — it moved to `Xunit`.
- Prefer `[Collection<T>]` generic syntax over `[Collection("Name")]` string syntax on .NET 8+.
- Use `TheoryDataRow<T>` for strongly-typed theory data with per-row metadata (skip, display name, traits).

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary (critical → warning → suggestion).
