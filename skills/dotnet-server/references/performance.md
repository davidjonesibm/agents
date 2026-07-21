## Async & Performance Patterns

- Never block on async code — no `Task.Wait()`, no `.Result`, no `Task.Run` then await:

  ```csharp
  // Before (thread starvation risk)
  var result = service.GetDataAsync().Result;

  // After
  var result = await service.GetDataAsync();
  ```

- Make the entire call stack async — partial async provides no benefit:

  ```csharp
  // Before (sync over async)
  public string GetData()
  {
      return _httpClient.GetStringAsync("/data").Result;
  }

  // After
  public async Task<string> GetDataAsync()
  {
      return await _httpClient.GetStringAsync("/data");
  }
  ```

- Use `IAsyncEnumerable<T>` for streaming large result sets:

  ```csharp
  app.MapGet("/logs", async (AppDbContext db) =>
  {
      async IAsyncEnumerable<LogEntry> StreamLogs()
      {
          await foreach (var log in db.Logs.AsAsyncEnumerable())
              yield return log;
      }
      return TypedResults.Ok(StreamLogs());
  });
  ```

- Use `IHttpClientFactory` — never `new HttpClient()`:

  ```csharp
  // Before (socket exhaustion)
  using var client = new HttpClient();

  // After
  builder.Services.AddHttpClient<IMyApiClient, MyApiClient>(client =>
  {
      client.BaseAddress = new Uri("https://api.example.com");
      client.Timeout = TimeSpan.FromSeconds(30);
  });
  ```

- Use pagination for large collections — never return unbounded results:

  ```csharp
  app.MapGet("/products", async (AppDbContext db, int page = 1, int size = 20) =>
  {
      var items = await db.Products
          .OrderBy(p => p.Id)
          .Skip((page - 1) * size)
          .Take(size)
          .AsNoTracking()
          .ToListAsync();

      var total = await db.Products.CountAsync();

      return TypedResults.Ok(new PaginatedResponse<Product>(items, total, page, size));
  });
  ```

- Offload long-running work to background services, not request threads:

  ```csharp
  // Before (blocks the request)
  app.MapPost("/reports", async (ReportService svc) =>
  {
      await svc.GenerateReportAsync(); // takes 30 seconds
      return Results.Ok();
  });

  // After (queue and return immediately)
  app.MapPost("/reports", (IBackgroundTaskQueue queue) =>
  {
      queue.Enqueue(async (svc, ct) => await svc.GenerateReportAsync(ct));
      return TypedResults.Accepted();
  });
  ```

- Do not access `HttpContext` from multiple threads — copy needed data first:

  ```csharp
  // Before (not thread-safe)
  var tasks = urls.Select(url => FetchAsync(url, HttpContext));

  // After
  var path = HttpContext.Request.Path.ToString();
  var tasks = urls.Select(url => FetchAsync(url, path));
  ```
