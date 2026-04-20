---
name: mediatr-pro
description: >-
  Comprehensively reviews MediatR code for best practices on CQRS, request/response handlers,
  pipeline behaviors, notifications, streaming, DI registration, error handling, and testing.
  Use when reading, writing, or reviewing .NET projects that use MediatR for in-process messaging,
  mediator pattern, or command/query separation.
---

Review .NET code using MediatR for correctness, idiomatic patterns, and adherence to best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check for correct API usage and registration using `references/api.md`.
2. Validate CQRS separation, handler design, and architectural patterns using `references/patterns.md`.
3. Check pipeline behavior implementation and ordering using `references/behaviors.md`.
4. Validate notification usage and publishing strategies using `references/notifications.md`.
5. Check performance best practices using `references/performance.md`.
6. Validate error handling in handlers and pipeline using `references/error-handling.md`.
7. Ensure testing patterns are correct using `references/testing.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target MediatR v12+ on .NET 8+.
- All code examples use C# with modern language features (file-scoped namespaces, primary constructors, `sealed` classes).
- Use `IRequest<TResponse>` for queries, `IRequest` for commands that return nothing.
- Always register MediatR with `AddMediatR` and assembly scanning — never manually register handlers.
- Pipeline behaviors must be registered explicitly via `AddBehavior` / `AddOpenBehavior`.
- Never use `IMediator` when `ISender` or `IPublisher` suffices — prefer the narrowest interface.
- All handlers should be `sealed` unless explicitly designed for inheritance.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated (e.g., "Separate commands from queries with distinct return types").
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

Example output:

### Features/Orders/GetOrder.cs

**Line 12: Prefer `ISender` over `IMediator` when only sending requests.**

```csharp
// Before
public class OrdersController(IMediator mediator) : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
        => Ok(await mediator.Send(new GetOrderQuery(id), ct));
}

// After
public class OrdersController(ISender sender) : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
        => Ok(await sender.Send(new GetOrderQuery(id), ct));
}
```
