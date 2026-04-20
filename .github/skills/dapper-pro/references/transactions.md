# Transaction Handling

Patterns for managing database transactions with Dapper, including `IDbTransaction`, `TransactionScope`, and async transactions.

## Basic Transaction Pattern

- Open the connection explicitly before beginning a transaction. Pass the transaction to every Dapper call within the scope.

  ```csharp
  // Before — no transaction, partial writes on failure
  using var connection = new SqlConnection(connectionString);
  await connection.ExecuteAsync(
      "INSERT INTO Orders (CustomerId, Total) VALUES (@CustomerId, @Total)", order);
  await connection.ExecuteAsync(
      "INSERT INTO OrderItems (OrderId, ProductId, Qty) VALUES (@OrderId, @ProductId, @Qty)", items);
  // If second call fails, the order exists without items

  // After — atomic transaction
  using var connection = new SqlConnection(connectionString);
  await connection.OpenAsync();

  using var transaction = await connection.BeginTransactionAsync();
  try
  {
      await connection.ExecuteAsync(
          "INSERT INTO Orders (CustomerId, Total) VALUES (@CustomerId, @Total)",
          order,
          transaction: transaction);

      await connection.ExecuteAsync(
          "INSERT INTO OrderItems (OrderId, ProductId, Qty) VALUES (@OrderId, @ProductId, @Qty)",
          items,
          transaction: transaction);

      await transaction.CommitAsync();
  }
  catch
  {
      await transaction.RollbackAsync();
      throw;
  }
  ```

## Always Pass the Transaction

- Every Dapper call within a transaction must receive the `transaction` parameter. If you omit it, the call runs outside the transaction on a separate implicit connection scope.

  ```csharp
  // WRONG — Execute runs outside the transaction
  using var transaction = await connection.BeginTransactionAsync();
  await connection.ExecuteAsync(
      "INSERT INTO Logs (Message) VALUES (@Message)",
      new { Message = "Order created" });  // missing transaction parameter!
  await transaction.CommitAsync();

  // CORRECT — transaction parameter passed
  await connection.ExecuteAsync(
      "INSERT INTO Logs (Message) VALUES (@Message)",
      new { Message = "Order created" },
      transaction: transaction);
  ```

## Explicit Rollback

- Do not rely solely on `using` to auto-rollback. Some ADO.NET providers do not auto-rollback on dispose. Always call `Rollback()` explicitly in the catch block.

  ```csharp
  // RISKY — relies on provider dispose behavior
  using var connection = new SqlConnection(connectionString);
  await connection.OpenAsync();
  using var transaction = await connection.BeginTransactionAsync();
  await connection.ExecuteAsync(sql, param, transaction: transaction);
  // if exception here, dispose may or may not rollback

  // SAFE — explicit rollback
  using var connection = new SqlConnection(connectionString);
  await connection.OpenAsync();
  using var transaction = await connection.BeginTransactionAsync();
  try
  {
      await connection.ExecuteAsync(sql, param, transaction: transaction);
      await transaction.CommitAsync();
  }
  catch
  {
      await transaction.RollbackAsync();
      throw;
  }
  ```

## TransactionScope

- `TransactionScope` provides an ambient transaction that automatically enlists connections. Useful when you cannot easily thread an `IDbTransaction` through multiple method calls.

  ```csharp
  using var scope = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled);

  using (var connection = new SqlConnection(connectionString))
  {
      await connection.ExecuteAsync(
          "INSERT INTO Orders (CustomerId) VALUES (@CustomerId)", order);
  }

  using (var connection = new SqlConnection(connectionString))
  {
      await connection.ExecuteAsync(
          "INSERT INTO AuditLog (Action) VALUES (@Action)",
          new { Action = "OrderCreated" });
  }

  scope.Complete(); // commits both operations atomically
  ```

- **Always pass `TransactionScopeAsyncFlowOption.Enabled`** when using async/await. Without it, the ambient transaction does not flow across await points.

  ```csharp
  // BROKEN — transaction does not flow across await
  using var scope = new TransactionScope();
  await connection.ExecuteAsync(sql, param); // runs outside the scope!

  // CORRECT — async flow enabled
  using var scope = new TransactionScope(
      TransactionScopeAsyncFlowOption.Enabled);
  await connection.ExecuteAsync(sql, param); // properly enlisted
  ```

## Transaction Lifetime

- Keep transactions as short as possible. Long-running transactions hold locks and reduce concurrency.

  ```csharp
  // Before — transaction spans HTTP call (long lock duration)
  using var transaction = await connection.BeginTransactionAsync();
  await connection.ExecuteAsync(insertSql, data, transaction: transaction);
  var result = await httpClient.PostAsync(externalApi, content); // slow!
  await connection.ExecuteAsync(updateSql, result, transaction: transaction);
  await transaction.CommitAsync();

  // After — external call outside transaction
  var result = await httpClient.PostAsync(externalApi, content);
  using var transaction = await connection.BeginTransactionAsync();
  await connection.ExecuteAsync(insertSql, data, transaction: transaction);
  await connection.ExecuteAsync(updateSql, result, transaction: transaction);
  await transaction.CommitAsync();
  ```

## Stored Procedures in Transactions

- Stored procedures can participate in transactions. Pass the transaction as you would for any other call.

  ```csharp
  using var transaction = await connection.BeginTransactionAsync();
  try
  {
      await connection.ExecuteAsync(
          "spCreateOrder",
          new { CustomerId = customerId, Total = total },
          transaction: transaction,
          commandType: CommandType.StoredProcedure);

      await transaction.CommitAsync();
  }
  catch
  {
      await transaction.RollbackAsync();
      throw;
  }
  ```
