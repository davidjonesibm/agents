# ASP.NET Core Integration

WebApplicationFactory-based in-process testing with Testcontainers. Covers connection string injection, multi-container orchestration, and in-process vs out-of-process patterns.

## Pattern 1 — ConfigureWebHost (Simple)

Start the container in `IAsyncLifetime.InitializeAsync`, then inject the connection string into the ASP.NET Core configuration before the TestServer is created:

```csharp
public sealed class ApiTests : IAsyncLifetime
{
    private readonly RedisContainer _redis = new RedisBuilder()
        .WithImage("redis:7.0")
        .Build();

    private WebApplicationFactory<Program> _factory = null!;

    public async Task InitializeAsync()
    {
        await _redis.StartAsync();

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting(
                    "ConnectionStrings:RedisCache",
                    _redis.GetConnectionString());
            });
    }

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        await _redis.DisposeAsync();
    }

    [Fact]
    public async Task GetWeather_ReturnsOk()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/weather");
        response.EnsureSuccessStatusCode();
    }
}
```

## Pattern 2 — IConfigurationSource (Auto-Start)

Encapsulate both the container and its configuration in a custom `IConfigurationSource`:

```csharp
private sealed class RedisConfigurationSource : IConfigurationSource
{
    private readonly RedisContainer _redis = new RedisBuilder()
        .WithImage("redis:7.0")
        .Build();

    public IConfigurationProvider Build(IConfigurationBuilder builder)
        => new RedisConfigurationProvider(_redis);
}

private sealed class RedisConfigurationProvider : ConfigurationProvider
{
    private readonly RedisContainer _redis;

    public RedisConfigurationProvider(RedisContainer redis)
        => _redis = redis;

    public override void Load()
    {
        // Container starts here, before TestServer is created
        _redis.StartAsync().GetAwaiter().GetResult();
        Data["ConnectionStrings:RedisCache"] = _redis.GetConnectionString();
    }
}

private sealed class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration(config =>
            config.Add(new RedisConfigurationSource()));
    }
}
```

## Multi-Container Application (WeatherForecast Pattern)

```csharp
public sealed class WeatherForecastFixture : IAsyncLifetime
{
    private const string DbAlias = "weatherForecastStorage";

    private readonly INetwork _network = new NetworkBuilder().Build();

    private readonly MsSqlContainer _db = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-CU14-ubuntu-22.04")
        .WithNetwork(new NetworkBuilder().Build())    // replaced below
        .WithNetworkAliases(DbAlias)
        .Build();

    private readonly IContainer _app;

    public WeatherForecastFixture()
    {
        var connectionString =
            $"server={DbAlias};user id={MsSqlBuilder.DefaultUsername};" +
            $"password={MsSqlBuilder.DefaultPassword};database={MsSqlBuilder.DefaultDatabase}";

        _app = new ContainerBuilder().WithImage("weatherforecast:latest")
            .WithNetwork(_network)
            .WithPortBinding(443, true)
            .WithEnvironment("ASPNETCORE_URLS", "https://+")
            .WithEnvironment("ConnectionStrings__DefaultConnection", connectionString)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(443))
            .Build();
    }

    public async Task InitializeAsync()
    {
        await _network.CreateAsync();
        await _db.StartAsync();
        await _app.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _app.DisposeAsync();
        await _db.DisposeAsync();
        await _network.DisposeAsync();
    }

    public Uri BaseAddress =>
        new UriBuilder("https", _app.Hostname, _app.GetMappedPublicPort(443)).Uri;
}
```

## In-Process vs Out-of-Process Testing

| Approach                                                     | Setup                                                      | Speed                          | Coverage                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------ | -------------------------------------------------------- |
| **In-process** (`WebApplicationFactory`)                     | Inject container connection string into test server config | Fast — no HTTP overhead        | Tests routing, middleware, and business logic            |
| **Out-of-process** (build a Docker image, run app container) | Build app image; use Testcontainers to run it              | Slower — full Docker lifecycle | Tests the actual Docker image; catches deployment issues |

**Prefer in-process** (`WebApplicationFactory`) for most integration tests — faster feedback, easier debugging.

Use out-of-process when you need to test:

- The production Docker image itself
- Container startup, environment variable handling, or health checks
- Multi-container orchestration between services

## DependsOn — Ordered Resource Creation

```csharp
// Ensure the network and DB container are started before the app container
var appContainer = new ContainerBuilder().WithImage("myapp:1.0")
    .DependsOn(_network)
    .DependsOn(_db)
    .Build();

await appContainer.StartAsync();  // network + db start automatically first
```

> **See also:** `references/test-frameworks.md` — `ContainerFixture<>`, `IClassFixture<T>`, and xUnit/NUnit/MSTest lifecycle integration.
