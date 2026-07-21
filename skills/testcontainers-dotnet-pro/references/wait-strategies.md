# Wait Strategies

Wait strategies detect when a container's service is ready to accept connections. Chain strategies for complex readiness checks.

## Overview

```csharp
// Chain multiple strategies — all must pass
_ = Wait.ForUnixContainer()
    .UntilInternalTcpPortIsAvailable(8080)
    .UntilMessageIsLogged("Server started")
    .UntilHttpRequestIsSucceeded(r => r.ForPath("/health"));

// With timeout on a single strategy
_ = Wait.ForUnixContainer()
    .UntilMessageIsLogged("Ready", o => o.WithTimeout(TimeSpan.FromMinutes(2)));
```

Apply via `WithWaitStrategy()` on the builder:

```csharp
var container = new ContainerBuilder().WithImage("myapp:1.0")
    .WithWaitStrategy(Wait.ForUnixContainer().UntilHttpRequestIsSucceeded(r => r.ForPath("/health")))
    .Build();
```

## UntilHttpRequestIsSucceeded — HTTP(S) Endpoint

```csharp
// Wait for HTTP 200 on the container's default port 80
_ = Wait.ForUnixContainer()
    .UntilHttpRequestIsSucceeded(r => r.ForPath("/"));

// Wait on a specific port
_ = Wait.ForUnixContainer()
    .UntilHttpRequestIsSucceeded(r => r
        .ForPath("/health")
        .ForPort(8080));

// Accept multiple status codes
_ = Wait.ForUnixContainer()
    .UntilHttpRequestIsSucceeded(r => r
        .ForPath("/")
        .ForStatusCode(HttpStatusCode.OK)
        .ForStatusCode(HttpStatusCode.NoContent));

// Match a status code predicate
_ = Wait.ForUnixContainer()
    .UntilHttpRequestIsSucceeded(r => r
        .ForPath("/health")
        .ForStatusCodeMatching(sc => sc >= HttpStatusCode.OK && sc < HttpStatusCode.MultipleChoices));

// HTTPS endpoint
_ = Wait.ForUnixContainer()
    .UntilHttpRequestIsSucceeded(r => r
        .ForPath("/health")
        .UsingTls()
        .ForPort(8443));
```

## UntilInternalTcpPortIsAvailable vs UntilExternalTcpPortIsAvailable

```csharp
// Internal — checks from within the container (verifies the service is listening)
_ = Wait.ForUnixContainer()
    .UntilInternalTcpPortIsAvailable(5432);

// External — checks from the test host (verifies port mapping is established)
_ = Wait.ForUnixContainer()
    .UntilExternalTcpPortIsAvailable(5432);
```

Prefer `UntilInternalTcpPortIsAvailable` — it confirms the service inside the container is actually listening, not just that Docker's port mapping is ready.

## UntilMessageIsLogged — Log Message

```csharp
// Wait for a specific log line (regex supported)
_ = Wait.ForUnixContainer()
    .UntilMessageIsLogged("database system is ready to accept connections");

// With timeout
_ = Wait.ForUnixContainer()
    .UntilMessageIsLogged("Server started", o => o.WithTimeout(TimeSpan.FromMinutes(1)));
```

## UntilContainerIsHealthy — Docker HEALTHCHECK

```csharp
// Use the image's HEALTHCHECK directive
_ = new ContainerBuilder().WithImage("myapp:1.0")
    .WithWaitStrategy(Wait.ForUnixContainer().UntilContainerIsHealthy())
    .Build();
```

Requires the Docker image to define a `HEALTHCHECK` instruction. Good for images where you control the Dockerfile.

## UntilCommandIsCompleted — Shell Command

```csharp
// Wait until a command exits with code 0
_ = Wait.ForUnixContainer()
    .UntilCommandIsCompleted("pg_isready");

// Multiple arguments
_ = Wait.ForUnixContainer()
    .UntilCommandIsCompleted("redis-cli", "ping");
```

Used by most database modules internally (e.g., PostgreSQL uses `pg_isready`).

## UntilFileExists — File Presence

```csharp
_ = Wait.ForUnixContainer()
    .UntilFileExists("/tmp/ready");
```

## AddCustomWaitStrategy — Custom IWaitUntil

```csharp
public sealed class MyReadinessCheck : IWaitUntil
{
    public async Task<bool> UntilAsync(IContainer container)
    {
        var (stdout, _) = await container.GetLogsAsync();
        return stdout.Contains("READY");
    }
}

_ = Wait.ForUnixContainer()
    .AddCustomWaitStrategy(new MyReadinessCheck());
```

## WaitStrategyMode.OneShot — Containers That Exit

For migration containers or setup scripts that exit after completing:

```csharp
// BAD — throws ContainerNotRunningException when migration container exits normally
_ = Wait.ForUnixContainer()
    .UntilMessageIsLogged("Migration completed");

// GOOD — treat successful exit as ready
_ = Wait.ForUnixContainer()
    .UntilMessageIsLogged("Migration completed",
        o => o.WithMode(WaitStrategyMode.OneShot));
```

Without `OneShot`, Testcontainers throws `ContainerNotRunningException` if the container exits during the wait period — even with exit code 0.

## Configuring Retries, Interval, and Timeout

```csharp
_ = Wait.ForUnixContainer()
    .UntilHttpRequestIsSucceeded(r => r.ForPath("/health"),
        o => o
            .WithTimeout(TimeSpan.FromMinutes(2))
            .WithRetries(10)
            .WithInterval(TimeSpan.FromSeconds(3)));
```
