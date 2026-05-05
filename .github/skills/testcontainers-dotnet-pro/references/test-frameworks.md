# Test Framework Integration

xUnit.net, NUnit, and MSTest integration patterns for Testcontainers. Covers isolation vs shared contexts and ADO.NET helpers.

## xUnit.net — Three Approaches

### 1. Manual IAsyncLifetime (Any Container)

Simplest approach, works with any container. Container is created and started per test class.

```csharp
public sealed class CustomerServiceTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:15.1")
        .Build();

    public Task InitializeAsync() => _postgres.StartAsync();
    public Task DisposeAsync() => _postgres.DisposeAsync().AsTask();

    [Fact]
    public async Task ShouldCreateCustomer()
    {
        var cs = _postgres.GetConnectionString();
        // use cs ...
    }
}
```

### 2. ContainerTest<> — Per-Test Isolation (Testcontainers.Xunit)

Creates a **new container for every test method**. Ideal for destructive or state-mutating tests.

```csharp
// Add: dotnet add package Testcontainers.Xunit (v2) or Testcontainers.XunitV3 (v3)

public sealed class RedisIsolatedTests(ITestOutputHelper output)
    : ContainerTest<RedisBuilder, RedisContainer>(output)
{
    protected override RedisBuilder Configure()
    {
        return new RedisBuilder("redis:7.0");
    }

    [Fact]
    public async Task Test1()
    {
        // Container property — a fresh container started before this test
        using var mux = await ConnectionMultiplexer.ConnectAsync(Container.GetConnectionString());
        await mux.GetDatabase().StringSetAsync("key", "value");
        Assert.True(mux.IsConnected);
        // Container is disposed after this method
    }
}
```

### 3. ContainerFixture<> — Shared Within Class (Testcontainers.Xunit)

Creates a **single container shared across all tests in the class**. Faster; suitable for read-only or idempotent tests.

```csharp
[UsedImplicitly]
public sealed class RedisContainerFixture(IMessageSink messageSink)
    : ContainerFixture<RedisBuilder, RedisContainer>(messageSink)
{
    protected override RedisBuilder Configure()
    {
        return new RedisBuilder("redis:7.0");
    }
}

public sealed class RedisSharedTests(RedisContainerFixture fixture)
    : IClassFixture<RedisContainerFixture>
{
    [Fact]
    public async Task Test1()
    {
        using var mux = await ConnectionMultiplexer.ConnectAsync(fixture.Container.GetConnectionString());
        await mux.GetDatabase().StringSetAsync("key", "value");
    }

    [Fact]
    public async Task Test2()
    {
        using var mux = await ConnectionMultiplexer.ConnectAsync(fixture.Container.GetConnectionString());
        var value = await mux.GetDatabase().StringGetAsync("key");
        Assert.Equal("value", value); // Test1 ran first — value persists
    }
}
```

### 4. Assembly-Wide Shared Container (xUnit.net v3)

```csharp
// Apply to assembly — single container for all tests in the assembly
[assembly: AssemblyFixture(typeof(RedisContainerFixture))]

// In test class: inject via constructor or use TestContext
public sealed class AnotherRedisTest(RedisContainerFixture fixture) { ... }
// Or: var fixture = TestContext.Current.GetFixture<RedisContainerFixture>();
```

### 5. DbContainerTest / DbContainerFixture — ADO.NET Services

```csharp
public sealed class PostgresDbTests(ITestOutputHelper output)
    : DbContainerTest<PostgreSqlBuilder, PostgreSqlContainer>(output)
{
    protected override PostgreSqlBuilder Configure()
    {
        return new PostgreSqlBuilder("postgres:15.1")
            .WithResourceMapping("chinook.sql", "/docker-entrypoint-initdb.d/");
    }

    public override DbProviderFactory DbProviderFactory => NpgsqlFactory.Instance;

    [Fact]
    public async Task ShouldQueryAlbums()
    {
        const string sql = "SELECT title FROM album ORDER BY album_id LIMIT 1";
        using var connection = await OpenConnectionAsync();
        var title = await connection.QueryFirstAsync<string>(sql);
        Assert.Equal("For Those About To Rock We Salute You", title);
    }
}
```

## NUnit

```csharp
[TestFixture]
public sealed class CustomerTests
{
    private PostgreSqlContainer _postgres = null!;

    [OneTimeSetUp]  // Shared across all tests in the class
    public async Task SetUp()
    {
        _postgres = new PostgreSqlBuilder().WithImage("postgres:15.1").Build();
        await _postgres.StartAsync();
    }

    [OneTimeTearDown]
    public async Task TearDown()
    {
        await _postgres.DisposeAsync();
    }

    [Test]
    public void ShouldConnect()
    {
        Assert.IsNotNull(_postgres.GetConnectionString());
    }
}
```

Use `[SetUp]` / `[TearDown]` (instead of `OneTime*`) for per-test isolation (more expensive).

## MSTest

```csharp
[TestClass]
public sealed class CustomerTests
{
    private static PostgreSqlContainer _postgres = null!;

    [ClassInitialize]  // Shared across all tests in the class
    public static async Task ClassSetUp(TestContext _)
    {
        _postgres = new PostgreSqlBuilder().WithImage("postgres:15.1").Build();
        await _postgres.StartAsync();
    }

    [ClassCleanup]
    public static async Task ClassTearDown()
    {
        await _postgres.DisposeAsync();
    }

    [TestMethod]
    public void ShouldConnect()
    {
        Assert.IsNotNull(_postgres.GetConnectionString());
    }
}
```

Use `[TestInitialize]` / `[TestCleanup]` for per-test container isolation.

## Choosing Isolation Level

| Scope        | xUnit                                    | NUnit                | MSTest                           | When to use                            |
| ------------ | ---------------------------------------- | -------------------- | -------------------------------- | -------------------------------------- |
| Per-test     | `ContainerTest<>`                        | `[SetUp]/[TearDown]` | `[TestInitialize]/[TestCleanup]` | Destructive operations, state mutation |
| Per-class    | `IClassFixture<>` / `ContainerFixture<>` | `[OneTimeSetUp]`     | `[ClassInitialize]`              | Read-heavy, idempotent tests           |
| Per-assembly | `[AssemblyFixture]` (v3)                 | `[SetUpFixture]`     | n/a                              | Expensive global shared state          |

## Parallel Test Execution

Testcontainers is thread-safe. Multiple containers can start in parallel:

```csharp
// Start independent containers concurrently
await Task.WhenAll(
    _postgres.StartAsync(),
    _redis.StartAsync(),
    _rabbitmq.StartAsync()
);
```

When tests share a container, ensure the container state is either reset between tests or tests are written to be order-independent.
