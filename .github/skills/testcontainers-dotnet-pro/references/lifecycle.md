# Container Lifecycle

Container start/stop, disposal, IAsyncLifetime, shared instances, Resource Reaper, and Resource Reuse.

## Container Lifecycle Methods

| Method                      | Purpose                                                    |
| --------------------------- | ---------------------------------------------------------- |
| `StartAsync()`              | Pulls image (if needed), creates, and starts the container |
| `StopAsync()`               | Stops the running container (does not remove it)           |
| `DisposeAsync()`            | Stops and removes the container                            |
| `GetLogsAsync()`            | Returns `(stdout, stderr)` tuple                           |
| `ExecAsync(string[])`       | Runs a command inside a running container                  |
| `CopyAsync(byte[], string)` | Copies bytes to a path inside a running container          |
| `ReadFileAsync(string)`     | Reads a file from inside the container                     |

## IAsyncLifetime — Manual Lifecycle (xUnit)

Use `IAsyncLifetime` when using the generic container API directly with xUnit without the `Testcontainers.Xunit` helpers:

```csharp
// BAD — starting/stopping in constructor/finalizer (sync, unreliable)
public class MyTests
{
    private readonly PostgreSqlContainer _postgres;
    public MyTests() { _postgres = new PostgreSqlBuilder().Build(); _postgres.StartAsync().Wait(); }
    ~MyTests() { _postgres.DisposeAsync().AsTask().Wait(); }
}

// GOOD — IAsyncLifetime for proper async start/stop per-class
public sealed class CustomerServiceTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:15.1")
        .Build();

    public Task InitializeAsync() => _postgres.StartAsync();
    public Task DisposeAsync() => _postgres.DisposeAsync().AsTask();

    [Fact]
    public void ShouldWork()
    {
        var cs = _postgres.GetConnectionString();
        // ...
    }
}
```

A new container is started before each test class and disposed after all tests in the class complete.

## Sharing Containers Across Tests

Starting containers is expensive. Share them using `IClassFixture<T>`:

```csharp
// Per-class shared container with IClassFixture
public sealed class PostgresFixture : IAsyncLifetime
{
    public PostgreSqlContainer Container { get; } = new PostgreSqlBuilder()
        .WithImage("postgres:15.1")
        .Build();

    public Task InitializeAsync() => Container.StartAsync();
    public Task DisposeAsync() => Container.DisposeAsync().AsTask();
}

public sealed class MyTests : IClassFixture<PostgresFixture>
{
    private readonly PostgreSqlContainer _postgres;

    public MyTests(PostgresFixture fixture)
    {
        _postgres = fixture.Container;
    }
}
```

Prefer `Testcontainers.Xunit` `ContainerFixture<>` for less boilerplate (see `references/test-frameworks.md`).

## CancellationToken for Start Timeout

```csharp
// Cancel container start after 2 minutes
using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
await container.StartAsync(cts.Token);
```

## WithAutoRemove vs WithCleanUp

```csharp
// WithAutoRemove — Docker removes the container immediately when it stops (--rm equivalent)
_ = new ContainerBuilder().WithImage("alpine:3.20.0")
    .WithAutoRemove(true)
    .Build();

// WithCleanUp — Testcontainers removes the container after all tests complete
_ = new ContainerBuilder().WithImage("alpine:3.20.0")
    .WithCleanUp(true)
    .Build();
```

`WithAutoRemove` is aggressive — the container disappears as soon as it stops, even on failure. Prefer `WithCleanUp(true)` or rely on the Resource Reaper.

## Resource Reaper (Ryuk)

Testcontainers runs a `testcontainers/ryuk:0.14.0` sidecar container that automatically removes all test containers after the test process exits — even if the process crashes.

```
# BAD — disable Ryuk only when you have guaranteed external cleanup
TESTCONTAINERS_RYUK_DISABLED=true

# GOOD — leave enabled (default). For private registries, mirror the image:
TESTCONTAINERS_RYUK_CONTAINER_IMAGE=registry.example.com/testcontainers/ryuk:0.14.0
```

Never disable Ryuk in developer environments or standard CI pipelines (see `references/cicd.md` for Bitbucket exception).

## Resource Reuse (Experimental)

Reuse skips creating a new container if one matching the configuration hash already exists:

```csharp
// Enable reuse — container persists after test run and is reused next time
_ = new ContainerBuilder().WithImage("alpine:3.20.0")
    .WithReuse(true)
    .WithLabel("reuse-id", "my-service")  // prevent hash collisions
    .Build();

// For networks, set a fixed name (default random name breaks hash)
_ = new NetworkBuilder()
    .WithReuse(true)
    .WithName("my-test-network")
    .Build();
```

**Caution:** Reuse disables the Resource Reaper. The container will not be cleaned up automatically. Use only in local development — never in CI. Does not replace proper shared instance patterns (see `references/test-frameworks.md`).

## Getting Container Logs

```csharp
// After a failed test, retrieve logs for debugging
var (stdout, stderr) = await _container.GetLogsAsync();

// Real-time log forwarding during container lifetime
using IOutputConsumer outputConsumer = Consume.RedirectStdoutAndStderrToConsole();
_ = new ContainerBuilder().WithImage("alpine:3.20.0")
    .WithOutputConsumer(outputConsumer)
    .Build();
```
