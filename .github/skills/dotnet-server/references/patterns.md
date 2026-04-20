## Modern C# Patterns

### Nullable Reference Types

- Enable nullable reference types project-wide. Use `?` for nullable, and guard against null:

  ```csharp
  // Use nullability in return types
  public async Task<Order?> FindAsync(int id) =>
      await context.Orders.FindAsync(id);

  // Guard at API boundaries
  app.MapGet("/orders/{id}", async (int id, IOrderService svc) =>
  {
      var order = await svc.FindAsync(id);
      return order is null ? TypedResults.NotFound() : TypedResults.Ok(order);
  });
  ```

### Record Types

- Use `record` for DTOs, request/response models, and value objects:

  ```csharp
  // Immutable DTO — equals by value, built-in ToString
  public record CreateOrderRequest(string CustomerName, List<OrderItem> Items);
  public record OrderResponse(int Id, decimal Total, string Status);
  public record OrderItem(int ProductId, int Quantity);
  ```

### Pattern Matching

- Use pattern matching for cleaner conditionals:

  ```csharp
  // Before
  if (result == null) return NotFound();
  if (result.Status == "cancelled") return BadRequest("Order was cancelled");

  // After
  return result switch
  {
      null => TypedResults.NotFound(),
      { Status: "cancelled" } => TypedResults.BadRequest("Order was cancelled"),
      _ => TypedResults.Ok(result)
  };
  ```

### Global Usings

- Use `global using` for frequently imported namespaces to reduce boilerplate:

  ```csharp
  // GlobalUsings.cs
  global using Microsoft.EntityFrameworkCore;
  global using Microsoft.AspNetCore.Http.HttpResults;
  ```

## JSON Serialization

- Use `System.Text.Json` (the default). Configure globally:

  ```csharp
  builder.Services.ConfigureHttpJsonOptions(options =>
  {
      options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
      options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
      options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
  });
  ```

- Use source generation for AOT-compatible, high-performance serialization:

  ```csharp
  [JsonSerializable(typeof(OrderResponse))]
  [JsonSerializable(typeof(List<OrderResponse>))]
  public partial class AppJsonContext : JsonSerializerContext { }

  // Configure
  builder.Services.ConfigureHttpJsonOptions(options =>
  {
      options.SerializerOptions.TypeInfoResolverChain.Insert(0,
          AppJsonContext.Default);
  });
  ```

- Never use `Newtonsoft.Json` unless you need `JsonPatch`, polymorphic deserialization of unknown types, or another feature not in `System.Text.Json`.
