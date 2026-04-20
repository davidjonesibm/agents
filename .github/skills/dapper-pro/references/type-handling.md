# Type Handling and Parameters

Custom type handlers, DynamicParameters, table-valued parameters (TVPs), and advanced parameter patterns.

## Anonymous Type Parameters

- The most common way to pass parameters. Property names map to SQL parameter names (prefixed with `@`).

  ```csharp
  var sql = "SELECT * FROM Users WHERE Name = @Name AND Age > @MinAge";
  var users = await connection.QueryAsync<User>(
      sql, new { Name = "Alice", MinAge = 21 });
  ```

## DynamicParameters

- Use `DynamicParameters` when parameters are built conditionally or you need output/return parameters.

  ```csharp
  // Basic usage
  var parameters = new DynamicParameters();
  parameters.Add("CustomerId", customerId, DbType.Int32);
  parameters.Add("Status", status, DbType.String, size: 50);

  var orders = await connection.QueryAsync<Order>(
      "SELECT * FROM Orders WHERE CustomerId = @CustomerId AND Status = @Status",
      parameters);
  ```

- **Composing parameters from multiple sources:**

  ```csharp
  var parameters = new DynamicParameters(baseFilter);  // from an object
  parameters.AddDynamicParams(additionalFilter);       // merge another object
  parameters.Add("ExtraParam", value);                 // add individual param
  ```

## Output and Return Parameters

- Use `DynamicParameters.Add` with `direction` for stored procedure output/return values.

  ```csharp
  var parameters = new DynamicParameters();
  parameters.Add("OrderId", orderId, DbType.Int32);
  parameters.Add("Total", dbType: DbType.Decimal,
      direction: ParameterDirection.Output);
  parameters.Add("ReturnValue", dbType: DbType.Int32,
      direction: ParameterDirection.ReturnValue);

  await connection.ExecuteAsync(
      "spCalculateTotal",
      parameters,
      commandType: CommandType.StoredProcedure);

  var total = parameters.Get<decimal>("Total");
  var returnCode = parameters.Get<int>("ReturnValue");
  ```

## Custom Type Handlers (SqlMapper.TypeHandler)

- Implement `SqlMapper.TypeHandler<T>` to teach Dapper how to read/write types it does not natively support (e.g., JSON columns, value objects, enums stored as strings).

  ```csharp
  // Before — manual serialization scattered across queries
  var json = JsonSerializer.Serialize(address);
  await connection.ExecuteAsync(
      "INSERT INTO Users (Name, AddressJson) VALUES (@Name, @Address)",
      new { Name = name, Address = json });

  // After — type handler encapsulates serialization
  public class JsonTypeHandler<T> : SqlMapper.TypeHandler<T> where T : class
  {
      public override void SetValue(IDbDataParameter parameter, T? value)
      {
          parameter.Value = value is null
              ? DBNull.Value
              : JsonSerializer.Serialize(value);
          parameter.DbType = DbType.String;
      }

      public override T? Parse(object value)
      {
          return value is string s
              ? JsonSerializer.Deserialize<T>(s)
              : default;
      }
  }

  // Register once at startup
  SqlMapper.AddTypeHandler(new JsonTypeHandler<Address>());

  // Now Dapper handles serialization transparently
  await connection.ExecuteAsync(
      "INSERT INTO Users (Name, AddressJson) VALUES (@Name, @AddressJson)",
      new { Name = name, AddressJson = address });

  var user = await connection.QueryFirstAsync<User>(
      "SELECT * FROM Users WHERE Id = @Id", new { Id = id });
  // user.AddressJson is deserialized automatically
  ```

- **Register type handlers once at application startup**, before any Dapper calls. Registration in `SqlMapper` is global and static.

## Table-Valued Parameters (TVPs)

- Use TVPs to pass structured data sets to SQL Server stored procedures efficiently. This is far more efficient than expanding large `IN` clauses.

  ```sql
  -- Step 1: Create a user-defined table type in SQL Server
  CREATE TYPE dbo.IdListType AS TABLE (Id INT);
  ```

  ```csharp
  // Step 2: Create a DataTable matching the type
  var idTable = new DataTable();
  idTable.Columns.Add("Id", typeof(int));
  foreach (var id in productIds)
      idTable.Rows.Add(id);

  // Step 3: Pass as TVP via DynamicParameters
  var parameters = new DynamicParameters();
  parameters.Add("Ids", idTable.AsTableValuedParameter("dbo.IdListType"));

  var products = await connection.QueryAsync<Product>(
      "spGetProductsByIds",
      parameters,
      commandType: CommandType.StoredProcedure);
  ```

  **Why:** Dapper's auto-expansion of `IN @Ids` generates one parameter per item (`@Ids1, @Ids2, ...`). SQL Server has a limit of ~2100 parameters. TVPs have no practical row limit and perform better for large data sets. See also `references/patterns.md`.

## DbString for Varchar

- Use `DbString` to control ANSI vs Unicode string parameter types. Critical on SQL Server where `nvarchar` parameters against `varchar` columns cause implicit conversion and prevent index seeks.

  ```csharp
  // Before — default nvarchar parameter causes index scan on varchar column
  var result = await connection.QueryFirstOrDefaultAsync<Product>(
      "SELECT * FROM Products WHERE Sku = @Sku",
      new { Sku = skuValue });

  // After — DbString forces varchar, enables index seek
  var result = await connection.QueryFirstOrDefaultAsync<Product>(
      "SELECT * FROM Products WHERE Sku = @Sku",
      new { Sku = new DbString { Value = skuValue, IsAnsi = true, Length = 50 } });
  ```

  See also `references/security.md` and `references/performance.md` for related implications.

## Enum Handling

- Dapper maps enums to/from their underlying integer value by default. If the database stores enums as strings, use a type handler.

  ```csharp
  // Default — enum stored as int in DB
  public enum OrderStatus { Pending = 0, Shipped = 1, Delivered = 2 }
  // Dapper maps automatically: int column ↔ OrderStatus

  // String-stored enum — requires a type handler
  public class StringEnumTypeHandler<T> : SqlMapper.TypeHandler<T> where T : struct, Enum
  {
      public override void SetValue(IDbDataParameter parameter, T value)
      {
          parameter.Value = value.ToString();
          parameter.DbType = DbType.String;
      }

      public override T Parse(object value)
      {
          return Enum.Parse<T>((string)value);
      }
  }

  // Register at startup
  SqlMapper.AddTypeHandler(new StringEnumTypeHandler<OrderStatus>());
  ```

## CommandDefinition

- Use `CommandDefinition` for advanced scenarios: passing `CancellationToken`, controlling `CommandFlags`, or combining command parameters.

  ```csharp
  // Before — no cancellation support
  var products = await connection.QueryAsync<Product>(sql, parameters);

  // After — cancellation-aware query
  var command = new CommandDefinition(
      commandText: sql,
      parameters: parameters,
      cancellationToken: cancellationToken);

  var products = await connection.QueryAsync<Product>(command);
  ```

  **Why:** In web applications, you should propagate `CancellationToken` from the HTTP request to cancel in-flight queries when a client disconnects. See also `references/performance.md`.
