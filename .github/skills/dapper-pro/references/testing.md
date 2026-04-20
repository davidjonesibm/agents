# Testing Patterns

Abstracting Dapper data access for testability, integration testing strategies, and mocking approaches.

## Abstract Data Access Behind Interfaces

- Dapper extends `IDbConnection` directly — there is no built-in repository or unit-of-work abstraction. Wrap data access in repository interfaces to enable testing.

  ```csharp
  // Before — Dapper calls embedded in business logic (untestable)
  public class OrderService
  {
      private readonly string _connectionString;

      public async Task<Order?> GetOrderAsync(int id)
      {
          using var connection = new SqlConnection(_connectionString);
          return await connection.QueryFirstOrDefaultAsync<Order>(
              "SELECT * FROM Orders WHERE Id = @Id", new { Id = id });
      }
  }

  // After — repository interface decouples data access
  public interface IOrderRepository
  {
      Task<Order?> GetByIdAsync(int id);
      Task<IReadOnlyList<Order>> GetByCustomerAsync(int customerId);
      Task<int> CreateAsync(Order order);
  }

  public class DapperOrderRepository : IOrderRepository
  {
      private readonly string _connectionString;

      public DapperOrderRepository(string connectionString)
          => _connectionString = connectionString;

      public async Task<Order?> GetByIdAsync(int id)
      {
          using var connection = new SqlConnection(_connectionString);
          return await connection.QueryFirstOrDefaultAsync<Order>(
              "SELECT * FROM Orders WHERE Id = @Id", new { Id = id });
      }

      public async Task<IReadOnlyList<Order>> GetByCustomerAsync(int customerId)
      {
          using var connection = new SqlConnection(_connectionString);
          var orders = await connection.QueryAsync<Order>(
              "SELECT * FROM Orders WHERE CustomerId = @CustomerId",
              new { CustomerId = customerId });
          return orders.AsList();
      }

      public async Task<int> CreateAsync(Order order)
      {
          using var connection = new SqlConnection(_connectionString);
          return await connection.ExecuteScalarAsync<int>(@"
              INSERT INTO Orders (CustomerId, Total, CreatedDate)
              VALUES (@CustomerId, @Total, @CreatedDate);
              SELECT CAST(SCOPE_IDENTITY() AS INT);", order);
      }
  }

  // Service depends on the interface — testable
  public class OrderService
  {
      private readonly IOrderRepository _orderRepository;

      public OrderService(IOrderRepository orderRepository)
          => _orderRepository = orderRepository;

      public async Task<OrderDto?> GetOrderAsync(int id)
      {
          var order = await _orderRepository.GetByIdAsync(id);
          return order is null ? null : MapToDto(order);
      }
  }
  ```

## Unit Testing with Mocked Repositories

- Mock the repository interface — not the Dapper calls. This keeps tests fast and isolated.

  ```csharp
  // xUnit + Moq example
  public class OrderServiceTests
  {
      [Fact]
      public async Task GetOrderAsync_ReturnsNull_WhenNotFound()
      {
          var mockRepo = new Mock<IOrderRepository>();
          mockRepo.Setup(r => r.GetByIdAsync(999))
              .ReturnsAsync((Order?)null);

          var service = new OrderService(mockRepo.Object);

          var result = await service.GetOrderAsync(999);

          Assert.Null(result);
      }

      [Fact]
      public async Task GetOrderAsync_ReturnsDto_WhenFound()
      {
          var order = new Order { Id = 1, CustomerId = 42, Total = 99.99m };
          var mockRepo = new Mock<IOrderRepository>();
          mockRepo.Setup(r => r.GetByIdAsync(1))
              .ReturnsAsync(order);

          var service = new OrderService(mockRepo.Object);

          var result = await service.GetOrderAsync(1);

          Assert.NotNull(result);
          Assert.Equal(1, result.Id);
      }
  }
  ```

## Integration Testing with Real Databases

- For repository-level tests, use a real database. Dapper is pure SQL — there is no in-memory provider. Use a disposable database (Docker container, LocalDB, or SQLite in-memory).

  ```csharp
  // Integration test with SQLite in-memory
  public class DapperOrderRepositoryTests : IDisposable
  {
      private readonly SqliteConnection _connection;
      private readonly DapperOrderRepository _repository;

      public DapperOrderRepositoryTests()
      {
          _connection = new SqliteConnection("Data Source=:memory:");
          _connection.Open();

          // Create schema
          _connection.Execute(@"
              CREATE TABLE Orders (
                  Id INTEGER PRIMARY KEY AUTOINCREMENT,
                  CustomerId INTEGER NOT NULL,
                  Total DECIMAL(18,2) NOT NULL,
                  CreatedDate TEXT NOT NULL
              )");

          _repository = new DapperOrderRepository(_connection);
      }

      [Fact]
      public async Task CreateAsync_ReturnsNewId()
      {
          var order = new Order
          {
              CustomerId = 1,
              Total = 49.99m,
              CreatedDate = DateTime.UtcNow
          };

          var id = await _repository.CreateAsync(order);

          Assert.True(id > 0);
      }

      public void Dispose() => _connection.Dispose();
  }
  ```

- **Rolling back after each test:** Wrap each test in a transaction that is rolled back to ensure test isolation.

  ```csharp
  public class TransactionalTestBase : IDisposable
  {
      protected readonly SqlConnection Connection;
      private readonly IDbTransaction _transaction;

      protected TransactionalTestBase(string connectionString)
      {
          Connection = new SqlConnection(connectionString);
          Connection.Open();
          _transaction = Connection.BeginTransaction();
      }

      protected IDbTransaction Transaction => _transaction;

      public void Dispose()
      {
          _transaction.Rollback();
          _transaction.Dispose();
          Connection.Dispose();
      }
  }
  ```

## Do Not Mock IDbConnection

- Avoid mocking `IDbConnection` or `DbConnection` directly — Dapper's extension methods are static and difficult to intercept. Mock at the repository boundary instead.

  ```csharp
  // BAD — trying to mock Dapper extension methods
  var mockConnection = new Mock<IDbConnection>();
  // Cannot easily set up QueryAsync<T> — it's a static extension method

  // GOOD — mock the repository interface
  var mockRepo = new Mock<IOrderRepository>();
  mockRepo.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(expectedOrder);
  ```

## Connection Factory Pattern

- If your repository needs a connection per method call, inject a factory or connection string rather than a concrete connection.

  ```csharp
  public interface IDbConnectionFactory
  {
      DbConnection CreateConnection();
  }

  public class SqlConnectionFactory : IDbConnectionFactory
  {
      private readonly string _connectionString;

      public SqlConnectionFactory(string connectionString)
          => _connectionString = connectionString;

      public DbConnection CreateConnection()
          => new SqlConnection(_connectionString);
  }

  // Repository uses factory
  public class DapperOrderRepository : IOrderRepository
  {
      private readonly IDbConnectionFactory _connectionFactory;

      public DapperOrderRepository(IDbConnectionFactory connectionFactory)
          => _connectionFactory = connectionFactory;

      public async Task<Order?> GetByIdAsync(int id)
      {
          using var connection = _connectionFactory.CreateConnection();
          return await connection.QueryFirstOrDefaultAsync<Order>(
              "SELECT * FROM Orders WHERE Id = @Id", new { Id = id });
      }
  }

  // DI registration
  services.AddSingleton<IDbConnectionFactory>(
      new SqlConnectionFactory(connectionString));
  services.AddScoped<IOrderRepository, DapperOrderRepository>();
  ```
