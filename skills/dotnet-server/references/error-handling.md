## Error Handling

- Always use **Problem Details** (RFC 7807) for API error responses:

  ```csharp
  builder.Services.AddProblemDetails();

  var app = builder.Build();

  app.UseExceptionHandler();
  app.UseStatusCodePages();
  ```

- Use `UseExceptionHandler` in production — never expose stack traces:

  ```csharp
  // Before (leaks info)
  app.UseDeveloperExceptionPage(); // in production!

  // After
  if (app.Environment.IsDevelopment())
      app.UseDeveloperExceptionPage();
  else
      app.UseExceptionHandler();
  ```

- Return appropriate status codes — don't throw exceptions for expected failures:

  ```csharp
  // Before (anti-pattern — exceptions for control flow)
  app.MapGet("/users/{id}", (int id, IUserService svc) =>
  {
      var user = svc.GetById(id) ?? throw new NotFoundException();
      return Results.Ok(user);
  });

  // After
  app.MapGet("/users/{id}", (int id, IUserService svc) =>
  {
      var user = svc.GetById(id);
      return user is null ? TypedResults.NotFound() : TypedResults.Ok(user);
  });
  ```

- Customize Problem Details for specific exception types:

  ```csharp
  builder.Services.AddProblemDetails(options =>
  {
      options.CustomizeProblemDetails = ctx =>
      {
          ctx.ProblemDetails.Extensions["traceId"] =
              ctx.HttpContext.TraceIdentifier;
      };
  });
  ```

## Request Validation

### Minimal APIs

- Use endpoint filters for validation:

  ```csharp
  public class ValidationFilter<T> : IEndpointFilter
  {
      public async ValueTask<object?> InvokeAsync(
          EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
      {
          var arg = ctx.GetArgument<T>(0);
          var results = new List<ValidationResult>();
          if (!Validator.TryValidateObject(arg, new ValidationContext(arg), results, true))
          {
              return TypedResults.ValidationProblem(
                  results.ToDictionary(
                      r => r.MemberNames.First(),
                      r => new[] { r.ErrorMessage ?? "Invalid" }));
          }
          return await next(ctx);
      }
  }
  ```

- Or use FluentValidation for complex rules:

  ```csharp
  public class CreateOrderRequestValidator : AbstractValidator<CreateOrderRequest>
  {
      public CreateOrderRequestValidator()
      {
          RuleFor(x => x.CustomerName).NotEmpty().MaximumLength(200);
          RuleFor(x => x.Items).NotEmpty();
          RuleForEach(x => x.Items).ChildRules(item =>
          {
              item.RuleFor(i => i.Quantity).GreaterThan(0);
          });
      }
  }
  ```

### Controllers

- With `[ApiController]`, model validation is automatic — invalid models return 400 with validation Problem Details. Do not check `ModelState.IsValid` manually unless you have a specific reason.
