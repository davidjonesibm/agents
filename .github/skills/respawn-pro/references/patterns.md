# Patterns

Idiomatic integration test patterns, anti-patterns, and fixture setup strategies for Respawn.

## Core Pattern: Shared Fixture + Per-Test Reset

Initialize the `Respawner` once in a class/collection fixture and call `ResetAsync` at the start of each test.

### xUnit — `IAsyncLifetime` Class Fixture

```csharp
// DatabaseFixture.cs
public class DatabaseFixture : IAsyncLifetime
{
    public string ConnectionString { get; } =
        "Server=.;Database=TestDb;Trusted_Connection=True;";

    private Respawner _respawner = null!;

    public async Task InitializeAsync()
    {
        // Run migrations once for the test suite
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        // e.g., EF: await context.Database.MigrateAsync();

        _respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
        {
            TablesToIgnore = new Table[] { "__EFMigrationsHistory" },
            CheckTemporalTables = true,
            WithReseed = true
        });
    }

    public async Task ResetDatabaseAsync()
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await _respawner.ResetAsync(conn);
    }

    public Task DisposeAsync() => Task.CompletedTask;
}

// Test class
[Collection("Database")]
public class OrderTests : IAsyncLifetime
{
    private readonly DatabaseFixture _db;

    public OrderTests(DatabaseFixture db) => _db = db;

    public async Task InitializeAsync() => await _db.ResetDatabaseAsync(); // ✅ reset before each test
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task CreateOrder_ShouldPersist()
    {
        // Arrange — clean database guaranteed
        // ...
    }
}

// CollectionDefinition.cs
[CollectionDefinition("Database")]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture> { }
```

### xUnit — `ICollectionFixture` with `IAsyncLifetime` per test

```csharp
// Reset inside each test's InitializeAsync keeps the fixture stateless
public class ProductTests : IClassFixture<DatabaseFixture>, IAsyncLifetime
{
    private readonly DatabaseFixture _db;
    public ProductTests(DatabaseFixture db) => _db = db;

    public async Task InitializeAsync() => await _db.ResetDatabaseAsync();
    public Task DisposeAsync() => Task.CompletedTask;
}
```

### NUnit — `OneTimeSetUp` + `SetUp`

```csharp
[TestFixture]
public class OrderTests
{
    private static Respawner _respawner = null!;
    private static string _connString = "...";

    [OneTimeSetUp]
    public static async Task OneTimeSetUp()
    {
        // Migrate DB once
        _respawner = await Respawner.CreateAsync(
            CreateConnection(),
            new RespawnerOptions { TablesToIgnore = new Table[] { "__EFMigrationsHistory" } });
    }

    [SetUp]
    public async Task SetUp()
    {
        await using var conn = CreateConnection();
        await conn.OpenAsync();
        await _respawner.ResetAsync(conn); // ✅ reset before each test
    }

    private static SqlConnection CreateConnection()
    {
        return new SqlConnection(_connString);
    }
}
```

---

## Pattern: Testcontainers Integration

Respawn works with Testcontainers — create the container in the fixture, then initialize Respawn. See also `references/configuration.md` for provider-specific `RespawnerOptions` (schema scoping, temporal tables, etc.).

```csharp
public class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16")
        .Build();

    private Respawner _respawner = null!;
    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();

        // Run migrations
        // ...

        _respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
        {
            SchemasToInclude = new[] { "public" },
            TablesToIgnore = new Table[] { "__EFMigrationsHistory" }
        });
    }

    public async Task ResetAsync()
    {
        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();
        await _respawner.ResetAsync(conn);
    }

    public async Task DisposeAsync() => await _container.DisposeAsync();
}
```

---

## Pattern: WebApplicationFactory + Respawn

Reset the database via a scoped service in ASP.NET Core integration tests.

```csharp
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private Respawner _respawner = null!;
    private readonly string _connectionString = "...";

    public async Task InitializeAsync()
    {
        // Start the app and apply migrations
        _ = Services; // trigger app startup

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        _respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
        {
            TablesToIgnore = new Table[] { "__EFMigrationsHistory" }
        });
    }

    public async Task ResetDatabaseAsync()
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();
        await _respawner.ResetAsync(conn);
    }

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
    }
}

public class ApiTests : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public ApiTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public async Task InitializeAsync() => await _factory.ResetDatabaseAsync();
    public Task DisposeAsync() => Task.CompletedTask;
}
```

---

## Anti-Patterns

### ❌ Recreating `Respawner` per test

```csharp
// ❌ Expensive — queries DB metadata on every test
public async Task MyTest()
{
    var respawner = await Respawner.CreateAsync(conn, options);
    await respawner.ResetAsync(conn);
    // test...
}

// ✅ Create once in fixture, reset per test
// See: Shared Fixture pattern above
```

### ❌ Resetting after the test instead of before

```csharp
// ❌ If the test fails mid-execution, cleanup is skipped — next test sees dirty data
public Task DisposeAsync() => _db.ResetDatabaseAsync();

// ✅ Reset before the test — guarantees a clean slate regardless of previous failures
public Task InitializeAsync() => _db.ResetDatabaseAsync();
```

### ❌ Using `ResetAsync` with a closed connection

```csharp
// ❌ Connection must be open
var conn = new NpgsqlConnection(connString);
await _respawner.ResetAsync(conn); // throws — connection not open

// ✅ Open before calling
await conn.OpenAsync();
await _respawner.ResetAsync(conn);
```

### ❌ Ignoring the `DeleteSql` property when debugging

```csharp
// During debugging, log the generated SQL to understand what's being deleted
var respawner = await Respawner.CreateAsync(conn, options);
Console.WriteLine(respawner.DeleteSql); // ✅ inspect to verify table order and coverage
```

### ❌ Using transaction rollback as a substitute

```csharp
// ❌ Rollback-based isolation breaks when:
// 1. Tests run in parallel — different transactions
// 2. Code under test commits its own transaction
// 3. External services write data outside the test transaction

// ✅ Use Respawn reset instead — works regardless of transaction boundaries
```

---

## Parallel Test Execution

Respawn-based cleanup is **not safe for parallel tests against the same database** — resetting while another test is inserting causes data loss.

```
// Safe parallel strategies:
// Option A: Use Testcontainers — one container per test class/collection
// Option B: Use separate database schemas per test worker
// Option C: Run tests sequentially within a collection (xUnit [Collection("Database")])
```

```csharp
// xUnit: serialize all database tests into one collection
[CollectionDefinition("Database", DisableParallelization = true)]
public class DatabaseCollection : ICollectionFixture<DatabaseFixture> { }
```

---

## Debugging: Empty Database Error

```
InvalidOperationException: No tables found. Ensure your target database has at
least one non-ignored table to reset.
```

**Causes:**

- Migrations haven't run before `Respawner.CreateAsync` is called.
- All tables match `TablesToIgnore` or are outside `SchemasToInclude`.
- Wrong database in the connection string (pointing at a different database).

**Fix:** Run migrations before creating the Respawner, and verify filters aren't too restrictive.

```csharp
// ✅ Always migrate before creating Respawner
await context.Database.MigrateAsync();
_respawner = await Respawner.CreateAsync(conn, options);
```
