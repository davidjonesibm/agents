## Authentication & Authorization

### JWT Bearer Authentication

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Auth:Authority"];
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Auth:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Auth:Audience"],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();
```

### Authorization Policies

- Use policy-based authorization over role checks:

  ```csharp
  // Before (fragile string-based role)
  [Authorize(Roles = "Admin")]

  // After (policy-based)
  builder.Services.AddAuthorizationBuilder()
      .AddPolicy("AdminOnly", policy =>
          policy.RequireClaim("role", "admin"))
      .AddPolicy("CanManageOrders", policy =>
          policy.RequireClaim("permission", "orders:manage"));

  // Minimal API
  app.MapDelete("/orders/{id}", DeleteOrder).RequireAuthorization("CanManageOrders");

  // Controller
  [Authorize(Policy = "CanManageOrders")]
  public async Task<IActionResult> DeleteOrder(int id) { }
  ```

- Always call `UseAuthentication()` before `UseAuthorization()`.

- Never store JWT signing keys in source code or `appsettings.json` — use environment variables or a secret store.
