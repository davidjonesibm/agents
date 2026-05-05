# Setup and Installation

Installation, package structure, NuGet dependencies, and Docker requirements for Testcontainers for .NET 4.x.

## NuGet Packages

Install the base package for generic container support:

```shell
dotnet add package Testcontainers
```

For pre-configured modules, install the module-specific package instead — it pulls in `Testcontainers` as a transitive dependency:

```shell
dotnet add package Testcontainers.PostgreSql
dotnet add package Testcontainers.MsSql
dotnet add package Testcontainers.Redis
dotnet add package Testcontainers.RabbitMq
dotnet add package Testcontainers.Kafka
dotnet add package Testcontainers.MongoDb
dotnet add package Testcontainers.Elasticsearch
dotnet add package Testcontainers.MySql
dotnet add package Testcontainers.Xunit      # xUnit.net v2 helpers
dotnet add package Testcontainers.XunitV3   # xUnit.net v3 helpers
```

Only add test project dependencies — never add Testcontainers to production projects.

## Docker Requirements

- Docker Desktop (Windows/macOS), Podman with Docker-compatible socket, Rancher Desktop, or remote Docker.
- Linux containers are supported on all platforms. Windows native containers are only supported on Windows and require OS version compatibility.
- Testcontainers auto-detects the Docker host and registry credentials — no explicit configuration needed for standard setups.

## Hello World — Minimal Generic Container

```csharp
// BAD — no wait strategy, container may not be ready
var container = new ContainerBuilder().WithImage("testcontainers/helloworld:1.3.0")
    .WithPortBinding(8080, true)
    .Build();
await container.StartAsync();

// GOOD — wait until the HTTP endpoint is ready
var container = new ContainerBuilder().WithImage("testcontainers/helloworld:1.3.0")
    .WithPortBinding(8080, true)
    .WithWaitStrategy(Wait.ForUnixContainer()
        .UntilHttpRequestIsSucceeded(r => r.ForPort(8080)))
    .Build();
await container.StartAsync();

var requestUri = new UriBuilder("http", container.Hostname, container.GetMappedPublicPort(8080)).Uri;
```

## Minimal Module Example (PostgreSQL)

```csharp
// BAD — generic container for PostgreSQL (more config, easy to get wrong)
var container = new ContainerBuilder().WithImage("postgres:15.1")
    .WithEnvironment("POSTGRES_PASSWORD", "password")
    .WithPortBinding(5432, true)
    .Build();

// GOOD — use the pre-configured module
var container = new PostgreSqlBuilder()
    .WithImage("postgres:15.1")
    .Build();
await container.StartAsync();

var connectionString = container.GetConnectionString();
```

## .csproj Reference

```xml
<!-- Test project only -->
<PackageReference Include="Testcontainers.PostgreSql" Version="4.11.0" />
<PackageReference Include="Testcontainers.Xunit" Version="4.11.0" />
```

Always pin versions in `.csproj`. Avoid floating version ranges (`*`, `4.*`) in test projects.

> **See also:** `references/lifecycle.md` — container disposal patterns (IAsyncLifetime, WithCleanUp, Resource Reaper).
