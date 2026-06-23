---
name: golang-api
description: >-
  Go API development best practices for HTTP handlers, middleware, error handling,
  testing, and project structure. Use when reading, writing, or reviewing Go API projects.
---

Review Go API code for correctness, idiomatic patterns, and adherence to best practices.

Load reference files from `.github/skills/golang-api/references/` as needed for specific topics.

## Core Instructions

- Target **Go 1.22+** with standard library `net/http` mux or chi/echo routers.
- Use `context.Context` for cancellation and request-scoped values.
- Return errors explicitly — never panic for recoverable errors.
- Use structured logging (`slog` from stdlib or `zerolog`/`zap`).
- Use `sqlx` or `pgx` for database access — never concatenate SQL strings.
- Use table-driven tests and `testify` for assertions.
- Follow standard project layout: `cmd/`, `internal/`, `pkg/` where appropriate.
- Use interfaces at consumption site, not implementation site.
