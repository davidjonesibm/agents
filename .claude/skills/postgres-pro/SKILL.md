---
name: postgres-pro
description: >-
  PostgreSQL best practices for schema design, queries, indexes, migrations,
  and performance tuning. Use when reading, writing, or reviewing PostgreSQL schemas,
  queries, or database-related code.
---

Review PostgreSQL schema design and queries for correctness, performance, and adherence to best practices.

Load reference files from `.github/skills/postgres-pro/references/` as needed for specific topics:
- Schema design and normalization
- Index strategies and query optimization
- Migration patterns
- Security and access control
- Performance tuning and monitoring

## Core Instructions

- Target **PostgreSQL 16+**.
- Always use parameterized queries — never concatenate user input into SQL.
- Always define explicit indexes for foreign keys and frequently filtered columns.
- Use `EXPLAIN ANALYZE` to validate query plans for complex queries.
- Prefer `BIGINT` or `UUID` for primary keys over `SERIAL`.
- Always include `NOT NULL` constraints where the domain requires it.
- Use appropriate column types (e.g., `timestamptz` over `timestamp`, `text` over `varchar` without length limit).
- Migrations must be reversible — always include a down migration.
