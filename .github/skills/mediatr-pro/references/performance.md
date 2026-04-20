# Performance

Performance considerations for MediatR pipelines, handler design, and registration.

## Pipeline Overhead

- Minimize the number of behaviors in the pipeline. Each behavior adds an async state machine allocation and delegate invocation. For high-throughput paths, measure the cost.

  ```csharp
  // Before — every request passes through 6 behaviors, most do nothing
  cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
  cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
  cfg.AddOpenBehavior(typeof(CachingBehavior<,>));
  cfg.AddOpenBehavior(typeof(TransactionBehavior<,>));
  cfg.AddOpenBehavior(typeof(AuditBehavior<,>));
  cfg.AddOpenBehavior(typeof(MetricsBehavior<,>));

  // After — use constrained behaviors so only relevant requests pay the cost
  cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));           // unconstrained — lightweight
  cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));        // constrained to IValidatable
  cfg.AddOpenBehavior(typeof(CachingBehavior<,>));           // constrained to ICacheableRequest
  cfg.AddOpenBehavior(typeof(TransactionBehavior<,>));       // constrained to ITransactionalRequest
  ```

  **Why:** Unconstrained behaviors still enter the pipeline for every request, even if they immediately call `next()`. Prefer marker interface constraints (see also `references/behaviors.md`).

## Handler Allocation

- Handlers are transient by default — a new instance per `Send` call. Keep handlers lightweight with no expensive initialization in constructors.

  ```csharp
  // Before — expensive work in constructor
  public sealed class ReportHandler : IRequestHandler<GenerateReportQuery, ReportDto>
  {
      private readonly ReportEngine _engine;

      public ReportHandler()
      {
          _engine = new ReportEngine(); // slow initialization on every request
      }
  }

  // After — inject as a singleton service, not created per-request
  public sealed class ReportHandler(ReportEngine engine)
      : IRequestHandler<GenerateReportQuery, ReportDto>
  {
      public async Task<ReportDto> Handle(GenerateReportQuery request, CancellationToken ct)
          => await engine.GenerateAsync(request, ct);
  }
  // Register ReportEngine as singleton separately
  ```

## Avoid N+1 Mediator Calls

- Do not call `mediator.Send` in a loop. Each call traverses the full pipeline (behaviors, handler, post-processors).

  ```csharp
  // Before — N+1 pipeline traversals
  foreach (var id in orderIds)
  {
      var order = await sender.Send(new GetOrderQuery(id), ct);
      results.Add(order);
  }

  // After — single batch request
  public sealed record GetOrdersQuery(IReadOnlyList<int> Ids) : IRequest<IReadOnlyList<OrderDto>>;

  var orders = await sender.Send(new GetOrdersQuery(orderIds), ct);
  ```

  **Why:** Each `Send` call creates a handler instance and runs the full behavior pipeline. Batching avoids O(N) pipeline overhead.

## Cancellation Token Propagation

- Always pass `CancellationToken` through to all async calls in handlers and behaviors. Never ignore the token.

  ```csharp
  // Before — cancellation not propagated
  public async Task<OrderDto> Handle(GetOrderQuery request, CancellationToken ct)
  {
      return await _repository.GetByIdAsync(request.Id);  // missing ct
  }

  // After
  public async Task<OrderDto> Handle(GetOrderQuery request, CancellationToken ct)
  {
      return await _repository.GetByIdAsync(request.Id, ct);
  }
  ```

## Notification Fan-Out Performance

- `ForeachAwaitPublisher` (default) is sequential — total time is the sum of all handlers. For independent handlers, use `TaskWhenAllPublisher` for concurrent execution (see also `references/notifications.md`).

  ```csharp
  // Sequential (default) — 3 handlers × 100ms each = 300ms total
  // Concurrent (TaskWhenAllPublisher) — 3 handlers × 100ms each ≈ 100ms total
  cfg.NotificationPublisher = new TaskWhenAllPublisher();
  ```

## Stream Request Performance

- Stream handlers return `IAsyncEnumerable`. Avoid materializing the entire result set before yielding — stream items as they become available.

  ```csharp
  // Before — defeats the purpose of streaming
  public async IAsyncEnumerable<OrderDto> Handle(
      StreamOrdersQuery request,
      [EnumeratorCancellation] CancellationToken ct)
  {
      var allOrders = await _repository.GetAllAsync(ct);  // loads everything into memory
      foreach (var order in allOrders)
      {
          yield return order.ToDto();
      }
  }

  // After — true streaming
  public async IAsyncEnumerable<OrderDto> Handle(
      StreamOrdersQuery request,
      [EnumeratorCancellation] CancellationToken ct)
  {
      await foreach (var order in _repository.StreamAllAsync(ct))
      {
          yield return order.ToDto();
      }
  }
  ```

## Service Lifetime Mismatches

- Do not change handler lifetimes to singleton or scoped unless you understand the implications. Singleton handlers that inject scoped services (e.g., `DbContext`) create captive dependency bugs — the scoped service is never disposed.

  ```csharp
  // Anti-pattern — never do this
  services.AddMediatR(cfg =>
  {
      cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
      cfg.Lifetime = ServiceLifetime.Singleton; // Handlers become singletons
  });
  // Any handler injecting DbContext now has a captive dependency
  ```
