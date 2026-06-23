---
name: testcontainers-dotnet-pro
description: >-
  Testcontainers for .NET best practices for integration testing with real databases
  and services in Docker containers. Use when writing integration tests that need
  real infrastructure (PostgreSQL, Redis, RabbitMQ, etc.).
---

Review Testcontainers .NET usage for correctness and adherence to best practices.

Load reference files from `.github/skills/testcontainers-dotnet-pro/references/` as needed.

## Core Instructions

- Use `Testcontainers.MsSql`, `Testcontainers.PostgreSql`, etc. for database containers.
- Implement `IAsyncLifetime` on test fixtures for container lifecycle management.
- Use `WebApplicationFactory<T>` with container connection strings for integration tests.
- Share containers across test classes using `IClassFixture<T>` or collection fixtures.
- Use Respawn for fast database cleanup between tests instead of recreating containers.
- Always configure container wait strategies to avoid flaky tests.
- Use `WithImage()` to pin container versions for reproducibility.
