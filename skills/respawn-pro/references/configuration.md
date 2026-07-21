# Configuration

Provider-specific setup, recommended `RespawnerOptions` configurations, and common misconfigurations.

## Installation

```bash
dotnet add package Respawn
```

Current stable: **v7.0.0** (requires .NET 6+).

---

## SQL Server Setup

```csharp
// appsettings.json or environment variable
// "ConnectionStrings:TestDb": "Server=.;Database=MyTestDb;Trusted_Connection=True;"

await using var conn = new SqlConnection(connectionString);
await conn.OpenAsync();

var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
{
    TablesToIgnore = new Table[]
    {
        "__EFMigrationsHistory",
        "sysdiagrams"
    },
    SchemasToExclude = new[] { "RoundhousE" }, // migration schema
    CheckTemporalTables = true,                // handle temporal tables
    WithReseed = true,                         // reset IDENTITY columns
    CommandTimeout = 120
});
```

---

## PostgreSQL Setup

```csharp
await using var conn = new NpgsqlConnection(connectionString);
await conn.OpenAsync();

var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
{
    SchemasToInclude = new[] { "public" },     // exclude pg_catalog, information_schema
    TablesToIgnore = new Table[]
    {
        "__EFMigrationsHistory"
    }
});
```

> **PostgreSQL caution:** Without `SchemasToInclude`, Respawn will scan all user schemas. Always restrict to the schemas your tests own.

---

## MySQL Setup

```csharp
await using var conn = new MySqlConnection(connectionString);
await conn.OpenAsync();

var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
{
    TablesToIgnore = new Table[] { "__EFMigrationsHistory" },
    // MySQL: database name == schema name
    SchemasToInclude = new[] { "mytestdb" }
});
```

> **MySQL caution:** Table names on Linux are case-sensitive. Use exact case in `TablesToIgnore`.

---

## SQLite Setup

```csharp
await using var conn = new SqliteConnection("Data Source=:memory:");
await conn.OpenAsync();

var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
{
    TablesToIgnore = new Table[] { "__EFMigrationsHistory" }
});
```

> **SQLite note:** In-memory SQLite databases are per-connection. For shared in-memory databases, use `"Data Source=mydb;Mode=Memory;Cache=Shared"` and keep at least one connection open.

---

## Temporal Tables (SQL Server Only)

```csharp
// ❌ Without CheckTemporalTables — DELETE on temporal table history fails
var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions());

// ✅ With CheckTemporalTables — system-versioning disabled/re-enabled around DELETE
var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
{
    CheckTemporalTables = true
});
```

Respawn will:

1. Query `sys.tables` for temporal tables.
2. Execute `ALTER TABLE ... SET (SYSTEM_VERSIONING = OFF)` before delete.
3. Execute `ALTER TABLE ... SET (SYSTEM_VERSIONING = ON)` after delete.

Both steps run inside their own transactions.

---

## Identity Reseed (SQL Server / MySQL)

```csharp
// Reset IDENTITY columns back to 0 after each test run
var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
{
    WithReseed = true
});
```

- SQL Server: generates `DBCC CHECKIDENT ('[schema].[table]', RESEED, 0)`.
- Ensures tests that rely on predictable IDs (e.g., ID = 1) don't break after multiple runs.
- **Trade-off:** slightly slower reset; only enable when tests assert on specific identity values.

---

## Custom Delete Statement

```csharp
// Replace hard-delete with soft-delete for auditable tables
var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
{
    FormatDeleteStatement = table =>
    {
        if (table.Name == "AuditEvents")
            return $"UPDATE [{table.Schema ?? "dbo"}].[{table.Name}] SET IsDeleted = 1, DeletedAt = GETUTCDATE()";
        return $"DELETE FROM [{table.Schema ?? "dbo"}].[{table.Name}]";
    }
});
```

> **Warning:** `FormatDeleteStatement` bypasses Respawn's DELETE generation entirely for matched tables. You are responsible for correct SQL syntax for the target database. See also `references/api.md` for the full `Func<Table, string>` callback signature and `Table` properties.

---

## Common Misconfigurations

### ❌ Forgetting migration history table

```csharp
// Before — EF migrations table gets wiped; next run fails with missing schema
var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions());

// After — protect the migrations table
var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
{
    TablesToIgnore = new Table[] { "__EFMigrationsHistory" }
});
```

### ❌ Not scoping PostgreSQL to user schemas

```csharp
// Before — may attempt to delete from system schemas
var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions());

// After — restrict to application schema
var respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
{
    SchemasToInclude = new[] { "public" }
});
```

### ❌ Using CommandTimeout = 0 on CI

```csharp
// Before — zero means infinite; hangs CI if a lock is held
new RespawnerOptions { CommandTimeout = 0 }

// After — set a reasonable timeout
new RespawnerOptions { CommandTimeout = 30 }
```

### ❌ `TablesToIgnore` table name case mismatch (MySQL/Linux)

```csharp
// Before — "Orders" won't match "orders" on Linux MySQL
new RespawnerOptions { TablesToIgnore = new Table[] { "Orders" } }

// After — use exact case
new RespawnerOptions { TablesToIgnore = new Table[] { "orders" } }
```
