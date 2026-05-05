# Built-in Modules

Pre-configured Testcontainers modules for popular services. All modules provide `GetConnectionString()` and sensible defaults.

## Available Modules (Selected)

| Module        | NuGet Package                  | Default Image                                           |
| ------------- | ------------------------------ | ------------------------------------------------------- |
| PostgreSQL    | `Testcontainers.PostgreSql`    | `postgres:15.1`                                         |
| SQL Server    | `Testcontainers.MsSql`         | `mcr.microsoft.com/mssql/server:2022-CU14-ubuntu-22.04` |
| MySQL         | `Testcontainers.MySql`         | `mysql:8.0`                                             |
| MariaDB       | `Testcontainers.MariaDb`       | `mariadb:10.10`                                         |
| MongoDB       | `Testcontainers.MongoDb`       | `mongo:6.0`                                             |
| Redis         | `Testcontainers.Redis`         | `redis:7.0`                                             |
| Kafka         | `Testcontainers.Kafka`         | `confluentinc/cp-kafka:6.1.9`                           |
| RabbitMQ      | `Testcontainers.RabbitMq`      | `rabbitmq:3.11`                                         |
| Elasticsearch | `Testcontainers.Elasticsearch` | `elasticsearch:8.6.1`                                   |
| LocalStack    | `Testcontainers.LocalStack`    | `localstack/localstack:2.0`                             |
| Azurite       | `Testcontainers.Azurite`       | `mcr.microsoft.com/azure-storage/azurite:3.24.0`        |
| Keycloak      | `Testcontainers.Keycloak`      | `quay.io/keycloak/keycloak:21.1`                        |
| Ollama        | `Testcontainers.Ollama`        | `ollama/ollama:0.6.6`                                   |
| WireMock      | `Testcontainers.WireMock`      | (embedded)                                              |

Full list: https://dotnet.testcontainers.org/modules/

## PostgreSQL

```csharp
dotnet add package Testcontainers.PostgreSql

// Usage
var postgres = new PostgreSqlBuilder()
    .WithImage("postgres:15.1")
    .WithDatabase("mydb")
    .WithUsername("testuser")
    .WithPassword("testpassword")
    .Build();

await postgres.StartAsync();
var cs = postgres.GetConnectionString();
// "Host=localhost;Port=54321;Database=mydb;Username=testuser;Password=testpassword"

// Seed with init scripts (auto-executed by the Postgres image)
var postgres = new PostgreSqlBuilder()
    .WithImage("postgres:15.1")
    .WithResourceMapping("schema.sql", "/docker-entrypoint-initdb.d/")
    .Build();
```

## SQL Server

```csharp
dotnet add package Testcontainers.MsSql

var mssql = new MsSqlBuilder()
    .WithImage("mcr.microsoft.com/mssql/server:2022-CU14-ubuntu-22.04")
    .Build();

await mssql.StartAsync();
var cs = mssql.GetConnectionString();
```

> **Note:** SQL Server requires the `linux/amd64` platform on Apple Silicon. Ensure Docker Desktop for macOS 4.16+ with Rosetta 2 is enabled.

## Redis

```csharp
dotnet add package Testcontainers.Redis

var redis = new RedisBuilder()
    .WithImage("redis:7.0")
    .Build();

await redis.StartAsync();
var cs = redis.GetConnectionString();  // "localhost:49152"

// With StackExchange.Redis
using var mux = await ConnectionMultiplexer.ConnectAsync(redis.GetConnectionString());
var db = mux.GetDatabase();
```

## RabbitMQ

```csharp
dotnet add package Testcontainers.RabbitMq

var rabbitmq = new RabbitMqBuilder()
    .WithImage("rabbitmq:3.11")
    .Build();

await rabbitmq.StartAsync();
var cs = rabbitmq.GetConnectionString();  // "amqp://guest:guest@localhost:5672"
```

## Kafka

```csharp
dotnet add package Testcontainers.Kafka

var kafka = new KafkaBuilder()
    .WithImage("confluentinc/cp-kafka:6.1.9")
    .Build();

await kafka.StartAsync();
var bootstrapServers = kafka.GetBootstrapAddress();

// BAD — do not hardcode bootstrap server
// var producer = new ProducerBuilder<Null, string>(new ProducerConfig { BootstrapServers = "localhost:9092" })

// GOOD — use the assigned address
var producer = new ProducerBuilder<Null, string>(
    new ProducerConfig { BootstrapServers = kafka.GetBootstrapAddress() })
    .Build();
```

> **Note:** Kafka assigns the host port dynamically on startup. Avoid resource reuse with Kafka since it embeds the port in the configuration.

## MongoDB

```csharp
dotnet add package Testcontainers.MongoDb

var mongo = new MongoDbBuilder()
    .WithImage("mongo:6.0")
    .Build();

await mongo.StartAsync();
var cs = mongo.GetConnectionString();  // "mongodb://localhost:27017"

var client = new MongoClient(mongo.GetConnectionString());
```

## Elasticsearch

```csharp
dotnet add package Testcontainers.Elasticsearch

var elastic = new ElasticsearchBuilder()
    .WithImage("elasticsearch:8.6.1")
    .Build();

await elastic.StartAsync();
var cs = elastic.GetConnectionString();  // "http://elastic:changeme@localhost:9200"

var client = new ElasticsearchClient(new Uri(elastic.GetConnectionString()));
```

## Overriding Module Image Version

Always pin the image version, even for modules that have defaults:

```csharp
// BAD — using module default (may be outdated)
var postgres = new PostgreSqlBuilder().Build();

// GOOD — pin the version explicitly
var postgres = new PostgreSqlBuilder()
    .WithImage("postgres:16.2")
    .Build();
```

## One-Shot Containers (Migrations)

For containers that run a task and exit (e.g., EF Core migrations), use `WaitStrategyMode.OneShot` (see `references/wait-strategies.md`):

```csharp
var migrationContainer = new ContainerBuilder().WithImage("my-app:latest")
    .WithCommand("migrate")
    .WithWaitStrategy(Wait.ForUnixContainer()
        .UntilMessageIsLogged("Migration completed",
            o => o.WithMode(WaitStrategyMode.OneShot)))
    .Build();
```
