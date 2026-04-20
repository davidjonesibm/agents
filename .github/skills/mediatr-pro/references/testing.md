# Testing MediatR

Patterns for unit testing handlers, pipeline behaviors, and integration testing the full pipeline.

## Testing Handlers

- Test handlers in isolation by instantiating them directly with mocked dependencies. Do not use `IMediator` to invoke handlers in unit tests — call `Handle` directly.

  ```csharp
  // Before — using the mediator pipeline in a unit test
  [Fact]
  public async Task GetOrder_ReturnsOrder()
  {
      var services = new ServiceCollection();
      services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(GetOrderHandler).Assembly));
      var provider = services.BuildServiceProvider();
      var mediator = provider.GetRequiredService<IMediator>();

      var result = await mediator.Send(new GetOrderQuery(1));
      Assert.NotNull(result);
  }

  // After — direct handler instantiation
  [Fact]
  public async Task GetOrder_ReturnsOrder()
  {
      var repository = Substitute.For<IOrderRepository>();
      repository.GetByIdAsync(1, Arg.Any<CancellationToken>())
          .Returns(new Order { Id = 1, Status = "Active" });

      var handler = new GetOrderHandler(repository);

      var result = await handler.Handle(new GetOrderQuery(1), CancellationToken.None);

      Assert.NotNull(result);
      Assert.Equal(1, result.Id);
  }
  ```

  **Why:** Unit tests should isolate the handler logic. Using the full mediator pipeline adds behaviors, DI setup complexity, and makes tests slower and more brittle.

## Testing Behaviors

- Test behaviors by calling `Handle` with a mock `RequestHandlerDelegate<TResponse>` (the `next` delegate).

  ```csharp
  [Fact]
  public async Task ValidationBehavior_WithInvalidRequest_ThrowsValidationException()
  {
      var validator = new CreateOrderCommandValidator();
      var behavior = new ValidationBehavior<CreateOrderCommand, int>(new[] { validator });

      var invalidRequest = new CreateOrderCommand(Items: new List<OrderItem>());  // empty items

      await Assert.ThrowsAsync<ValidationException>(() =>
          behavior.Handle(
              invalidRequest,
              () => Task.FromResult(42),   // next delegate — should not be reached
              CancellationToken.None));
  }

  [Fact]
  public async Task ValidationBehavior_WithValidRequest_CallsNext()
  {
      var validator = new CreateOrderCommandValidator();
      var behavior = new ValidationBehavior<CreateOrderCommand, int>(new[] { validator });

      var validRequest = new CreateOrderCommand(Items: new List<OrderItem> { new("Widget", 1, 9.99m) });

      var result = await behavior.Handle(
          validRequest,
          () => Task.FromResult(42),
          CancellationToken.None);

      Assert.Equal(42, result);
  }
  ```

- Test that the `next` delegate is called exactly once in pass-through scenarios. Test that it is NOT called when the behavior short-circuits.

  ```csharp
  [Fact]
  public async Task CachingBehavior_WhenCached_DoesNotCallHandler()
  {
      var cache = Substitute.For<IDistributedCache>();
      cache.GetStringAsync("order-1", Arg.Any<CancellationToken>())
          .Returns(JsonSerializer.Serialize(new OrderDto { Id = 1 }));

      var behavior = new CachingBehavior<GetOrderQuery, OrderDto>(cache);
      var nextCalled = false;

      var result = await behavior.Handle(
          new GetOrderQuery(1) { CacheKey = "order-1" },
          () => { nextCalled = true; return Task.FromResult(new OrderDto()); },
          CancellationToken.None);

      Assert.False(nextCalled);
      Assert.Equal(1, result.Id);
  }
  ```

## Testing Notifications

- Test notification handlers individually, just like request handlers.

  ```csharp
  [Fact]
  public async Task SendOrderConfirmation_SendsEmail()
  {
      var emailService = Substitute.For<IEmailService>();
      var handler = new SendOrderConfirmationEmail(emailService);

      await handler.Handle(
          new OrderCreatedNotification(OrderId: 1, CreatedAt: DateTime.UtcNow),
          CancellationToken.None);

      await emailService.Received(1).SendOrderConfirmationAsync(1, Arg.Any<CancellationToken>());
  }
  ```

## Integration Testing the Pipeline

- For integration tests that need the full pipeline (behaviors + handler), build a real `ServiceProvider` with `AddMediatR`.

  ```csharp
  public class OrderIntegrationTests : IDisposable
  {
      private readonly ServiceProvider _provider;

      public OrderIntegrationTests()
      {
          var services = new ServiceCollection();
          services.AddMediatR(cfg =>
          {
              cfg.RegisterServicesFromAssembly(typeof(GetOrderHandler).Assembly);
              cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
          });
          services.AddScoped<IOrderRepository, InMemoryOrderRepository>();
          _provider = services.BuildServiceProvider();
      }

      [Fact]
      public async Task CreateOrder_WithValidation_Succeeds()
      {
          var sender = _provider.GetRequiredService<ISender>();
          var result = await sender.Send(new CreateOrderCommand(
              Items: new List<OrderItem> { new("Widget", 2, 9.99m) }));
          Assert.True(result > 0);
      }

      [Fact]
      public async Task CreateOrder_InvalidRequest_ThrowsValidationException()
      {
          var sender = _provider.GetRequiredService<ISender>();
          await Assert.ThrowsAsync<ValidationException>(() =>
              sender.Send(new CreateOrderCommand(Items: new List<OrderItem>())));
      }

      public void Dispose() => _provider.Dispose();
  }
  ```

## Mocking IMediator / ISender

- When testing code that depends on `ISender` (e.g., a controller or API endpoint), mock `ISender` — not the handler.

  ```csharp
  [Fact]
  public async Task GetEndpoint_ReturnsOrder()
  {
      var sender = Substitute.For<ISender>();
      sender.Send(Arg.Any<GetOrderQuery>(), Arg.Any<CancellationToken>())
          .Returns(new OrderDto { Id = 1, Status = "Active" });

      var controller = new OrdersController(sender);

      var result = await controller.Get(1, CancellationToken.None);

      var okResult = Assert.IsType<OkObjectResult>(result);
      var order = Assert.IsType<OrderDto>(okResult.Value);
      Assert.Equal(1, order.Id);
  }
  ```

  **Why:** Mocking `ISender` tests the caller's integration with MediatR without any pipeline overhead. The handler itself is tested separately.

## CancellationToken in Tests

- Always pass `CancellationToken.None` in unit tests unless you are specifically testing cancellation behavior.

  ```csharp
  [Fact]
  public async Task Handler_RespectsCancel()
  {
      var cts = new CancellationTokenSource();
      cts.Cancel();

      await Assert.ThrowsAsync<OperationCanceledException>(() =>
          handler.Handle(new LongRunningQuery(), cts.Token));
  }
  ```
