## Security Checklist

- Enable HTTPS and HSTS in production.
- Validate all user input — never trust client data.
- Use parameterized queries (EF Core does this by default) — never concatenate SQL.
- Set `Content-Security-Policy`, `X-Content-Type-Options`, and `X-Frame-Options` headers.
- Use anti-forgery tokens for form-based endpoints.
- Never expose stack traces or internal error details in production.
- Rotate secrets and use short-lived tokens.
- Use rate limiting middleware for public APIs:

  ```csharp
  builder.Services.AddRateLimiter(options =>
  {
      options.AddFixedWindowLimiter("api", opt =>
      {
          opt.Window = TimeSpan.FromMinutes(1);
          opt.PermitLimit = 100;
          opt.QueueLimit = 0;
      });
  });

  app.UseRateLimiter();

  app.MapGet("/api/data", GetData).RequireRateLimiting("api");
  ```

## Hosting & Deployment

### Kestrel Configuration

```csharp
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10 MB
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
    options.AddServerHeader = false; // hide Server header
});
```

### Docker

```dockerfile
# Multi-stage build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

- Use non-root users in Docker containers.
- Set `ASPNETCORE_URLS` via environment, not hardcoded.
- Use `.dockerignore` to exclude `bin/`, `obj/`, `.git/`.

### General Deployment

- Always use HTTPS in production — configure HSTS.
- Set `ASPNETCORE_ENVIRONMENT` to `Production` in production deployments.
- Configure `AddServerHeader = false` on Kestrel to avoid exposing server info.
- Use forwarded headers middleware behind reverse proxies (nginx, Azure App Gateway).

## Common Anti-Patterns

| Anti-Pattern                            | Fix                                                  |
| --------------------------------------- | ---------------------------------------------------- |
| `new HttpClient()` in a loop            | Use `IHttpClientFactory`                             |
| `Task.Result` or `.Wait()`              | Use `await`                                          |
| Exposing EF entities as API responses   | Project to DTOs with `.Select()`                     |
| `Console.WriteLine` for logging         | Use `ILogger<T>`                                     |
| Catching `Exception` and swallowing it  | Log and re-throw or return error                     |
| Storing secrets in `appsettings.json`   | Use User Secrets / env vars / Key Vault              |
| Missing `CancellationToken` propagation | Pass `CancellationToken` through async chains        |
| Using `async void`                      | Use `async Task`                                     |
| DbContext in background threads         | Use `IDbContextFactory<T>` or `IServiceScopeFactory` |
| String interpolation in log messages    | Use message templates with `ILogger`                 |
