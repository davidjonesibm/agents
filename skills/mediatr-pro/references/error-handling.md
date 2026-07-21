# Error Handling

Error handling patterns in MediatR handlers, pipeline behaviors, and exception handlers.

## Handler Error Handling

- Throw domain-specific exceptions from handlers. Do not return error codes or result wrappers unless it is a project-wide convention.

  ```csharp
  // Before — returning null on not found, caller must guess
  public async Task<OrderDto?> Handle(GetOrderQuery request, CancellationToken ct)
  {
      var order = await _repository.GetByIdAsync(request.Id, ct);
      return order?.ToDto();
  }

  // After — throw a domain exception
  public async Task<OrderDto> Handle(GetOrderQuery request, CancellationToken ct)
  {
      var order = await _repository.GetByIdAsync(request.Id, ct)
          ?? throw new NotFoundException(nameof(Order), request.Id);
      return order.ToDto();
  }
  ```

  **Why:** Throwing forces callers to handle the error. Returning null silently succeeds, leading to `NullReferenceException` downstream.

## Result Pattern (Alternative)

- If your project uses a result pattern (e.g., `Result<T>` or `OneOf`), apply it consistently to all handlers. Do not mix exceptions and result types.

  ```csharp
  // Consistent result pattern
  public sealed record GetOrderQuery(int Id) : IRequest<Result<OrderDto>>;

  public sealed class GetOrderHandler(IOrderRepository repository)
      : IRequestHandler<GetOrderQuery, Result<OrderDto>>
  {
      public async Task<Result<OrderDto>> Handle(GetOrderQuery request, CancellationToken ct)
      {
          var order = await repository.GetByIdAsync(request.Id, ct);
          if (order is null)
              return Result.NotFound($"Order {request.Id} not found");
          return Result.Ok(order.ToDto());
      }
  }
  ```

## Exception Handling in Behaviors

- In pipeline behaviors, decide whether to catch-and-wrap or let exceptions propagate. Do not silently swallow exceptions.

  ```csharp
  // Before — swallows the exception
  public async Task<TResponse> Handle(
      TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
  {
      try
      {
          return await next();
      }
      catch (Exception)
      {
          return default!;  // Silent failure — caller gets null/zero
      }
  }

  // After — log and re-throw
  public async Task<TResponse> Handle(
      TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
  {
      try
      {
          return await next();
      }
      catch (Exception ex)
      {
          _logger.LogError(ex, "Error handling {RequestType}", typeof(TRequest).Name);
          throw;  // Preserve stack trace
      }
  }
  ```

## MediatR Exception Handlers

- Use `IRequestExceptionHandler<TRequest, TResponse, TException>` for exception handling that can recover and return a response. Only one exception handler can handle a given exception.

  ```csharp
  public sealed class OrderNotFoundExceptionHandler
      : IRequestExceptionHandler<GetOrderQuery, OrderDto, NotFoundException>
  {
      public Task Handle(
          GetOrderQuery request,
          NotFoundException exception,
          RequestExceptionHandlerState<OrderDto> state,
          CancellationToken ct)
      {
          // Return a default or fallback response
          state.SetHandled(new OrderDto { Id = request.Id, Status = "NotFound" });
          return Task.CompletedTask;
      }
  }
  ```

  **Why:** Exception handlers let you recover from specific exceptions without wrapping every handler in try-catch. Call `state.SetHandled(response)` to mark the exception as handled and provide a fallback response.

## MediatR Exception Actions

- Use `IRequestExceptionAction<TRequest, TException>` for side effects on exceptions (e.g., logging, metrics) without handling/recovering from the exception. All matching actions run; the exception is still re-thrown.

  ```csharp
  public sealed class LogNotFoundAction(ILogger<LogNotFoundAction> logger)
      : IRequestExceptionAction<IRequest, NotFoundException>
  {
      public Task Execute(IRequest request, NotFoundException exception, CancellationToken ct)
      {
          logger.LogWarning(exception, "Not found for request {RequestType}", request.GetType().Name);
          return Task.CompletedTask;
      }
  }
  ```

- **Exception actions vs. exception handlers:** Actions are for side effects (logging, alerting) — they run for all matching exceptions and do not prevent the exception from propagating. Handlers can recover from the exception by providing a replacement response.

## Validation Errors

- Throw a dedicated `ValidationException` from the validation behavior. Do not return HTTP status codes or framework-specific responses from the behavior — let middleware translate exceptions to responses.

  ```csharp
  // In the validation behavior
  if (failures.Count > 0)
      throw new ValidationException(failures);

  // In ASP.NET Core exception-handling middleware (not in MediatR)
  app.UseExceptionHandler(app => app.Run(async context =>
  {
      var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
      if (exception is ValidationException validationEx)
      {
          context.Response.StatusCode = 400;
          await context.Response.WriteAsJsonAsync(new { errors = validationEx.Errors });
      }
  }));
  ```

  **Why:** Behaviors should not know about HTTP. Mapping exceptions to HTTP responses is the responsibility of the web framework layer (see also `references/patterns.md` for layer separation).

## CancellationToken in Error Paths

- When catching exceptions in behaviors, check `cancellationToken.IsCancellationRequested` before performing cleanup or logging — the cancellation may be the cause of the exception.

  ```csharp
  catch (OperationCanceledException) when (ct.IsCancellationRequested)
  {
      _logger.LogInformation("Request {RequestType} was cancelled", typeof(TRequest).Name);
      throw; // Let cancellation propagate
  }
  catch (Exception ex)
  {
      _logger.LogError(ex, "Unexpected error in {RequestType}", typeof(TRequest).Name);
      throw;
  }
  ```
