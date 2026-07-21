# MediatR Patterns

CQRS separation, handler design, request modeling, and common anti-patterns.

## CQRS with MediatR

- Separate commands and queries into distinct request types. Commands mutate state; queries read state.

  ```csharp
  // Before — mixed intent, unclear whether this mutates
  public sealed record GetOrCreateUserRequest(string Email) : IRequest<UserDto>;

  // After — separate command and query
  public sealed record GetUserQuery(string Email) : IRequest<UserDto?>;
  public sealed record CreateUserCommand(string Email, string Name) : IRequest<int>;
  ```

  **Why:** Separation enables independent scaling, caching (queries only), and clear handler responsibility.

- Organize by feature (vertical slices), not by technical layer. Each feature folder contains its request, handler, and validator together.

  ```
  // Before — horizontal layers
  Commands/
    CreateOrderCommand.cs
    DeleteOrderCommand.cs
  Handlers/
    CreateOrderHandler.cs
    DeleteOrderHandler.cs
  Validators/
    CreateOrderValidator.cs

  // After — vertical slices
  Features/
    Orders/
      CreateOrder.cs        // Contains command, handler, and validator
      DeleteOrder.cs
      GetOrder.cs
  ```

- Define request and handler in the same file for simple cases. Use nested types or file-scoped patterns.

  ```csharp
  // Features/Orders/GetOrder.cs
  namespace MyApp.Features.Orders;

  public sealed record GetOrderQuery(int Id) : IRequest<OrderDto>;

  public sealed class GetOrderHandler(IOrderRepository repository)
      : IRequestHandler<GetOrderQuery, OrderDto>
  {
      public async Task<OrderDto> Handle(GetOrderQuery request, CancellationToken ct)
      {
          var order = await repository.GetByIdAsync(request.Id, ct)
              ?? throw new NotFoundException(nameof(Order), request.Id);
          return order.ToDto();
      }
  }
  ```

## Handler Design

- Keep handlers thin — they should orchestrate, not implement business logic. Delegate to domain services or repositories.

  ```csharp
  // Before — fat handler with embedded business logic
  public sealed class CreateOrderHandler(AppDbContext db) : IRequestHandler<CreateOrderCommand, int>
  {
      public async Task<int> Handle(CreateOrderCommand request, CancellationToken ct)
      {
          // 50 lines of validation, discount calculation, inventory checks...
          var discount = request.Items.Count > 10 ? 0.1m : 0m;
          var total = request.Items.Sum(i => i.Price * i.Quantity) * (1 - discount);
          // ... more logic
          var order = new Order { Total = total, /* ... */ };
          db.Orders.Add(order);
          await db.SaveChangesAsync(ct);
          return order.Id;
      }
  }

  // After — thin handler delegates to domain
  public sealed class CreateOrderHandler(IOrderService orderService)
      : IRequestHandler<CreateOrderCommand, int>
  {
      public async Task<int> Handle(CreateOrderCommand request, CancellationToken ct)
      {
          var order = await orderService.CreateAsync(request.Items, ct);
          return order.Id;
      }
  }
  ```

  **Why:** Handler responsibility is to map a request to a domain operation and return the result. Business rules belong in domain services.

- Make handlers `sealed` unless inheritance is an explicit design choice.

  ```csharp
  // Before
  public class GetOrderHandler : IRequestHandler<GetOrderQuery, OrderDto> { ... }

  // After
  public sealed class GetOrderHandler : IRequestHandler<GetOrderQuery, OrderDto> { ... }
  ```

- Use primary constructors (C# 12+) for handler dependency injection.

  ```csharp
  // Before
  public sealed class GetOrderHandler : IRequestHandler<GetOrderQuery, OrderDto>
  {
      private readonly IOrderRepository _repository;

      public GetOrderHandler(IOrderRepository repository)
      {
          _repository = repository;
      }

      public async Task<OrderDto> Handle(GetOrderQuery request, CancellationToken ct)
          => (await _repository.GetByIdAsync(request.Id, ct))?.ToDto()
              ?? throw new NotFoundException(nameof(Order), request.Id);
  }

  // After
  public sealed class GetOrderHandler(IOrderRepository repository)
      : IRequestHandler<GetOrderQuery, OrderDto>
  {
      public async Task<OrderDto> Handle(GetOrderQuery request, CancellationToken ct)
          => (await repository.GetByIdAsync(request.Id, ct))?.ToDto()
              ?? throw new NotFoundException(nameof(Order), request.Id);
  }
  ```

## Request Modeling

- Use `record` types for requests — they provide value equality, immutability, and concise syntax.

  ```csharp
  // Before — mutable class
  public class GetOrderQuery : IRequest<OrderDto>
  {
      public int Id { get; set; }
  }

  // After — immutable record
  public sealed record GetOrderQuery(int Id) : IRequest<OrderDto>;
  ```

- Include only the data the handler needs. Do not pass entire DTOs or entity models as request properties.

  ```csharp
  // Before — entire DTO passed through
  public sealed record UpdateOrderCommand(OrderDto Order) : IRequest;

  // After — only the fields needed
  public sealed record UpdateOrderCommand(int Id, string Status, string? Notes) : IRequest;
  ```

## Anti-Patterns

- **Do not use MediatR as a service locator.** Injecting `IMediator` to call `Send` from within a handler to invoke another handler is service-locator abuse.

  ```csharp
  // Before — handler calling another handler via mediator
  public sealed class CreateOrderHandler(ISender sender) : IRequestHandler<CreateOrderCommand, int>
  {
      public async Task<int> Handle(CreateOrderCommand request, CancellationToken ct)
      {
          // Anti-pattern: using mediator to call another handler
          var user = await sender.Send(new GetUserQuery(request.UserId), ct);
          // ... create order
      }
  }

  // After — inject the dependency directly
  public sealed class CreateOrderHandler(IUserRepository userRepository)
      : IRequestHandler<CreateOrderCommand, int>
  {
      public async Task<int> Handle(CreateOrderCommand request, CancellationToken ct)
      {
          var user = await userRepository.GetByIdAsync(request.UserId, ct);
          // ... create order
      }
  }
  ```

  **Why:** Handler-to-handler calls via the mediator hide dependencies, bypass the pipeline for the caller's intent, and make the call graph untraceable.

- **Do not over-use notifications.** Notifications are fire-and-forget fan-out. Do not use them for operations where the sender needs to know the outcome.

  ```csharp
  // Before — using notification where a command is appropriate
  public sealed record CreateInvoiceNotification(int OrderId) : INotification;
  // Caller has no way to know if invoice creation succeeded

  // After — use a command if the caller needs a result or confirmation
  public sealed record CreateInvoiceCommand(int OrderId) : IRequest<int>;
  ```

- **Do not create a generic base handler.** Abstract base handlers that try to generalize CRUD operations add complexity without value.

  ```csharp
  // Anti-pattern — do not do this
  public abstract class BaseHandler<TRequest, TResponse, TEntity> : IRequestHandler<TRequest, TResponse>
      where TRequest : IRequest<TResponse>
  {
      // Trying to generalize all CRUD — too abstract, too fragile
  }
  ```

- **Do not return domain entities from handlers.** Always map to DTOs to avoid leaking domain internals.

  ```csharp
  // Before — leaking domain entity
  public sealed record GetOrderQuery(int Id) : IRequest<Order>;

  // After — return a DTO
  public sealed record GetOrderQuery(int Id) : IRequest<OrderDto>;
  ```
