# Notifications

Rules for `INotification`, `INotificationHandler`, publishing strategies, and custom publishers.

## Defining Notifications

- Use `INotification` for events that fan out to zero or more handlers. Notifications are fire-and-forget from the publisher's perspective.

  ```csharp
  // Notification — signals something happened
  public sealed record OrderCreatedNotification(int OrderId, DateTime CreatedAt) : INotification;
  ```

- Use `record` types for notifications, just like requests.

## Notification Handlers

- A notification can have zero or more handlers. Each handler runs independently.

  ```csharp
  public sealed class SendOrderConfirmationEmail(IEmailService email)
      : INotificationHandler<OrderCreatedNotification>
  {
      public async Task Handle(OrderCreatedNotification notification, CancellationToken ct)
      {
          await email.SendOrderConfirmationAsync(notification.OrderId, ct);
      }
  }

  public sealed class UpdateInventory(IInventoryService inventory)
      : INotificationHandler<OrderCreatedNotification>
  {
      public async Task Handle(OrderCreatedNotification notification, CancellationToken ct)
      {
          await inventory.DecrementStockAsync(notification.OrderId, ct);
      }
  }
  ```

- Make notification handlers `sealed` and give them descriptive names that indicate their action (not just `OrderCreatedHandler1`).

## Publishing

- Publish notifications with `IPublisher.Publish()`, not `IMediator.Publish()`, when the caller only publishes.

  ```csharp
  // Before
  public sealed class CreateOrderHandler(IMediator mediator) : IRequestHandler<CreateOrderCommand, int>
  {
      public async Task<int> Handle(CreateOrderCommand request, CancellationToken ct)
      {
          // ... create order
          await mediator.Publish(new OrderCreatedNotification(order.Id, DateTime.UtcNow), ct);
          return order.Id;
      }
  }

  // After
  public sealed class CreateOrderHandler(IPublisher publisher, IOrderRepository repo)
      : IRequestHandler<CreateOrderCommand, int>
  {
      public async Task<int> Handle(CreateOrderCommand request, CancellationToken ct)
      {
          var order = await repo.CreateAsync(request, ct);
          await publisher.Publish(new OrderCreatedNotification(order.Id, DateTime.UtcNow), ct);
          return order.Id;
      }
  }
  ```

## Custom Notification Publishers

- The default publisher (`ForeachAwaitPublisher`) executes handlers sequentially — one at a time, awaiting each. If one handler throws, subsequent handlers do not run.

- Use `TaskWhenAllPublisher` when handlers are independent and can run concurrently. It calls `Task.WhenAll` on all handlers.

  ```csharp
  services.AddMediatR(cfg =>
  {
      cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
      cfg.NotificationPublisher = new TaskWhenAllPublisher();
  });
  ```

  **Why:** `TaskWhenAllPublisher` improves throughput when handlers are independent (e.g., sending email, updating cache, logging). But if one throws, the `AggregateException` contains all failures — handle accordingly.

- For fully custom strategies (e.g., fire-and-forget with background queuing, ordered execution, retry), implement `INotificationPublisher`.

  ```csharp
  public sealed class BackgroundNotificationPublisher(IBackgroundTaskQueue queue)
      : INotificationPublisher
  {
      public Task Publish(
          IEnumerable<NotificationHandlerExecutor> handlerExecutors,
          INotification notification,
          CancellationToken ct)
      {
          foreach (var handler in handlerExecutors)
          {
              queue.Enqueue(ct => handler.HandlerCallback(notification, ct));
          }
          return Task.CompletedTask;
      }
  }
  ```

## Polymorphic Dispatch

- `INotificationHandler<T>` is contravariant on `T`. A handler for `INotification` will receive all notifications. Use this sparingly for truly cross-cutting concerns (e.g., logging all events).

  ```csharp
  // Catch-all handler — receives every notification
  public sealed class NotificationLogger(ILogger<NotificationLogger> logger)
      : INotificationHandler<INotification>
  {
      public Task Handle(INotification notification, CancellationToken ct)
      {
          logger.LogInformation("Notification published: {Type}", notification.GetType().Name);
          return Task.CompletedTask;
      }
  }
  ```

## Notification Anti-Patterns

- **Do not use notifications for operations that require a result.** Notifications are one-way. If the publisher needs acknowledgment, use a request/response instead (see also `references/patterns.md`).

- **Do not overuse notifications for tight coupling disguised as loose coupling.** If handler B must always run after handler A for correctness, they are not independent — combine them into a single handler or use explicit orchestration.

  ```csharp
  // Anti-pattern — notification handlers with implicit ordering dependency
  public sealed class ChargePayment : INotificationHandler<OrderCreatedNotification> { ... }
  public sealed class ShipOrder : INotificationHandler<OrderCreatedNotification> { ... }
  // ShipOrder assumes ChargePayment already ran — fragile!

  // Fix — make the dependency explicit with a command sequence in the handler
  public sealed class CreateOrderHandler : IRequestHandler<CreateOrderCommand, int>
  {
      public async Task<int> Handle(CreateOrderCommand request, CancellationToken ct)
      {
          var order = await CreateOrder(request, ct);
          await ChargePayment(order, ct);    // explicit ordering
          await ShipOrder(order, ct);
          await publisher.Publish(new OrderCreatedNotification(order.Id), ct);
          return order.Id;
      }
  }
  ```

- **Do not put critical business logic in notification handlers.** Because handler execution order is not guaranteed and failures in one handler may or may not prevent others from running (depending on the publisher), notifications are unsuitable for must-succeed operations.
