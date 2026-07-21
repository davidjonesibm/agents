## Logging & Observability

- Use `ILogger<T>` — never `Console.WriteLine`:

  ```csharp
  public class OrderService(ILogger<OrderService> logger, IOrderRepository repo)
  {
      public async Task<Order?> GetAsync(int id)
      {
          logger.LogDebug("Fetching order {OrderId}", id);
          return await repo.FindAsync(id);
      }
  }
  ```

- Use **structured logging** with message templates (not string interpolation):

  ```csharp
  // Before (allocates string even if log level is off)
  logger.LogInformation($"Order {order.Id} created for {order.CustomerName}");

  // After (structured, deferred formatting)
  logger.LogInformation("Order {OrderId} created for {CustomerName}",
      order.Id, order.CustomerName);
  ```

- Use **high-performance logging** with `LoggerMessage.Define` or source generators for hot paths:

  ```csharp
  public static partial class LogMessages
  {
      [LoggerMessage(Level = LogLevel.Information,
          Message = "Order {OrderId} created for {CustomerName}")]
      public static partial void OrderCreated(
          ILogger logger, int orderId, string customerName);
  }
  ```

- Add **health checks** for database, external services, and readiness probes:

  ```csharp
  builder.Services.AddHealthChecks()
      .AddDbContextCheck<AppDbContext>()
      .AddUrlGroup(new Uri("https://external-api.example.com/health"), "external-api");

  app.MapHealthChecks("/health/ready", new HealthCheckOptions
  {
      Predicate = check => check.Tags.Contains("ready")
  });
  app.MapHealthChecks("/health/live", new HealthCheckOptions
  {
      Predicate = _ => false // just checks if app responds
  });
  ```

- Configure **OpenAPI/Swagger** for API documentation:

  ```csharp
  builder.Services.AddEndpointsApiExplorer();
  builder.Services.AddSwaggerGen();

  if (app.Environment.IsDevelopment())
  {
      app.UseSwagger();
      app.UseSwaggerUI();
  }
  ```
