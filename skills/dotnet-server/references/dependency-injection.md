## Dependency Injection

- Use the correct service lifetime:
  - **Transient** — new instance each time. Use for lightweight, stateless services.
  - **Scoped** — one instance per request. Use for DbContext, unit-of-work services.
  - **Singleton** — one instance for the app lifetime. Use for caches, configuration wrappers.

- Register services using interfaces for testability:

  ```csharp
  // Before
  builder.Services.AddScoped<OrderService>();

  // After
  builder.Services.AddScoped<IOrderService, OrderService>();
  ```

- Use primary constructors (C# 12) for constructor injection:

  ```csharp
  // Before
  public class OrderService
  {
      private readonly IOrderRepository _repo;
      public OrderService(IOrderRepository repo) { _repo = repo; }
  }

  // After
  public class OrderService(IOrderRepository repo) : IOrderService
  {
      public async Task<Order?> GetAsync(int id) => await repo.FindAsync(id);
  }
  ```

- Use keyed services (.NET 8+) when you have multiple implementations of the same interface:

  ```csharp
  builder.Services.AddKeyedSingleton<ICache, RedisCache>("redis");
  builder.Services.AddKeyedSingleton<ICache, MemoryCache>("memory");

  app.MapGet("/data", ([FromKeyedServices("redis")] ICache cache) =>
      cache.Get("key"));
  ```

- Never resolve scoped services from a singleton — this causes scoped services to act as singletons. The DI container throws at runtime in Development when scope validation is enabled.

- Group related service registrations into extension methods:

  ```csharp
  public static class ServiceCollectionExtensions
  {
      public static IServiceCollection AddOrderServices(this IServiceCollection services)
      {
          services.AddScoped<IOrderService, OrderService>();
          services.AddScoped<IOrderRepository, OrderRepository>();
          return services;
      }
  }

  // Program.cs
  builder.Services.AddOrderServices();
  ```

- Avoid the **service locator** pattern — prefer constructor injection over `GetService<T>()`:

  ```csharp
  // Before (anti-pattern)
  public class MyService(IServiceProvider sp)
  {
      public void DoWork()
      {
          var dep = sp.GetRequiredService<IDependency>();
      }
  }

  // After
  public class MyService(IDependency dep)
  {
      public void DoWork() { dep.Execute(); }
  }
  ```

## Configuration & Options Pattern

- Use the **Options pattern** to bind config sections to strongly-typed classes:

  ```csharp
  public class SmtpSettings
  {
      public const string SectionName = "Smtp";
      public required string Host { get; init; }
      public int Port { get; init; } = 587;
      public required string Username { get; init; }
  }

  // Program.cs
  builder.Services.Configure<SmtpSettings>(
      builder.Configuration.GetSection(SmtpSettings.SectionName));

  // Injection
  public class EmailService(IOptions<SmtpSettings> options)
  {
      private readonly SmtpSettings _settings = options.Value;
  }
  ```

- Use `IOptionsSnapshot<T>` when you need config values that update at runtime (scoped, re-reads on each request).

- Use `IOptionsMonitor<T>` in singletons to receive change notifications.

- Validate options at startup using Data Annotations:

  ```csharp
  builder.Services
      .AddOptions<SmtpSettings>()
      .Bind(builder.Configuration.GetSection(SmtpSettings.SectionName))
      .ValidateDataAnnotations()
      .ValidateOnStart();
  ```

- Never store secrets in `appsettings.json`. Use User Secrets in development, environment variables or Azure Key Vault in production.

- Configuration priority (highest to lowest by default): command-line args → environment variables → User Secrets (Development) → `appsettings.{Environment}.json` → `appsettings.json`.
