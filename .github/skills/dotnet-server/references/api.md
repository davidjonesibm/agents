## Project Structure

- Use a single `Program.cs` entry point (top-level statements). Do not use `Startup.cs`.

  ```csharp
  // Before (legacy)
  public class Startup
  {
      public void ConfigureServices(IServiceCollection services) { }
      public void Configure(IApplicationBuilder app) { }
  }

  // After (.NET 8+)
  var builder = WebApplication.CreateBuilder(args);
  // register services on builder.Services
  var app = builder.Build();
  // configure middleware pipeline
  app.Run();
  ```

- Organize code by feature, not by technical layer. Prefer folders like `Features/Orders/` containing endpoints, models, and services together over `Controllers/`, `Models/`, `Services/` flat folders.

- For larger projects, group related endpoints using **static classes** or **extension methods**:

  ```csharp
  // Before — all routes in Program.cs
  app.MapGet("/api/orders", GetOrders);
  app.MapGet("/api/orders/{id}", GetOrder);
  app.MapPost("/api/orders", CreateOrder);

  // After — grouped in an extension method
  public static class OrderEndpoints
  {
      public static void MapOrderEndpoints(this WebApplication app)
      {
          var group = app.MapGroup("/api/orders");
          group.MapGet("/", GetOrders);
          group.MapGet("/{id:int}", GetOrder);
          group.MapPost("/", CreateOrder);
      }
  }

  // Program.cs
  app.MapOrderEndpoints();
  ```

- Set standard project properties:

  ```xml
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  ```

## API Patterns

### Minimal APIs (recommended for new projects)

- Prefer minimal APIs for new projects — less boilerplate, better performance.

  ```csharp
  var builder = WebApplication.CreateBuilder(args);
  var app = builder.Build();

  app.MapGet("/users/{id:int}", (int id) =>
      id <= 0 ? Results.BadRequest() : Results.Ok(new User(id)));

  app.Run();

  public record User(int Id);
  ```

- Use `TypedResults` instead of `Results` for better OpenAPI metadata and testability:

  ```csharp
  // Before
  app.MapGet("/users/{id:int}", (int id) =>
      id <= 0 ? Results.NotFound() : Results.Ok(new User(id)));

  // After
  app.MapGet("/users/{id:int}", (int id) =>
      id <= 0 ? TypedResults.NotFound() : TypedResults.Ok(new User(id)));
  ```

- Use route groups with `MapGroup` to share prefixes, filters, and metadata:

  ```csharp
  var api = app.MapGroup("/api/v1")
      .RequireAuthorization()
      .AddEndpointFilter<ValidationFilter>();

  api.MapGet("/products", GetProducts);
  api.MapPost("/products", CreateProduct);
  ```

- Use endpoint filters (not middleware) for cross-cutting concerns scoped to specific endpoints:

  ```csharp
  app.MapPost("/orders", CreateOrder)
      .AddEndpointFilter(async (context, next) =>
      {
          var order = context.GetArgument<CreateOrderRequest>(0);
          if (string.IsNullOrEmpty(order.CustomerName))
              return TypedResults.BadRequest("CustomerName is required");
          return await next(context);
      });
  ```

### Controller-based APIs

- Use controllers when you need model binding extensibility, `IModelBinder`, `JsonPatch`, or `OData`.

- Always apply `[ApiController]` to get automatic model validation, binding source inference, and Problem Details responses:

  ```csharp
  [ApiController]
  [Route("api/[controller]")]
  public class OrdersController : ControllerBase
  {
      [HttpGet("{id:int}")]
      public async Task<ActionResult<OrderResponse>> GetOrder(int id)
      {
          var order = await _orderService.GetAsync(id);
          return order is null ? NotFound() : Ok(order);
      }
  }
  ```

- Never inherit from `Controller` for API controllers — use `ControllerBase` (which excludes View support).

## Middleware Pipeline

- Order is critical. Follow this sequence:

  ```csharp
  var app = builder.Build();

  // 1. Exception/error handling (first!)
  if (app.Environment.IsDevelopment())
      app.UseDeveloperExceptionPage();
  else
      app.UseExceptionHandler("/error");

  // 2. HSTS (production only)
  app.UseHsts();

  // 3. HTTPS redirection
  app.UseHttpsRedirection();

  // 4. Static files (short-circuits for static assets)
  app.UseStaticFiles();

  // 5. Routing
  app.UseRouting();

  // 6. CORS (must be before auth and response caching)
  app.UseCors();

  // 7. Authentication
  app.UseAuthentication();

  // 8. Authorization
  app.UseAuthorization();

  // 9. Custom middleware here

  // 10. Endpoints
  app.MapControllers();

  app.Run();
  ```

- Never call `next()` after writing to the response body — this causes protocol violations.

- Check `HttpResponse.HasStarted` before modifying headers:

  ```csharp
  // Before (throws if response started)
  app.Use(async (context, next) =>
  {
      await next();
      context.Response.Headers["X-Custom"] = "value";
  });

  // After
  app.Use(async (context, next) =>
  {
      context.Response.OnStarting(() =>
      {
          context.Response.Headers["X-Custom"] = "value";
          return Task.CompletedTask;
      });
      await next();
  });
  ```

- Forwarded Headers Middleware must run before other middleware that depends on scheme, host, or client IP:

  ```csharp
  app.UseForwardedHeaders(); // before UseHttpsRedirection
  app.UseHttpsRedirection();
  ```
