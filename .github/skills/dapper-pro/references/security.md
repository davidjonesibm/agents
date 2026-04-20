# Security Best Practices

SQL injection prevention, parameterized query enforcement, and secure data access patterns. **SQL injection is the #1 risk with Dapper** because you write raw SQL — there is no query builder or LINQ to sanitize for you.

## CRITICAL: Always Use Parameterized Queries

- **NEVER concatenate or interpolate user input into SQL strings.** This is the single most important rule for Dapper security.

  ```csharp
  // DANGEROUS — SQL injection via string concatenation
  var sql = "SELECT * FROM Users WHERE Username = '" + username + "'";
  var user = await connection.QueryFirstOrDefaultAsync<User>(sql);

  // DANGEROUS — SQL injection via string interpolation
  var sql = $"SELECT * FROM Users WHERE Username = '{username}'";
  var user = await connection.QueryFirstOrDefaultAsync<User>(sql);

  // SAFE — parameterized query
  var sql = "SELECT * FROM Users WHERE Username = @Username";
  var user = await connection.QueryFirstOrDefaultAsync<User>(
      sql, new { Username = username });
  ```

  **Why:** An attacker submitting `' OR '1'='1` as the username bypasses authentication. With `'; DROP TABLE Users; --`, they destroy the table. Parameters are sent separately from the SQL command — the database engine never interprets parameter values as SQL syntax.

- This applies to ALL Dapper methods: `Query`, `Execute`, `QueryMultiple`, `ExecuteScalar`, etc.

## Dynamic SQL with Parameters

- When building dynamic SQL (conditional WHERE clauses), use `DynamicParameters` — never string-build the values.

  ```csharp
  // Before — building values into the SQL string
  var sql = "SELECT * FROM Products WHERE 1=1";
  if (minPrice.HasValue)
      sql += $" AND Price >= {minPrice.Value}";
  if (category != null)
      sql += $" AND Category = '{category}'";
  var products = await connection.QueryAsync<Product>(sql);

  // After — parameterized dynamic SQL
  var sql = "SELECT * FROM Products WHERE 1=1";
  var parameters = new DynamicParameters();
  if (minPrice.HasValue)
  {
      sql += " AND Price >= @MinPrice";
      parameters.Add("MinPrice", minPrice.Value);
  }
  if (category != null)
  {
      sql += " AND Category = @Category";
      parameters.Add("Category", category);
  }
  var products = await connection.QueryAsync<Product>(sql, parameters);
  ```

## ORDER BY and Dynamic Column Names

- Parameters cannot be used for column names, table names, or SQL keywords. If you need dynamic ORDER BY, **validate against a whitelist** — never pass user input directly.

  ```csharp
  // DANGEROUS — user controls ORDER BY column
  var sql = $"SELECT * FROM Products ORDER BY {sortColumn}";

  // SAFE — whitelist-validated column name
  var allowedColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
  {
      "Name", "Price", "CreatedDate"
  };
  if (!allowedColumns.Contains(sortColumn))
      throw new ArgumentException($"Invalid sort column: {sortColumn}");

  var sql = $"SELECT * FROM Products ORDER BY {sortColumn}";
  var products = await connection.QueryAsync<Product>(sql);
  ```

  **Why:** SQL parameters only work for values, not identifiers. The whitelist approach is the only safe pattern for dynamic identifiers.

## LIKE Queries

- For `LIKE` queries, parameterize the value — never concatenate the wildcards with user input.

  ```csharp
  // DANGEROUS — wildcard + user input concatenation
  var sql = $"SELECT * FROM Products WHERE Name LIKE '%{search}%'";

  // SAFE — wildcards are part of the parameter value
  var sql = "SELECT * FROM Products WHERE Name LIKE @Search";
  var products = await connection.QueryAsync<Product>(
      sql, new { Search = $"%{search}%" });
  ```

## IN Clause Parameters

- Use Dapper's built-in list expansion instead of manually joining values. See also `references/patterns.md`.

  ```csharp
  // DANGEROUS — manual string join
  var ids = string.Join(",", userIds);
  var sql = $"SELECT * FROM Users WHERE Id IN ({ids})";

  // SAFE — Dapper auto-expands
  var sql = "SELECT * FROM Users WHERE Id IN @UserIds";
  var users = await connection.QueryAsync<User>(sql, new { UserIds = userIds });
  ```

## Stored Procedure Security

- When calling stored procedures, always use `commandType: CommandType.StoredProcedure`. This prevents SQL injection through the procedure name itself.

  ```csharp
  // Risky — if procName is user-controlled
  var result = await connection.QueryAsync<User>(procName, parameters);

  // Safe — stored procedure command type
  var result = await connection.QueryAsync<User>(
      procName,
      parameters,
      commandType: CommandType.StoredProcedure);
  ```

## DbString for Varchar Columns

- Use `DbString` when querying varchar (ANSI) columns on SQL Server to prevent implicit type conversion that kills index usage.

  ```csharp
  // Before — sends as nvarchar, causes implicit conversion on varchar column
  var user = await connection.QueryFirstOrDefaultAsync<User>(
      "SELECT * FROM Users WHERE Code = @Code",
      new { Code = code });

  // After — sends as varchar, matches column type
  var user = await connection.QueryFirstOrDefaultAsync<User>(
      "SELECT * FROM Users WHERE Code = @Code",
      new { Code = new DbString { Value = code, IsAnsi = true, Length = 20 } });
  ```

  See also `references/performance.md` for the performance implications.

## Credential Handling

- Never log or expose connection strings. Store them in environment variables, user secrets, or a vault — never in source code.

  ```csharp
  // DANGEROUS — hardcoded connection string
  using var connection = new SqlConnection(
      "Server=prod;Database=app;User=sa;Password=P@ssw0rd");

  // Safe — from configuration
  using var connection = new SqlConnection(
      configuration.GetConnectionString("DefaultConnection"));
  ```
