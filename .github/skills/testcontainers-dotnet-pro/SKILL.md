---
name: testcontainers-dotnet-pro
description: >-
  Comprehensively reviews and guides Testcontainers for .NET code for best
  practices on container lifecycle, built-in modules (PostgreSQL, SQL Server,
  Redis, RabbitMQ, Kafka, MongoDB, Elasticsearch and 50+ more), wait strategies,
  networking, xUnit/NUnit/MSTest integration, IAsyncLifetime, ContainerTest,
  ContainerFixture, WebApplicationFactory, and CI/CD configuration. Use when
  reading, writing, or reviewing .NET integration tests that spin up throwaway
  Docker containers. Trigger keywords: Testcontainers, throwaway containers,
  Docker integration testing, ContainerBuilder, IAsyncLifetime, PostgreSqlContainer,
  MsSqlContainer, RedisContainer, RabbitMqContainer, KafkaContainer,
  WebApplicationFactory containers, dotnet test containers, integration tests Docker.
---

Writes and reviews Testcontainers for .NET integration tests targeting version 4.x.

Review process:

1. Check installation and package references using `references/setup.md`.
2. Validate container lifecycle and cleanup using `references/lifecycle.md`.
3. Review built-in module usage (PostgreSQL, Redis, SQL Server, etc.) using `references/modules.md`.
4. Check wait strategy correctness using `references/wait-strategies.md`.
5. Validate networking and port configuration using `references/networking.md`.
6. Review test framework integration (xUnit, NUnit, MSTest) using `references/test-frameworks.md`.
7. Check ASP.NET Core / WebApplicationFactory integration using `references/aspnet.md`.
8. Verify CI/CD pipeline configuration using `references/cicd.md`.
9. Check for best practices and anti-patterns using `references/patterns.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target Testcontainers for .NET **4.x** (current: 4.11.0).
- Requires a Docker-API-compatible runtime: Docker Desktop, Podman with Docker socket, Rancher Desktop, or remote Docker.
- Supports .NET Standard 2.0+. Prefer .NET 8 (LTS) for new projects.
- Always dispose containers after tests — never leave them running.
- Always use random host ports; never bind to a fixed host port.
- Always access the container via `container.Hostname`, never via `localhost` or `127.0.0.1`.
- Always pin image versions (`postgres:15.1`, not `postgres:latest`).
- Never disable the Resource Reaper (Ryuk) unless the CI environment has its own cleanup mechanism.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary (critical → warning → suggestion).
