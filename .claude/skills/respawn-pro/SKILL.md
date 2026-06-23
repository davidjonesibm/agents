---
name: respawn-pro
description: >-
  Respawn library for fast database cleanup in integration tests. Use when setting up
  test database reset strategies with Respawn in .NET projects.
---

Review Respawn usage for correctness and efficient test database cleanup.

Load reference files from `.github/skills/respawn-pro/references/` as needed.

## Core Instructions

- Initialize `Respawner` once per test fixture (expensive operation), reuse across tests.
- Call `respawner.ResetAsync(connection)` between tests, not before the first test.
- Configure `TablesToIgnore` for migration history tables and seed data tables.
- Configure `SchemasToInclude` to limit scope in multi-schema databases.
- Use with Testcontainers for fully isolated integration tests.
- Prefer Respawn over `DELETE FROM` or database recreation for speed.
- Always dispose database connections properly after reset.
