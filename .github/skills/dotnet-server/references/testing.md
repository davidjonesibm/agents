## Testing

### Integration Tests with `WebApplicationFactory`

```csharp
public class OrderApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public OrderApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetOrder_ReturnsOk_WhenExists()
    {
        var response = await _client.GetAsync("/api/orders/1");

        response.EnsureSuccessStatusCode();
        var order = await response.Content
            .ReadFromJsonAsync<OrderResponse>();
        Assert.NotNull(order);
        Assert.Equal(1, order.Id);
    }
}
```

### Custom `WebApplicationFactory` for test setup

```csharp
public class CustomFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace real DB with SQLite in-memory
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            if (descriptor is not null) services.Remove(descriptor);

            services.AddDbContext<AppDbContext>(options =>
                options.UseSqlite("DataSource=:memory:"));
        });

        builder.UseEnvironment("Testing");
    }
}
```

### Inject mock services in tests

```csharp
[Fact]
public async Task GetWeather_ReturnsMockedData()
{
    var client = _factory.WithWebHostBuilder(builder =>
    {
        builder.ConfigureTestServices(services =>
        {
            services.AddScoped<IWeatherService, FakeWeatherService>();
        });
    }).CreateClient();

    var response = await client.GetAsync("/weather");
    response.EnsureSuccessStatusCode();
}
```

### Mock authentication in tests

```csharp
public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new[] { new Claim(ClaimTypes.Name, "TestUser") };
        var identity = new ClaimsIdentity(claims, "TestScheme");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "TestScheme");
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

// In test
builder.ConfigureTestServices(services =>
{
    services.AddAuthentication("TestScheme")
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("TestScheme", _ => { });
});
```

### Unit testing best practices

- Separate unit tests from integration tests in different projects.
- Use `xUnit` (recommended) or `NUnit`. Follow the **Arrange-Act-Assert** pattern.
- Test business logic via unit tests; test endpoint behavior via integration tests with `WebApplicationFactory`.
- Use SQLite in-memory for integration test databases — prefer it over EF in-memory provider.
