# Performance Best Practices

Buffering behavior, query caching, connection pooling, and performance pitfalls.

## Buffered vs Unbuffered Queries

- Dapper **buffers all results by default** — the entire result set is loaded into memory before the method returns. This minimizes lock duration on the database.

- For large result sets, use `buffered: false` to stream rows one at a time, reducing memory pressure.

  ```csharp
  // Default (buffered) — entire result set in memory
  var products = await connection.QueryAsync<Product>(
      "SELECT * FROM Products");
  // All rows loaded before this line executes

  // Unbuffered — rows streamed on demand (sync only for Query<T>)
  var products = connection.Query<Product>(
      "SELECT * FROM Products",
      buffered: false);
  foreach (var product in products)
  {
      // rows read one at a time — connection stays open during iteration
  }
  ```

  **Trade-off:** Unbuffered queries hold the connection and database locks open during iteration. Do not use unbuffered queries in request handlers where slow consumers could starve the connection pool.

- For async unbuffered streaming, use `QueryUnbufferedAsync` (Dapper 2.1+), which returns `IAsyncEnumerable<T>`.

  ```csharp
  await foreach (var product in connection.QueryUnbufferedAsync<Product>(
      "SELECT * FROM Products"))
  {
      await ProcessProductAsync(product);
  }
  ```

## Query Plan Cache

- Dapper caches compiled IL for mapping query results to objects. The cache key is the SQL text + parameter types. **Use parameterized queries** to benefit from this cache — dynamically generated SQL (unique per call) creates unbounded cache entries.

  ```csharp
  // BAD — unique SQL string per call, pollutes Dapper's cache AND DB plan cache
  var sql = $"SELECT * FROM Products WHERE Id = {id}";

  // GOOD — same SQL text reused, cache hit every time
  var sql = "SELECT * FROM Products WHERE Id = @Id";
  var product = await connection.QueryFirstOrDefaultAsync<Product>(
      sql, new { Id = id });
  ```

  **Why:** Dapper stores mapping info in a `ConcurrentDictionary` keyed on SQL text. Unique SQL = unique entry = memory leak over time.

## Connection Pooling

- ADO.NET pools connections automatically per connection string. Creating `new SqlConnection(connectionString)` is cheap — it grabs a pooled physical connection.

- **Do not hold connections open longer than needed.** Open → query → dispose. Long-lived connections reduce pool availability.

  ```csharp
  // Before — connection open for the entire request lifetime
  public class OrderService
  {
      private readonly SqlConnection _connection;
      public OrderService(SqlConnection connection) => _connection = connection;
      // connection lives as long as the service instance
  }

  // After — connection per operation
  public class OrderService
  {
      private readonly string _connectionString;
      public OrderService(string connectionString) => _connectionString = connectionString;

      public async Task<Order?> GetOrderAsync(int id)
      {
          using var connection = new SqlConnection(_connectionString);
          return await connection.QueryFirstOrDefaultAsync<Order>(
              "SELECT * FROM Orders WHERE Id = @Id", new { Id = id });
      }
  }
  ```

## DbString and Index Usage

- On SQL Server, Dapper sends C# `string` parameters as `nvarchar` by default. If the target column is `varchar`, SQL Server performs an implicit conversion that **prevents index seeks**, causing full table scans.

  ```csharp
  // Before — nvarchar param on varchar column = index scan
  await connection.QueryAsync<Customer>(
      "SELECT * FROM Customers WHERE AccountCode = @Code",
      new { Code = code });

  // After — varchar param, index seek possible
  await connection.QueryAsync<Customer>(
      "SELECT * FROM Customers WHERE AccountCode = @Code",
      new { Code = new DbString { Value = code, IsAnsi = true, Length = 20 } });
  ```

  See also `references/type-handling.md` for `DbString` details, `references/security.md` for related security considerations.

## CommandDefinition for Cancellation

- In web applications, use `CommandDefinition` to pass `CancellationToken`. This allows in-flight queries to be cancelled when a client disconnects.

  ```csharp
  // Before — query runs to completion even if client disconnects
  var results = await connection.QueryAsync<Product>(sql, parameters);

  // After — query cancelled on client disconnect
  var command = new CommandDefinition(
      sql,
      parameters,
      cancellationToken: httpContext.RequestAborted);
  var results = await connection.QueryAsync<Product>(command);
  ```

  See also `references/type-handling.md` for `CommandDefinition` usage.

## SELECT Only What You Need

- Avoid `SELECT *` — it transfers unnecessary columns, increases network overhead, and increases memory usage from buffering.

  ```csharp
  // Before — SELECTs 50 columns when only 3 are needed
  var users = await connection.QueryAsync<UserListItem>(
      "SELECT * FROM Users WHERE IsActive = 1");

  // After — only the columns needed for the DTO
  var users = await connection.QueryAsync<UserListItem>(
      "SELECT Id, Name, Email FROM Users WHERE IsActive = 1");
  ```

  See also `references/patterns.md`.

## Batch Operations

- Dapper's `Execute` with an `IEnumerable` parameter runs one round-trip per item. For large batches, this is slow.

  ```csharp
  // Slow — 1000 round-trips
  await connection.ExecuteAsync(
      "INSERT INTO Products (Name, Price) VALUES (@Name, @Price)",
      thousandProducts);

  // Fast — single round-trip with SqlBulkCopy
  using var bulkCopy = new SqlBulkCopy(connection);
  bulkCopy.DestinationTableName = "Products";
  await bulkCopy.WriteToServerAsync(dataTable);
  ```

  Alternatively, use table-valued parameters for stored procedures (see `references/type-handling.md`).

## Avoid Repeated Parse Overhead

- Call `AsList()` instead of `ToList()` on Dapper results when you just need a `List<T>`. Dapper's buffered result is already a `List<T>` internally — `AsList()` avoids copying.

  ```csharp
  // Before — copies the internal list into a new list
  var products = (await connection.QueryAsync<Product>(sql)).ToList();

  // After — casts the internal list directly (zero-copy)
  var products = (await connection.QueryAsync<Product>(sql)).AsList();
  ```
