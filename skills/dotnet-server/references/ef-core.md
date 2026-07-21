## Entity Framework Core

- Register `DbContext` as scoped (the default):

  ```csharp
  builder.Services.AddDbContext<AppDbContext>(options =>
      options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
  ```

- Use `DbContext` pooling for high-throughput scenarios:

  ```csharp
  builder.Services.AddDbContextPool<AppDbContext>(options =>
      options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
  ```

- Always use **no-tracking queries** for read-only data:

  ```csharp
  // Before
  var orders = await context.Orders.ToListAsync();

  // After
  var orders = await context.Orders.AsNoTracking().ToListAsync();
  ```

- Use `IDbContextFactory<T>` when you need DbContext outside the request scope (e.g., background services):

  ```csharp
  builder.Services.AddDbContextFactory<AppDbContext>(options =>
      options.UseSqlServer(connectionString));

  // In background service
  public class OrderProcessor(IDbContextFactory<AppDbContext> factory)
  {
      public async Task ProcessAsync()
      {
          await using var context = await factory.CreateDbContextAsync();
          // use context
      }
  }
  ```

- Always project to DTOs — never expose entity types through your API:

  ```csharp
  // Before (leaks internal model)
  return await context.Orders.FirstOrDefaultAsync(o => o.Id == id);

  // After
  return await context.Orders
      .Where(o => o.Id == id)
      .Select(o => new OrderResponse(o.Id, o.Total, o.Status))
      .FirstOrDefaultAsync();
  ```

- Filter and aggregate in the database, not in memory:

  ```csharp
  // Before (loads all rows, filters in memory)
  var total = (await context.Orders.ToListAsync())
      .Where(o => o.Status == "Shipped").Sum(o => o.Total);

  // After (computed in SQL)
  var total = await context.Orders
      .Where(o => o.Status == "Shipped")
      .SumAsync(o => o.Total);
  ```

- Use execution strategies for transient fault resilience:

  ```csharp
  builder.Services.AddDbContext<AppDbContext>(options =>
      options.UseSqlServer(connectionString, sql =>
          sql.EnableRetryOnFailure(
              maxRetryCount: 3,
              maxRetryDelay: TimeSpan.FromSeconds(5),
              errorNumbersToAdd: null)));
  ```

- Never capture a scoped `DbContext` in a background thread — create a new scope instead:

  ```csharp
  // Before (broken — DbContext disposed)
  _ = Task.Run(() => context.SaveChangesAsync());

  // After
  _ = Task.Run(async () =>
  {
      await using var scope = serviceScopeFactory.CreateAsyncScope();
      var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      await ctx.SaveChangesAsync();
  });
  ```

- Keep migrations in a separate project for large solutions:

  ```csharp
  options.UseSqlServer(connectionString,
      x => x.MigrationsAssembly("MyApp.Migrations"));
  ```
