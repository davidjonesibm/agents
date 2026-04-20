# Pipeline Behaviors

Rules for implementing, registering, and ordering `IPipelineBehavior<TRequest, TResponse>`, pre/post processors, and stream behaviors.

## Implementing Behaviors

- A pipeline behavior wraps handler execution. Always call `await next()` to continue the pipeline — omitting it silently swallows the request.

  ```csharp
  // Correct — calls next() and returns the response
  public sealed class LoggingBehavior<TRequest, TResponse>(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
      : IPipelineBehavior<TRequest, TResponse>
      where TRequest : IRequest<TResponse>
  {
      public async Task<TResponse> Handle(
          TRequest request,
          RequestHandlerDelegate<TResponse> next,
          CancellationToken ct)
      {
          logger.LogInformation("Handling {RequestType}", typeof(TRequest).Name);
          var response = await next();
          logger.LogInformation("Handled {RequestType}", typeof(TRequest).Name);
          return response;
      }
  }
  ```

- Do not modify the request object in behaviors. The `next` delegate does not accept `TRequest`, so you cannot replace the request — only mutate it. Prefer treating requests as immutable.

## Registration and Ordering

- Register behaviors in the order you want them to execute. The first registered behavior is the outermost in the pipeline.

  ```csharp
  services.AddMediatR(cfg =>
  {
      cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);

      // Pipeline order (outermost → innermost):
      // 1. Logging (outermost — sees everything)
      cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
      // 2. Validation (reject before hitting business logic)
      cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
      // 3. Transaction (wrap the handler in a transaction)
      cfg.AddOpenBehavior(typeof(TransactionBehavior<,>));
  });
  ```

  **Why:** Order matters. Validation should reject invalid requests before a transaction is opened. Logging should be outermost to capture the full pipeline duration.

- Use `AddOpenBehavior(typeof(MyBehavior<,>))` for open generic behaviors. Use `AddBehavior<IPipelineBehavior<Ping, Pong>, PingPongBehavior>()` for closed generic (specific) behaviors.

## Common Behavior Patterns

### Validation Behavior

- Use a validation behavior to run FluentValidation validators before the handler executes.

  ```csharp
  public sealed class ValidationBehavior<TRequest, TResponse>(
      IEnumerable<IValidator<TRequest>> validators)
      : IPipelineBehavior<TRequest, TResponse>
      where TRequest : IRequest<TResponse>
  {
      public async Task<TResponse> Handle(
          TRequest request,
          RequestHandlerDelegate<TResponse> next,
          CancellationToken ct)
      {
          if (!validators.Any())
              return await next();

          var context = new ValidationContext<TRequest>(request);
          var failures = (await Task.WhenAll(
                  validators.Select(v => v.ValidateAsync(context, ct))))
              .SelectMany(r => r.Errors)
              .Where(f => f is not null)
              .ToList();

          if (failures.Count > 0)
              throw new ValidationException(failures);

          return await next();
      }
  }
  ```

### Transaction Behavior

- Wrap handlers in a database transaction using a behavior. Apply only to commands (mutations), not queries.

  ```csharp
  public sealed class TransactionBehavior<TRequest, TResponse>(AppDbContext db)
      : IPipelineBehavior<TRequest, TResponse>
      where TRequest : IRequest<TResponse>, ITransactionalRequest  // marker interface
  {
      public async Task<TResponse> Handle(
          TRequest request,
          RequestHandlerDelegate<TResponse> next,
          CancellationToken ct)
      {
          await using var transaction = await db.Database.BeginTransactionAsync(ct);
          var response = await next();
          await db.SaveChangesAsync(ct);
          await transaction.CommitAsync(ct);
          return response;
      }
  }
  ```

  **Why:** Using a marker interface (`ITransactionalRequest`) limits the behavior to commands that need transactions, avoiding unnecessary overhead on queries.

### Caching Behavior

- Implement caching as a behavior for query requests only. Use a marker interface to indicate cacheable requests.

  ```csharp
  public interface ICacheableRequest<TResponse> : IRequest<TResponse>
  {
      string CacheKey { get; }
      TimeSpan? Expiration { get; }
  }

  public sealed class CachingBehavior<TRequest, TResponse>(IDistributedCache cache)
      : IPipelineBehavior<TRequest, TResponse>
      where TRequest : ICacheableRequest<TResponse>
  {
      public async Task<TResponse> Handle(
          TRequest request,
          RequestHandlerDelegate<TResponse> next,
          CancellationToken ct)
      {
          var cached = await cache.GetStringAsync(request.CacheKey, ct);
          if (cached is not null)
              return JsonSerializer.Deserialize<TResponse>(cached)!;

          var response = await next();
          await cache.SetStringAsync(
              request.CacheKey,
              JsonSerializer.Serialize(response),
              new DistributedCacheEntryOptions
              {
                  AbsoluteExpirationRelativeToNow = request.Expiration ?? TimeSpan.FromMinutes(5)
              },
              ct);
          return response;
      }
  }
  ```

## Constrained Behaviors

- Use generic type constraints to apply behaviors only to certain request types.

  ```csharp
  // Before — behavior runs for ALL requests
  public sealed class AuditBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
      where TRequest : IRequest<TResponse>
  { ... }

  // After — behavior runs only for requests that implement IAuditableRequest
  public sealed class AuditBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
      where TRequest : IRequest<TResponse>, IAuditableRequest
  { ... }
  ```

  **Why:** Unconstrained behaviors run on every request. Use marker interfaces to scope behaviors to only the requests that need them.

## Pre/Post Processors

- Use `IRequestPreProcessor<TRequest>` for cross-cutting logic that runs before every handler (e.g., audit logging of the incoming request). Use `IRequestPostProcessor<TRequest, TResponse>` for logic after handler completion.

  ```csharp
  public sealed class AuditPreProcessor<TRequest>(IAuditLog auditLog)
      : IRequestPreProcessor<TRequest>
      where TRequest : notnull
  {
      public Task Process(TRequest request, CancellationToken ct)
      {
          auditLog.LogRequest(typeof(TRequest).Name, request);
          return Task.CompletedTask;
      }
  }
  ```

- Pre/post processors are registered explicitly with `cfg.AddRequestPreProcessor<T>()` and `cfg.AddRequestPostProcessor<T>()` — they are not auto-discovered.

## Stream Pipeline Behaviors

- Use `IStreamPipelineBehavior<TRequest, TResponse>` for behaviors around `IStreamRequest` handlers. Stream behaviors wrap the entire stream, not individual items.

  ```csharp
  public sealed class StreamLoggingBehavior<TRequest, TResponse>(
      ILogger<StreamLoggingBehavior<TRequest, TResponse>> logger)
      : IStreamPipelineBehavior<TRequest, TResponse>
      where TRequest : IStreamRequest<TResponse>
  {
      public async IAsyncEnumerable<TResponse> Handle(
          TRequest request,
          StreamHandlerDelegate<TResponse> next,
          [EnumeratorCancellation] CancellationToken ct)
      {
          logger.LogInformation("Starting stream for {RequestType}", typeof(TRequest).Name);
          await foreach (var item in next().WithCancellation(ct))
          {
              yield return item;
          }
          logger.LogInformation("Stream completed for {RequestType}", typeof(TRequest).Name);
      }
  }
  ```

- Register stream behaviors with `cfg.AddStreamBehavior<T>()` or `cfg.AddOpenStreamBehavior(typeof(T<,>))`.

## Behavior Anti-Patterns

- **Do not swallow exceptions in behaviors** — catch-and-log is fine, but always re-throw or throw a new exception. Silently swallowing prevents callers from knowing about failures (see also `references/error-handling.md`).

- **Do not resolve scoped services in singleton behaviors.** If you change the behavior lifetime to singleton, injecting scoped services (like `DbContext`) creates captive dependency bugs.

- **Pipeline behaviors do not work with `INotificationHandler`.** They only wrap `IRequestHandler` execution. For cross-cutting notification concerns, use a custom `INotificationPublisher` or base class.
