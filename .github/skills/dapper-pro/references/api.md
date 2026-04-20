# Core API Reference

Correct usage of Dapper's query and execute extension methods, including async variants and method selection guidance.

## Query Method Selection

- Use the correct query method for the expected result cardinality. Misusing them causes silent bugs or unnecessary exceptions.

  | Method                    | Returns                      | Throws if    |
  | ------------------------- | ---------------------------- | ------------ |
  | `Query<T>`                | `IEnumerable<T>` (0..N rows) | —            |
  | `QueryFirst<T>`           | First row                    | No rows      |
  | `QueryFirstOrDefault<T>`  | First row or `default`       | —            |
  | `QuerySingle<T>`          | Exactly one row              | 0 or 2+ rows |
  | `QuerySingleOrDefault<T>` | One row or `default`         | 2+ rows      |
  | `Execute`                 | `int` (rows affected)        | —            |
  | `ExecuteScalar<T>`        | First column of first row    | —            |

  ```csharp
  // Before — Query + FirstOrDefault is wasteful; buffering all rows
  var user = (await connection.QueryAsync<User>(
      "SELECT * FROM Users WHERE Id = @Id", new { Id = id }))
      .FirstOrDefault();

  // After — QueryFirstOrDefaultAsync fetches only the first row
  var user = await connection.QueryFirstOrDefaultAsync<User>(
      "SELECT * FROM Users WHERE Id = @Id", new { Id = id });
  ```

- Use `QuerySingle` / `QuerySingleOrDefault` when business logic requires exactly one match (e.g., lookup by unique key). It throws on duplicates, surfacing data integrity bugs early.

  ```csharp
  // Before — silently returns first of duplicates
  var config = await connection.QueryFirstOrDefaultAsync<AppConfig>(
      "SELECT * FROM AppConfig WHERE Key = @Key", new { Key = key });

  // After — throws if duplicates exist, catching data bugs
  var config = await connection.QuerySingleOrDefaultAsync<AppConfig>(
      "SELECT * FROM AppConfig WHERE Key = @Key", new { Key = key });
  ```

## Async Methods

- Prefer async variants in web applications and async contexts. Every sync method has an async counterpart with an `Async` suffix.

  | Sync                      | Async                          |
  | ------------------------- | ------------------------------ |
  | `Query<T>`                | `QueryAsync<T>`                |
  | `QueryFirst<T>`           | `QueryFirstAsync<T>`           |
  | `QueryFirstOrDefault<T>`  | `QueryFirstOrDefaultAsync<T>`  |
  | `QuerySingle<T>`          | `QuerySingleAsync<T>`          |
  | `QuerySingleOrDefault<T>` | `QuerySingleOrDefaultAsync<T>` |
  | `QueryMultiple`           | `QueryMultipleAsync`           |
  | `Execute`                 | `ExecuteAsync`                 |
  | `ExecuteScalar<T>`        | `ExecuteScalarAsync<T>`        |
  | `ExecuteReader`           | `ExecuteReaderAsync`           |

  ```csharp
  // Before — blocking call in an async context (thread pool starvation risk)
  public async Task<List<Product>> GetProductsAsync()
  {
      using var connection = new SqlConnection(_connectionString);
      return connection.Query<Product>("SELECT * FROM Products").ToList();
  }

  // After — non-blocking async call
  public async Task<List<Product>> GetProductsAsync()
  {
      using var connection = new SqlConnection(_connectionString);
      var products = await connection.QueryAsync<Product>("SELECT * FROM Products");
      return products.ToList();
  }
  ```

  **Why:** Mixing sync Dapper calls inside async methods blocks the thread, reducing scalability under load.

## Execute Methods

- Use `Execute` / `ExecuteAsync` for INSERT, UPDATE, DELETE, and DDL statements. It returns the number of affected rows.

  ```csharp
  var affectedRows = await connection.ExecuteAsync(
      "UPDATE Products SET Price = @Price WHERE Id = @Id",
      new { Price = 19.99m, Id = productId });
  ```

- Use `ExecuteScalar<T>` / `ExecuteScalarAsync<T>` to retrieve a single scalar value (e.g., `SELECT COUNT(*)`, `SELECT SCOPE_IDENTITY()`).

  ```csharp
  var count = await connection.ExecuteScalarAsync<int>(
      "SELECT COUNT(*) FROM Products WHERE CategoryId = @CategoryId",
      new { CategoryId = categoryId });
  ```

## Bulk Execute

- Pass an `IEnumerable<T>` as the parameter to `Execute` to run the same command once per item. Dapper iterates internally.

  ```csharp
  // Before — manual loop with individual calls
  foreach (var product in products)
  {
      await connection.ExecuteAsync(
          "INSERT INTO Products (Name, Price) VALUES (@Name, @Price)", product);
  }

  // After — single call, Dapper iterates internally
  await connection.ExecuteAsync(
      "INSERT INTO Products (Name, Price) VALUES (@Name, @Price)", products);
  ```

  **Note:** This still issues one round-trip per row. For true bulk insert performance, use `SqlBulkCopy` or a table-valued parameter (see `references/type-handling.md`).

## ExecuteReader

- Use `ExecuteReader` / `ExecuteReaderAsync` when you need low-level `IDataReader` access for per-row type switching or streaming.

  ```csharp
  using var reader = await connection.ExecuteReaderAsync(
      "SELECT * FROM Shapes");

  var circleParser = reader.GetRowParser<IShape>(typeof(Circle));
  var squareParser = reader.GetRowParser<IShape>(typeof(Square));

  while (await reader.ReadAsync())
  {
      var type = (ShapeType)reader.GetInt32(reader.GetOrdinal("Type"));
      IShape shape = type switch
      {
          ShapeType.Circle => circleParser(reader),
          ShapeType.Square => squareParser(reader),
          _ => throw new InvalidOperationException($"Unknown shape type: {type}")
      };
      shapes.Add(shape);
  }
  ```

## Dynamic Queries

- Dapper can return `dynamic` objects when no generic type is specified. Avoid in production code — prefer strongly typed results.

  ```csharp
  // Before — dynamic results lose type safety and IntelliSense
  var rows = await connection.QueryAsync("SELECT Id, Name FROM Products");
  foreach (var row in rows)
  {
      Console.WriteLine(row.Name); // no compile-time check
  }

  // After — strongly typed
  var products = await connection.QueryAsync<Product>(
      "SELECT Id, Name FROM Products");
  foreach (var product in products)
  {
      Console.WriteLine(product.Name); // compile-time checked
  }
  ```
