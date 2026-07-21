---
name: dapper-pro
description: >-
  Comprehensively reviews Dapper code for best practices on query methods, parameterized
  queries, multi-mapping, transactions, type handlers, connection management, SQL injection
  prevention, performance, and testing patterns. Use when reading, writing, or reviewing
  .NET projects that use Dapper or Dapper.Contrib for data access.
---

Review Dapper data access code for correctness, security, performance, and adherence to best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check for correct query method usage and async patterns using `references/api.md`.
2. Validate connection management, anti-patterns, and idiomatic Dapper usage using `references/patterns.md`.
3. Check for SQL injection vulnerabilities and parameter handling using `references/security.md`.
4. Review multi-mapping, splitOn usage, and multiple result sets using `references/multi-mapping.md`.
5. Validate transaction handling and lifecycle management using `references/transactions.md`.
6. Check custom type handlers, DynamicParameters, and TVPs using `references/type-handling.md`.
7. Check performance best practices (buffering, caching, CommandDefinition) using `references/performance.md`.
8. Validate data access abstraction and testing patterns using `references/testing.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **Dapper 2.1+** on **.NET 8+** (modern C# with nullable reference types).
- All code examples use C# with `async`/`await` and `using` declarations.
- **Always use parameterized queries** — never concatenate user input into SQL strings.
- Prefer async methods (`QueryAsync`, `ExecuteAsync`, etc.) in web applications.
- Always dispose connections — use `using` statements or `using` declarations.
- Dapper extends `IDbConnection` / `DbConnection` — it does not replace ADO.NET.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated (e.g., "Always use parameterized queries — never concatenate SQL").
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

Example output:

### Repositories/OrderRepository.cs

**Line 24: Always use parameterized queries — never concatenate user input into SQL.**

```csharp
// Before
var sql = "SELECT * FROM Orders WHERE CustomerId = " + customerId;
var orders = await connection.QueryAsync<Order>(sql);

// After
var sql = "SELECT * FROM Orders WHERE CustomerId = @CustomerId";
var orders = await connection.QueryAsync<Order>(sql, new { CustomerId = customerId });
```
