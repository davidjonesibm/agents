# Best Practices and Anti-Patterns

Critical rules, performance tips, common pitfalls, and anti-patterns for Testcontainers for .NET.

## Critical Rules

### 1. Always Pin Image Versions

```csharp
// BAD — `latest` may introduce breaking changes silently
var container = new PostgreSqlBuilder().WithImage("postgres:latest").Build();

// GOOD — pinned version
var container = new PostgreSqlBuilder().WithImage("postgres:15.1").Build();
```

### 2. Always Use Random Host Ports

```csharp
// BAD — fixed port causes flaky tests in parallel and CI environments
_ = new ContainerBuilder().WithImage("nginx:1.26.3")
    .WithPortBinding(8080, 80)   // fixed host port 8080
    .Build();

// GOOD — random host port
var container = new ContainerBuilder().WithImage("nginx:1.26.3")
    .WithPortBinding(80, true)
    .Build();

var hostPort = container.GetMappedPublicPort(80);
```

### 3. Always Use container.Hostname

```csharp
// BAD — fails on remote Docker, Docker Desktop, and CI environments
var url = $"http://localhost:{container.GetMappedPublicPort(8080)}";

// GOOD
var url = $"http://{container.Hostname}:{container.GetMappedPublicPort(8080)}";
```

### 4. Always Dispose Containers

```csharp
// BAD — missing disposal leaks containers (Ryuk cleans up eventually, but not immediately)
var container = new PostgreSqlBuilder().Build();
await container.StartAsync();
// ... tests ... (no disposal)

// GOOD — explicit disposal via IAsyncLifetime or ContainerFixture<>
public Task DisposeAsync() => _container.DisposeAsync().AsTask();
```

### 5. Do Not Disable the Resource Reaper

```csharp
// BAD — containers accumulate if tests crash
TESTCONTAINERS_RYUK_DISABLED=true  // (in local dev or standard CI)

// GOOD — keep Ryuk enabled (default)
// Only disable in environments like Bitbucket Pipelines that forbid it
```

### 6. Use Network Aliases for Container-to-Container Communication

```csharp
// BAD — containers cannot reliably resolve each other via container.Hostname
var appContainer = new ContainerBuilder().WithImage("myapp:1.0")
    .WithEnvironment("DB_HOST", _dbContainer.Hostname)  // wrong for c2c
    .Build();

// GOOD — use network alias on a shared network
var appContainer = new ContainerBuilder().WithImage("myapp:1.0")
    .WithNetwork(_network)
    .WithEnvironment("DB_HOST", "db")  // "db" is the network alias of the DB container
    .Build();
```

### 7. Avoid Static Container Names

```csharp
// BAD — static name collides with existing containers and parallel test runs
_ = new ContainerBuilder().WithImage("redis:7.0").WithName("my-redis").Build();

// GOOD — random name (Docker default) or use ContainerFixture<>
_ = new ContainerBuilder().WithImage("redis:7.0").Build();  // no WithName call
```

### 8. Copy Files Instead of Bind-Mounting Host Paths

```csharp
// BAD — host path is not available on remote Docker or CI environments
_ = new ContainerBuilder().WithImage("alpine:3.20.0")
    .WithBindMount("/Users/dev/config", "/app/config")
    .Build();

// GOOD — copy with WithResourceMapping
_ = new ContainerBuilder().WithImage("alpine:3.20.0")
    .WithResourceMapping(
        FilePath.Of("config/appsettings.json"),
        DirectoryPath.Of("/app/config/"))
    .Build();
```

## Performance Tips

### Share Containers Across Tests (Not Per-Test)

```csharp
// SLOW — new container per test method (default IAsyncLifetime on test class = per-class, but per-test is worse)
// Each test creates and destroys a 3-second PostgreSQL startup

// FAST — share container across all tests in the class or assembly
public sealed class MyFixture(IMessageSink sink)
    : ContainerFixture<PostgreSqlBuilder, PostgreSqlContainer>(sink)
{
    protected override PostgreSqlBuilder Configure()
        => new PostgreSqlBuilder().WithImage("postgres:15.1");
}
```

### Start Containers in Parallel

```csharp
// SLOW — sequential startup
await _postgres.StartAsync();
await _redis.StartAsync();
await _rabbitmq.StartAsync();

// FAST — parallel startup
await Task.WhenAll(
    _postgres.StartAsync(),
    _redis.StartAsync(),
    _rabbitmq.StartAsync()
);
```

### Use Module-Specific Wait Strategies

Modules pre-configure the correct wait strategy. Avoid overriding unless necessary:

```csharp
// BAD — generic port wait is insufficient for PostgreSQL
_ = new ContainerBuilder().WithImage("postgres:15.1")
    .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(5432))
    .Build();

// GOOD — PostgreSqlBuilder uses pg_isready internally
var postgres = new PostgreSqlBuilder().WithImage("postgres:15.1").Build();
```

## Common Pitfalls

### Kafka Reuse Breaks After Port Change

Kafka embeds the bootstrap server address in its configuration on startup. Reusing a Kafka container after it has been stopped and restarted (which assigns a new port) will cause connection failures. Do not use `WithReuse(true)` with Kafka.

### Missing `await` on StartAsync

```csharp
// BAD — fire-and-forget start; container may not be ready
_container.StartAsync();

// GOOD
await _container.StartAsync();
```

### Wrong DisposeAsync Pattern

```csharp
// BAD — ValueTask not awaited (common C# mistake)
public Task DisposeAsync() => _container.DisposeAsync();   // missing .AsTask()

// GOOD
public Task DisposeAsync() => _container.DisposeAsync().AsTask();
// Or: public ValueTask DisposeAsync() => _container.DisposeAsync();
```

### Not Resetting State Between Tests in Shared Containers

When tests share a container, each test must leave the database in a known state:

```csharp
// GOOD — truncate tables or use transactions that roll back
[Fact]
public async Task TestWithCleanState()
{
    await using var connection = new NpgsqlConnection(_postgres.GetConnectionString());
    await connection.ExecuteAsync("TRUNCATE TABLE orders RESTART IDENTITY CASCADE");
    // now run the test
}
```

### Using localhost in Connection Strings with ConfigureWebHost

```csharp
// BAD — using localhost directly (fails with remote Docker)
builder.UseSetting("ConnectionStrings:Db", "Host=localhost;Port=5432;...");

// GOOD — build from container properties
builder.UseSetting(
    "ConnectionStrings:Db",
    $"Host={_postgres.Hostname};Port={_postgres.GetMappedPublicPort(5432)};...");
// OR: use the module's GetConnectionString() helper
builder.UseSetting("ConnectionStrings:Db", _postgres.GetConnectionString());
```
