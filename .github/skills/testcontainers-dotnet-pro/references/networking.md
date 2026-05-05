# Networking

Port binding, container hostname, custom Docker networks, container-to-container communication, and host exposure.

## Accessing a Container from the Test Host

```csharp
// BAD — hardcoded address, fails in CI and Docker Desktop environments
var connectionString = "Server=localhost,1433;...";
var url = "http://localhost:8080/api";

// GOOD — use container.Hostname and GetMappedPublicPort
var cs = new SqlConnectionStringBuilder
{
    DataSource = $"{_container.Hostname},{_container.GetMappedPublicPort(1433)}",
    // ...
}.ConnectionString;

var url = new UriBuilder("http", _container.Hostname, _container.GetMappedPublicPort(8080)).Uri;
```

`container.Hostname` resolves correctly in all environments (local Docker, Docker Desktop, remote Docker host, Testcontainers Cloud).

## Port Binding

```csharp
// BAD — fixed host port (causes conflicts across parallel tests)
_ = new ContainerBuilder().WithImage("nginx:1.26.3-alpine3.20")
    .WithPortBinding(8080, 80)   // host:container — dangerous
    .Build();

// GOOD — random host port
var container = new ContainerBuilder().WithImage("nginx:1.26.3-alpine3.20")
    .WithPortBinding(80, true)   // true = assign random host port
    .Build();

await container.StartAsync();
var hostPort = container.GetMappedPublicPort(80);
```

## Custom Networks (Container-to-Container Communication)

When multiple containers must communicate with each other, place them on a shared Docker network. Use network aliases as hostnames — do not use `container.Hostname` for container-to-container URLs.

```csharp
// BAD — exposing database port to host and connecting via host port
var dbContainer = new PostgreSqlBuilder()
    .WithPortBinding(5432, true)
    .Build();
// Then using container.Hostname from app container — wrong

// GOOD — shared network with network alias
var network = new NetworkBuilder()
    .WithName(Guid.NewGuid().ToString("D"))
    .Build();

var dbContainer = new PostgreSqlBuilder()
    .WithImage("postgres:15.1")
    .WithNetwork(network)
    .WithNetworkAliases("db")
    .Build();

var appContainer = new ContainerBuilder().WithImage("myapp:1.0")
    .WithNetwork(network)
    .WithEnvironment("ConnectionStrings__Default", "Host=db;Port=5432;...")
    // ↑ uses the network alias "db", not container.Hostname
    .Build();

await network.CreateAsync();
await Task.WhenAll(dbContainer.StartAsync(), appContainer.StartAsync());
```

## Connecting a Running Container to a Network

```csharp
var network = new NetworkBuilder().WithName("existing-net").Build();
await network.CreateAsync();

var container = new ContainerBuilder().WithImage("alpine:3.20.0").WithEntrypoint("top").Build();
await container.StartAsync();

// Attach after start
await container.ConnectAsync(network);
// Or by name only:
await container.ConnectAsync("existing-net");
```

Prefer `WithNetwork(...)` during builder configuration when possible. Use `ConnectAsync` only when the network or container already exists.

## Exposing Host Ports to Containers

When a containerized service needs to call back to the test host (e.g., a webhook receiver):

```csharp
// Configure BEFORE creating any containers
await TestcontainersSettings.ExposeHostPortsAsync(8080);

// From inside any container, the test host is reachable at:
// host.testcontainers.internal:8080
var execResult = await container.ExecAsync(
    new[] { "curl", "http://host.testcontainers.internal:8080/webhook" });
```

## NetworkBuilder Supported Commands

| Builder Method                     | Effect                                        |
| ---------------------------------- | --------------------------------------------- |
| `WithName(string)`                 | Set a fixed network name (required for reuse) |
| `WithDriver(string)`               | Network driver (`bridge`, `overlay`, etc.)    |
| `WithOption(string, string)`       | Driver-specific option                        |
| `WithLabel(string, string)`        | Metadata label                                |
| `WithCleanUp(bool)`                | Remove network after all tests                |
| `WithCreateParameterModifier(...)` | Low-level Docker API access                   |

> **See also:** `references/wait-strategies.md` — wait strategies for ensuring containers are ready before tests run.
