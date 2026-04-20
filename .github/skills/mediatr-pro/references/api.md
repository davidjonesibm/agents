# MediatR API Reference

Core interfaces, registration, and correct usage of the MediatR API surface (v12+).

## Core Interfaces

- Inject `ISender` when you only send requests. Inject `IPublisher` when you only publish notifications. Inject `IMediator` only when you need both.

  ```csharp
  // Before — overly broad dependency
  public sealed class OrderService(IMediator mediator)
  {
      public Task<Order> GetOrder(int id, CancellationToken ct)
          => mediator.Send(new GetOrderQuery(id), ct);
  }

  // After — narrowest interface
  public sealed class OrderService(ISender sender)
  {
      public Task<Order> GetOrder(int id, CancellationToken ct)
          => sender.Send(new GetOrderQuery(id), ct);
  }
  ```

  **Why:** `ISender` and `IPublisher` are separate interfaces. Using the narrowest one communicates intent and simplifies testing.

## Request Types

- Use `IRequest<TResponse>` for requests that return a value. Use `IRequest` for requests that return nothing (void commands).

  ```csharp
  // Query — returns data
  public sealed record GetOrderQuery(int Id) : IRequest<OrderDto>;

  // Command — returns nothing
  public sealed record DeleteOrderCommand(int Id) : IRequest;
  ```

- Implement `IRequestHandler<TRequest, TResponse>` for requests with return values. Implement `IRequestHandler<TRequest>` for void requests.

  ```csharp
  // Before — wrong handler interface for void request
  public sealed class DeleteOrderHandler : IRequestHandler<DeleteOrderCommand, Unit>
  {
      public Task<Unit> Handle(DeleteOrderCommand request, CancellationToken ct)
      {
          // delete logic
          return Task.FromResult(Unit.Value);
      }
  }

  // After — use the non-generic interface
  public sealed class DeleteOrderHandler : IRequestHandler<DeleteOrderCommand>
  {
      public Task Handle(DeleteOrderCommand request, CancellationToken ct)
      {
          // delete logic
          return Task.CompletedTask;
      }
  }
  ```

  **Why:** MediatR v12+ provides `IRequestHandler<TRequest>` that returns `Task` directly. Returning `Unit` manually is legacy v11 and earlier behavior.

## Stream Requests

- Use `IStreamRequest<TResponse>` and `IStreamRequestHandler<TRequest, TResponse>` for requests that return `IAsyncEnumerable<TResponse>`.

  ```csharp
  // Request
  public sealed record StreamOrdersQuery(string Status) : IStreamRequest<OrderDto>;

  // Handler
  public sealed class StreamOrdersHandler : IStreamRequestHandler<StreamOrdersQuery, OrderDto>
  {
      public async IAsyncEnumerable<OrderDto> Handle(
          StreamOrdersQuery request,
          [EnumeratorCancellation] CancellationToken ct)
      {
          await foreach (var order in _repository.StreamByStatusAsync(request.Status, ct))
          {
              yield return order.ToDto();
          }
      }
  }

  // Consuming
  await foreach (var order in mediator.CreateStream(new StreamOrdersQuery("Pending"), ct))
  {
      Console.WriteLine(order.Id);
  }
  ```

- Always annotate the `CancellationToken` parameter with `[EnumeratorCancellation]` in stream handlers.

## DI Registration

- Always use `AddMediatR` with assembly scanning. Never manually register handlers.

  ```csharp
  // Before — manual registration is fragile
  services.AddTransient<IRequestHandler<GetOrderQuery, OrderDto>, GetOrderHandler>();
  services.AddTransient<IRequestHandler<CreateOrderCommand>, CreateOrderHandler>();

  // After — assembly scanning finds all handlers automatically
  services.AddMediatR(cfg =>
  {
      cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
  });
  ```

- Register behaviors, pre/post processors explicitly — they are NOT discovered by assembly scanning.

  ```csharp
  services.AddMediatR(cfg =>
  {
      cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);

      // Behaviors must be registered explicitly
      cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
      cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));

      // Pre/post processors
      cfg.AddRequestPreProcessor<AuditPreProcessor>();
      cfg.AddRequestPostProcessor<AuditPostProcessor>();
  });
  ```

  **Why:** Behaviors and processors are not auto-discovered because their registration order matters — it defines pipeline execution order.

- When scanning multiple assemblies, call `RegisterServicesFromAssembly` multiple times or use `RegisterServicesFromAssemblies`.

  ```csharp
  services.AddMediatR(cfg =>
  {
      cfg.RegisterServicesFromAssemblies(
          typeof(Application.AssemblyMarker).Assembly,
          typeof(Infrastructure.AssemblyMarker).Assembly);
  });
  ```

## Contracts-Only Package

- Use `MediatR.Contracts` in projects that only define request/notification types without handlers (e.g., shared API contract libraries, gRPC contracts, Blazor).

  ```xml
  <!-- Shared contracts project — no handler implementations -->
  <PackageReference Include="MediatR.Contracts" Version="2.*" />

  <!-- Application project — full MediatR with handlers -->
  <PackageReference Include="MediatR" Version="12.*" />
  ```

## Service Lifetimes

- `IMediator`, `ISender`, and `IPublisher` are registered as **transient** by default. All handlers are also **transient**. Do not change these lifetimes unless you have a specific reason.

- Avoid injecting scoped services (e.g., `DbContext`) into singleton handlers — the default transient lifetime avoids this, but changing lifetimes can introduce captured dependency bugs (see also `references/performance.md`).
