# API Reference

Respawn v7 public API surface — `Respawner`, `RespawnerOptions`, `Table`, and `DbAdapter`.

## `Respawner` Class

| Member        | Signature                                                                                                | Notes                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `CreateAsync` | `static async Task<Respawner> CreateAsync(DbConnection connection, RespawnerOptions? options = default)` | Factory method. Queries DB metadata and builds DELETE order once.        |
| `ResetAsync`  | `async Task ResetAsync(DbConnection connection)`                                                         | Executes the pre-built DELETE SQL against an open connection.            |
| `DeleteSql`   | `string? DeleteSql { get; }`                                                                             | Inspect this after `CreateAsync` to see the generated DELETE statements. |
| `ReseedSql`   | `string? ReseedSql { get; }`                                                                             | Non-null only when `WithReseed = true`.                                  |
| `Options`     | `RespawnerOptions Options { get; }`                                                                      | The resolved options (with `DbAdapter` always set after creation).       |

### `CreateAsync` behaviour

- Queries information schema / system catalogs to discover tables and foreign-key relationships.
- Builds a topological DELETE order (leaf tables first, parent tables last).
- Throws `InvalidOperationException` if no tables are found after applying all filters — indicates the database is empty or all tables are excluded.
- Infers `DbAdapter` from the runtime type of `connection` (see `DbAdapter` section below).

```csharp
// ✅ Correct — create once, reuse
private static Respawner _respawner = null!;

public static async Task InitializeAsync(DbConnection connection)
{
    _respawner = await Respawner.CreateAsync(connection, new RespawnerOptions
    {
        TablesToIgnore = new Table[] { "sysdiagrams", "__EFMigrationsHistory" },
        SchemasToExclude = new[] { "migrations" }
    });
}

// ❌ Wrong — recreating per test is expensive (re-queries metadata every time)
public async Task MyTest()
{
    var respawner = await Respawner.CreateAsync(connection, options); // ❌
    await respawner.ResetAsync(connection);
}
```

---

## `RespawnerOptions` Class

All properties are `init`-only (set via object initializer, immutable after construction).

| Property                | Type                   | Default                 | Purpose                                                                                         |
| ----------------------- | ---------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `TablesToIgnore`        | `Table[]`              | `[]`                    | Tables that are never deleted. Preserves lookup/seed data.                                      |
| `TablesToInclude`       | `Table[]`              | `[]`                    | When non-empty, only these tables are deleted (whitelist mode).                                 |
| `SchemasToInclude`      | `string[]`             | `[]`                    | When non-empty, only tables in these schemas are deleted.                                       |
| `SchemasToExclude`      | `string[]`             | `[]`                    | Tables in these schemas are never deleted.                                                      |
| `CheckTemporalTables`   | `bool`                 | `false`                 | Detect SQL Server temporal tables and disable system-versioning before delete, re-enable after. |
| `WithReseed`            | `bool`                 | `false`                 | Reset identity columns to 0 after deletion (SQL Server `DBCC CHECKIDENT`).                      |
| `CommandTimeout`        | `int?`                 | `null` (driver default) | Timeout in seconds for DELETE commands.                                                         |
| `FormatDeleteStatement` | `Func<Table, string>?` | `null`                  | Override the DELETE statement for specific tables. Useful for soft-delete patterns.             |
| `DbAdapter`             | `IDbAdapter?`          | `null` (auto-inferred)  | Override the database adapter.                                                                  |

### `TablesToIgnore` vs `TablesToInclude`

```csharp
// Ignore specific tables — everything else is deleted
new RespawnerOptions
{
    TablesToIgnore = new Table[]
    {
        "__EFMigrationsHistory",         // simple name (default schema)
        "sysdiagrams",
        new Table("dbo", "LookupData"),  // explicit schema + name
        new Table("ref", "Countries")
    }
}

// Whitelist mode — only delete these specific tables
new RespawnerOptions
{
    TablesToInclude = new Table[]
    {
        "Orders",
        "OrderItems",
        "Customers"
    }
}
```

> **Note:** `TablesToIgnore` and `TablesToInclude` are mutually exclusive in intent — using both simultaneously results in the intersection (only whitelisted tables that are also not ignored).

### `SchemasToInclude` vs `SchemasToExclude`

```csharp
// Include only the public schema (PostgreSQL common pattern)
new RespawnerOptions
{
    SchemasToInclude = new[] { "public" }
}

// Exclude migration-tool schemas
new RespawnerOptions
{
    SchemasToExclude = new[] { "RoundhousE", "migrations", "flyway" }
}
```

### `FormatDeleteStatement` — custom delete logic

```csharp
// Soft-delete instead of hard-delete for specific tables
new RespawnerOptions
{
    FormatDeleteStatement = table => table.Name == "AuditLog"
        ? $"UPDATE [{table.Schema}].[{table.Name}] SET IsDeleted = 1"
        : $"DELETE FROM [{table.Schema}].[{table.Name}]"
}
```

---

## `Table` Class (`Respawn.Graph.Table`)

```csharp
// Implicit conversion from string (default schema)
Table t1 = "MyTable";

// Explicit with schema
var t2 = new Table("MySchema", "MyTable");

// Properties
string? schema = t2.Schema; // "MySchema"
string name    = t2.Name;   // "MyTable"
```

`Table` implements `IEquatable<Table>` — schema-qualified name equality. Two `Table` instances with the same schema+name are equal and won't duplicate in `HashSet<Table>`.

---

## `DbAdapter` — Supported Providers

Respawn infers the adapter from the `DbConnection` runtime type. Only set explicitly when the connection is wrapped.

See also `references/configuration.md` for provider-specific setup examples and common misconfigurations per adapter.

| DbAdapter Enum Value  | Inferred From                    | NuGet Driver                     |
| --------------------- | -------------------------------- | -------------------------------- |
| `DbAdapter.SqlServer` | `SqlConnection`                  | `Microsoft.Data.SqlClient`       |
| `DbAdapter.Postgres`  | `NpgsqlConnection`               | `Npgsql`                         |
| `DbAdapter.MySql`     | `MySqlConnection`                | `MySql.Data` or `MySqlConnector` |
| `DbAdapter.Oracle`    | `OracleConnection`               | `Oracle.ManagedDataAccess`       |
| `DbAdapter.Informix`  | `DB2Connection`, `IfxConnection` | IBM drivers                      |
| `DbAdapter.Sqlite`    | `SqliteConnection`               | `Microsoft.Data.Sqlite`          |
| `DbAdapter.Snowflake` | `SnowflakeDbConnection`          | `Snowflake.Data`                 |

```csharp
// ✅ Let Respawn infer (preferred)
var respawner = await Respawner.CreateAsync(npgsqlConnection);

// ✅ Explicit — needed when using a connection proxy/wrapper
var respawner = await Respawner.CreateAsync(wrappedConnection, new RespawnerOptions
{
    DbAdapter = DbAdapter.Postgres
});

// ❌ Explicit when not needed — fragile if driver changes
var respawner = await Respawner.CreateAsync(npgsqlConnection, new RespawnerOptions
{
    DbAdapter = DbAdapter.Postgres  // redundant
});
```

### Provider-specific notes

- **SQL Server:** `ResetAsync` accepts a connection string overload — avoid it; use the `DbConnection` overload for consistency.
- **PostgreSQL:** Use `SchemasToInclude = new[] { "public" }` unless you have multiple schemas to reset; avoids touching `pg_catalog`, `information_schema`.
- **MySQL:** Table names are case-sensitive on Linux. Match case exactly in `TablesToIgnore`.
- **SQLite:** Foreign key enforcement is disabled per-connection; Respawn still resolves topological order but no FK violations will occur during deletion.
- **Temporal Tables (SQL Server):** Set `CheckTemporalTables = true` to handle SQL Server temporal table history — Respawn disables system-versioning before deletion and re-enables it after.
