# Multi-Mapping and Multiple Result Sets

Mapping a single row to multiple objects (JOINs) and reading multiple result grids from a single query.

## Multi-Mapping Basics

- Use multi-mapping to map JOIN results to nested objects. Provide type arguments in order: `<TFirst, TSecond, TReturn>`.

  ```csharp
  // Before — two separate queries (N+1 problem)
  var orders = await connection.QueryAsync<Order>(
      "SELECT * FROM Orders WHERE CustomerId = @Id", new { Id = customerId });
  foreach (var order in orders)
  {
      order.Customer = await connection.QueryFirstAsync<Customer>(
          "SELECT * FROM Customers WHERE Id = @Id", new { Id = order.CustomerId });
  }

  // After — single JOIN query with multi-mapping
  var sql = @"
      SELECT o.*, c.*
      FROM Orders o
      INNER JOIN Customers c ON c.Id = o.CustomerId
      WHERE o.CustomerId = @CustomerId";

  var orders = await connection.QueryAsync<Order, Customer, Order>(
      sql,
      (order, customer) =>
      {
          order.Customer = customer;
          return order;
      },
      new { CustomerId = customerId },
      splitOn: "Id");
  ```

## splitOn Parameter

- `splitOn` tells Dapper where to split columns between objects. The default is `"Id"`. If your primary key column has a different name, you must specify it.

  ```csharp
  // Before — wrong split point, second object gets wrong columns
  var data = await connection.QueryAsync<Post, Author, Post>(
      "SELECT p.*, a.* FROM Posts p JOIN Authors a ON a.AuthorId = p.AuthorId",
      (post, author) => { post.Author = author; return post; });
  // Fails — Dapper splits on "Id" but Author PK is "AuthorId"

  // After — explicit splitOn matching the second object's first column
  var data = await connection.QueryAsync<Post, Author, Post>(
      "SELECT p.*, a.* FROM Posts p JOIN Authors a ON a.AuthorId = p.AuthorId",
      (post, author) => { post.Author = author; return post; },
      splitOn: "AuthorId");
  ```

- For multiple splits (3+ types), separate column names with commas.

  ```csharp
  // Three types: Post, Author, Tag — two split points
  var sql = @"
      SELECT p.PostId, p.Title, a.AuthorId, a.Name, t.TagId, t.TagName
      FROM Posts p
      INNER JOIN Authors a ON p.AuthorId = a.AuthorId
      INNER JOIN PostTags pt ON pt.PostId = p.PostId
      INNER JOIN Tags t ON t.TagId = pt.TagId";

  var posts = await connection.QueryAsync<Post, Author, Tag, Post>(
      sql,
      (post, author, tag) =>
      {
          post.Author = author;
          post.Tags.Add(tag);
          return post;
      },
      splitOn: "AuthorId,TagId");
  ```

## One-to-Many Grouping

- Multi-mapping returns one object per row. For one-to-many, you get duplicate parent objects. Use `GroupBy` to consolidate.

  ```csharp
  // Raw multi-map returns duplicate orders (one per line item)
  var sql = @"
      SELECT o.OrderId, o.OrderDate, li.LineItemId, li.ProductName, li.Quantity
      FROM Orders o
      INNER JOIN LineItems li ON li.OrderId = o.OrderId
      WHERE o.CustomerId = @CustomerId";

  var lookup = new Dictionary<int, Order>();

  await connection.QueryAsync<Order, LineItem, Order>(
      sql,
      (order, lineItem) =>
      {
          if (!lookup.TryGetValue(order.OrderId, out var existing))
          {
              existing = order;
              existing.LineItems = new List<LineItem>();
              lookup[order.OrderId] = existing;
          }
          existing.LineItems.Add(lineItem);
          return existing;
      },
      new { CustomerId = customerId },
      splitOn: "LineItemId");

  var orders = lookup.Values.ToList();
  ```

  **Why:** Without deduplication, you get N copies of the parent object — one for each child row.

## Multiple Result Sets (QueryMultiple)

- Use `QueryMultiple` / `QueryMultipleAsync` to execute multiple SELECT statements in a single round-trip. Read results in order with `Read<T>()`.

  ```csharp
  var sql = @"
      SELECT * FROM Customers WHERE Id = @Id;
      SELECT * FROM Orders WHERE CustomerId = @Id;
      SELECT * FROM Returns WHERE CustomerId = @Id;";

  using var multi = await connection.QueryMultipleAsync(sql, new { Id = customerId });

  var customer = await multi.ReadSingleAsync<Customer>();
  var orders = (await multi.ReadAsync<Order>()).ToList();
  var returns = (await multi.ReadAsync<Return>()).ToList();
  ```

- **Read results in the same order as the SELECT statements.** `GridReader` is forward-only — you cannot re-read or skip result sets.

  ```csharp
  // WRONG — reading in wrong order produces incorrect mappings
  using var multi = await connection.QueryMultipleAsync(@"
      SELECT * FROM Customers WHERE Id = @Id;
      SELECT * FROM Orders WHERE CustomerId = @Id;", new { Id = id });

  var orders = (await multi.ReadAsync<Order>()).ToList();   // reads Customer data into Order!
  var customer = await multi.ReadSingleAsync<Customer>();    // reads Order data into Customer!
  ```

- **Always dispose `GridReader`** — use a `using` statement. It holds the underlying `IDataReader` open.

## Multi-Mapping Limits

- Dapper supports up to 7 type arguments in multi-mapping (`Query<T1, T2, T3, T4, T5, T6, T7, TReturn>`). If you need more, consider restructuring the query or using `QueryMultiple` with separate reads.
