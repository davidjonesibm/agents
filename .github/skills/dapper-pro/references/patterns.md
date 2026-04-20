# Idiomatic Patterns and Anti-Patterns

Connection management, common mistakes, and idiomatic Dapper usage patterns.

## Connection Management

- **Always dispose connections** with `using` statements. Dapper does not manage connection lifetime — you do.

  ```csharp
  // Before — connection leak
  public async Task<User?> GetUserAsync(int id)
  {
      var connection = new SqlConnection(_connectionString);
      return await connection.QueryFirstOrDefaultAsync<User>(
          "SELECT * FROM Users WHERE Id = @Id", new { Id = id });
      // connection never disposed!
  }

  // After — using declaration ensures disposal
  public async Task<User?> GetUserAsync(int id)
  {
      using var connection = new SqlConnection(_connectionString);
      return await connection.QueryFirstOrDefaultAsync<User>(
          "SELECT * FROM Users WHERE Id = @Id", new { Id = id });
  }
  ```

  **Why:** Undisposed connections exhaust the connection pool, causing `SqlException: Timeout expired` under load.

- **Dapper opens connections automatically** when they are closed. You do not need to call `connection.Open()` before query methods. However, if you need a transaction, you must open explicitly first.

  ```csharp
  // Unnecessary — Dapper opens automatically
  using var connection = new SqlConnection(_connectionString);
  connection.Open(); // not needed for simple queries
  var users = await connection.QueryAsync<User>("SELECT * FROM Users");

  // Sufficient — Dapper handles Open/Close
  using var connection = new SqlConnection(_connectionString);
  var users = await connection.QueryAsync<User>("SELECT * FROM Users");
  ```

- **Do not share a single connection across concurrent async calls.** `DbConnection` is not thread-safe. Create a new connection per unit of work.

  ```csharp
  // DANGEROUS — shared connection across concurrent tasks
  var tasks = ids.Select(id =>
      _sharedConnection.QueryFirstOrDefaultAsync<User>(
          "SELECT * FROM Users WHERE Id = @Id", new { Id = id }));
  await Task.WhenAll(tasks);

  // Safe — each task gets its own connection
  var tasks = ids.Select(async id =>
  {
      using var connection = new SqlConnection(_connectionString);
      return await connection.QueryFirstOrDefaultAsync<User>(
          "SELECT * FROM Users WHERE Id = @Id", new { Id = id });
  });
  await Task.WhenAll(tasks);
  ```

## Connection Pooling

- ADO.NET pools connections automatically by connection string. Creating `new SqlConnection(...)` is cheap — it reuses pooled physical connections. Do not try to optimize by caching or reusing `SqlConnection` instances.

- **Do not store connections in singleton services.** Create a fresh connection per request or per unit of work. DI-registered `DbConnection` should be scoped, not singleton.

  ```csharp
  // Before — singleton connection (thread-unsafe, pool-defeating)
  services.AddSingleton<IDbConnection>(
      new SqlConnection(connectionString));

  // After — factory-based, scoped
  services.AddScoped<IDbConnection>(_ =>
      new SqlConnection(connectionString));
  ```

## SELECT \* Avoidance

- Prefer selecting only the columns you need. `SELECT *` fetches unused data and breaks if columns are added.

  ```csharp
  // Before — pulls all columns including large text/blob
  var users = await connection.QueryAsync<UserSummary>(
      "SELECT * FROM Users");

  // After — only needed columns
  var users = await connection.QueryAsync<UserSummary>(
      "SELECT Id, Name, Email FROM Users");
  ```

## Column-to-Property Mapping

- Dapper maps columns to properties by name (case-insensitive). If column and property names differ, use SQL aliases — not string manipulation.

  ```csharp
  // Before — property won't map (column is user_name, property is UserName)
  var users = await connection.QueryAsync<User>(
      "SELECT user_name FROM Users");
  // user.UserName will be null!

  // After — alias to match property name
  var users = await connection.QueryAsync<User>(
      "SELECT user_name AS UserName FROM Users");
  ```

- Alternatively, use `Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true` to enable automatic snake_case → PascalCase mapping globally.

  ```csharp
  // Startup configuration — enables snake_case mapping
  Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;
  ```

## Stored Procedures

- Use `commandType: CommandType.StoredProcedure` when calling stored procedures. Without it, Dapper treats the proc name as raw SQL.

  ```csharp
  // Before — fails or behaves unexpectedly
  var user = await connection.QueryFirstOrDefaultAsync<User>(
      "spGetUser", new { Id = 1 });

  // After — explicit command type
  var user = await connection.QueryFirstOrDefaultAsync<User>(
      "spGetUser",
      new { Id = 1 },
      commandType: CommandType.StoredProcedure);
  ```

## List / IN Clause Support

- Dapper auto-expands `IEnumerable` parameters in `IN` clauses. Pass the collection directly — do not manually build comma-separated lists.

  ```csharp
  // Before — manual string building (SQL injection risk!)
  var ids = string.Join(",", productIds);
  var sql = $"SELECT * FROM Products WHERE Id IN ({ids})";
  var products = await connection.QueryAsync<Product>(sql);

  // After — Dapper auto-expands
  var products = await connection.QueryAsync<Product>(
      "SELECT * FROM Products WHERE Id IN @Ids",
      new { Ids = productIds });
  ```

  **Note:** Dapper expands to individual parameters (`@Ids1, @Ids2, ...`). For large lists (2000+ items), prefer a table-valued parameter (see `references/type-handling.md`) to avoid parameter limit issues.

## Literal Replacements

- Dapper supports literal replacements with the `{=propertyName}` syntax for bool and numeric values. The value is injected directly into SQL — **not parameterized**.

  ```csharp
  // Literal replacement — value is inlined, not parameterized
  connection.Query("SELECT * FROM Users WHERE IsActive = {=IsActive}",
      new { IsActive = true });
  // Generates: SELECT * FROM Users WHERE IsActive = 1
  ```

  Use only for fixed/constant values (status codes, flags). **Never use for user input.** See also `references/security.md`.

## Common Anti-Patterns

- **String concatenation for SQL** — always use parameters (see `references/security.md`).
- **Not disposing connections** — always use `using`.
- **Sync-over-async** — never call `.Result` or `.Wait()` on async Dapper methods.
- **Caching query results in the connection** — Dapper caches internally by SQL text; do not try to cache at the connection level.
- **Opening connections too early** — open just before use, not at service construction time.
