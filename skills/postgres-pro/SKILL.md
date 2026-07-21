---
name: postgres-pro
description: >-
  Comprehensively reviews PostgreSQL code for best practices on schema design,
  query optimization, indexing strategies, partitioning, transactions, RLS,
  PL/pgSQL functions, performance tuning, and operational concerns. Use when
  reading, writing, or reviewing SQL schemas, migrations, queries, stored
  procedures, PostgreSQL configuration, or database architecture. DO NOT USE FOR:
  Supabase-specific patterns (use supabase-pro), ORM-specific code (Prisma,
  Drizzle, TypeORM), or application-layer database client code.
---

Review PostgreSQL schemas, queries, migrations, functions, and configuration for correctness, performance, security, and adherence to best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Validate schema design, normalization, data types, and constraints using `references/schema.md`.
2. Check indexing strategies and index usage using `references/indexing.md`.
3. Audit query patterns, EXPLAIN plans, window functions, CTEs, and JSONB usage using `references/queries.md`.
4. Check performance tuning, vacuum configuration, and connection pooling using `references/performance.md`.
5. Audit Row Level Security policies, permissions, and injection prevention using `references/security.md`.
6. Validate transaction usage, isolation levels, and locking patterns using `references/transactions.md`.
7. Review partitioning design and partition management using `references/partitioning.md`.
8. Check PL/pgSQL functions, triggers, and stored procedures using `references/functions.md`.
9. Review operational concerns: migrations, backups, replication, and extensions using `references/operations.md`.
10. Identify anti-patterns and common mistakes using `references/patterns.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **PostgreSQL 16** or later.
- All SQL examples use lowercase keywords for readability — either convention is acceptable but be consistent within a project.
- Prefer **declarative partitioning** over inheritance-based partitioning.
- Always use **parameterized queries** from application code — never interpolate user input into SQL strings.
- Prefer `text` over `varchar(n)` unless a hard length constraint is genuinely required.
- Always include `IF NOT EXISTS` / `IF EXISTS` guards in migrations for idempotency.
- Use `EXPLAIN (ANALYZE, BUFFERS)` to diagnose query performance — never guess from query shape alone.
- Every table should have a primary key.
- Prefer `timestamptz` over `timestamp` for all time-related columns.
- Use `bigint` or `uuid` for primary keys on tables expected to grow large.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after SQL fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

Example output:

### migrations/001_create_orders.sql

**Line 12: Use `timestamptz` instead of `timestamp` for time columns.**

```sql
-- Before
created_at timestamp default now()

-- After
created_at timestamptz default now()
```

**Line 5: Add a composite index for the common query pattern filtering by user + date.**

```sql
-- Before (separate indexes — Postgres can only efficiently use one)
CREATE INDEX idx_orders_user ON orders (user_id);
CREATE INDEX idx_orders_date ON orders (created_at);

-- After (single composite index covers filter + sort)
CREATE INDEX idx_orders_user_date ON orders (user_id, created_at DESC);
```
