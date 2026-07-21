---
name: respawn-pro
description: >-
  Comprehensively reviews and guides Respawn usage for intelligent database cleanup
  in .NET integration tests. Covers Respawner setup, RespawnerOptions configuration,
  TablesToIgnore, TablesToInclude, SchemasToInclude, SchemasToExclude, database
  provider support (SQL Server, PostgreSQL, MySQL, SQLite, Oracle, Snowflake),
  CheckTemporalTables, WithReseed, FormatDeleteStatement, async API, xUnit/NUnit
  fixture patterns, and common pitfalls. USE WHEN reading, writing, or reviewing
  .NET integration tests that use Respawn or the jbogard/Respawn NuGet package for
  database reset, checkpoint, or test isolation. DO NOT USE FOR: application-layer
  data access code (use dapper-pro or ef-core), transactional rollback strategies,
  or non-Respawn test cleanup approaches.
---

Reviews and guides Respawn v7 usage for deterministic database cleanup in .NET integration tests.

Review process:

1. Check API usage against `references/api.md` — verify `Respawner.CreateAsync` call, `RespawnerOptions` fields, and `Table` constructor usage.
2. Validate configuration patterns using `references/configuration.md` — provider setup, schema/table filters, temporal tables, identity reseed.
3. Check integration test fixture patterns using `references/patterns.md` — shared fixture initialization, per-test reset, async safety, and anti-patterns.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target Respawn v7.0.0 or later (latest as of 2025).
- `Respawner` is created once per test suite via `Respawner.CreateAsync` and reused — never recreate per test.
- `ResetAsync` is called before (or at the start of) each test, not after — ensures a known clean state regardless of previous test failures.
- Always pass an open `DbConnection` to both `CreateAsync` and `ResetAsync`; for SQL Server, a connection string overload exists but the connection overload is preferred for multi-provider consistency.
- `DbAdapter` is inferred from the connection type — only set it explicitly when using a wrapper/proxy connection that hides the real type.
- Inspect `respawner.DeleteSql` after `CreateAsync` in tests to debug what tables will be cleared.

## Output Format

Organize findings by file. For each issue:

```
**[CRITICAL|WARNING|SUGGESTION]** `ClassName.Method` — description.
Before: <code>
After: <code>
```

End with a summary count: N critical, N warnings, N suggestions.
