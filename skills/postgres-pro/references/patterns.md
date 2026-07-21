# Anti-Patterns and Common Mistakes

Common PostgreSQL mistakes, anti-patterns, and their fixes.

---

## Schema Anti-Patterns

- **Using `serial` instead of `GENERATED ALWAYS AS IDENTITY`** — `serial` creates a detached sequence that desyncs on backup/restore. Use identity columns.

  ```sql
  -- Anti-pattern
  CREATE TABLE items (id serial PRIMARY KEY);

  -- Fix
  CREATE TABLE items (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);
  ```

  See also `references/schema.md` for primary key strategy.

- **Using `timestamp` instead of `timestamptz`** — `timestamp` silently drops timezone info, causing bugs when servers or applications change timezones.

  ```sql
  -- Anti-pattern
  created_at timestamp DEFAULT now()

  -- Fix
  created_at timestamptz NOT NULL DEFAULT now()
  ```

- **Using `varchar(n)` without a real length constraint need** — in PostgreSQL, `text` and `varchar(n)` have identical performance. Use `text` unless you have a business rule requiring a specific max length.

- **Nullable boolean columns** — a `boolean` column that allows NULL creates three-state logic (`true`/`false`/`null`), which is a common source of bugs. Always use `NOT NULL DEFAULT false` (or `true`).

  ```sql
  -- Anti-pattern
  is_active boolean

  -- Fix
  is_active boolean NOT NULL DEFAULT true
  ```

- **Storing comma-separated values in a text column** — use arrays or a junction table instead.

  ```sql
  -- Anti-pattern
  tags text  -- 'postgres,sql,performance'

  -- Fix (array)
  tags text[] NOT NULL DEFAULT '{}'

  -- Fix (junction table — better for relational queries)
  CREATE TABLE article_tags (
    article_id bigint REFERENCES articles(id),
    tag_id bigint REFERENCES tags(id),
    PRIMARY KEY (article_id, tag_id)
  );
  ```

- **Missing foreign key indexes** — PostgreSQL does not automatically create indexes on foreign key columns. Missing FK indexes cause slow cascading deletes and slow joins.

  ```sql
  -- Anti-pattern (FK without index)
  ALTER TABLE order_items ADD FOREIGN KEY (order_id) REFERENCES orders(id);

  -- Fix
  ALTER TABLE order_items ADD FOREIGN KEY (order_id) REFERENCES orders(id);
  CREATE INDEX idx_order_items_order_id ON order_items (order_id);
  ```

## Query Anti-Patterns

- **Using `OFFSET` for deep pagination** — `OFFSET 100000` scans and discards 100K rows. Use keyset (cursor-based) pagination instead.

  ```sql
  -- Anti-pattern
  SELECT * FROM messages ORDER BY created_at DESC LIMIT 20 OFFSET 100000;

  -- Fix (keyset pagination)
  SELECT * FROM messages
  WHERE created_at < $1
  ORDER BY created_at DESC
  LIMIT 20;
  ```

  See also `references/queries.md` for pagination patterns.

- **Using `SELECT *` in production** — fetches unnecessary columns, prevents index-only scans, and breaks when schema changes.

- **Using `NOT IN` with a subquery that might return NULLs** — `NOT IN (1, 2, NULL)` always returns empty because `x != NULL` is always unknown. Use `NOT EXISTS` instead.

  ```sql
  -- Anti-pattern (returns no rows if subquery has any NULL)
  SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM banned_users);

  -- Fix
  SELECT * FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.user_id = u.id);
  ```

- **Using `count(*)` to check existence** — counting all rows just to check if any exist is wasteful. Use `EXISTS`.

  ```sql
  -- Anti-pattern
  SELECT CASE WHEN count(*) > 0 THEN true ELSE false END FROM orders WHERE user_id = 1;

  -- Fix
  SELECT EXISTS (SELECT 1 FROM orders WHERE user_id = 1);
  ```

- **Implicit casts breaking index usage** — comparing an `int` column with a `text` literal (or vice versa) can prevent index usage.

  ```sql
  -- Anti-pattern (user_id is bigint, parameter is text — cast may prevent index use)
  SELECT * FROM orders WHERE user_id = '42';

  -- Fix (match types)
  SELECT * FROM orders WHERE user_id = 42;
  ```

- **Using `OR` in `WHERE` on large tables** — `OR` often prevents index usage. Use `UNION ALL` or restructure.

  ```sql
  -- Anti-pattern (may result in sequential scan)
  SELECT * FROM orders WHERE user_id = 1 OR status = 'pending';

  -- Fix (each branch uses its own index)
  SELECT * FROM orders WHERE user_id = 1
  UNION ALL
  SELECT * FROM orders WHERE status = 'pending' AND user_id != 1;
  ```

## Performance Anti-Patterns

- **Missing `ANALYZE` after bulk loads** — statistics are stale after large data imports, causing the planner to choose bad plans.

  ```sql
  -- After a bulk load
  ANALYZE large_table;
  ```

- **Using `VACUUM FULL` as routine maintenance** — `VACUUM FULL` rewrites the table with an exclusive lock. Use plain `VACUUM` for routine work. Reserve `VACUUM FULL` for extreme bloat recovery.

- **Connection storms without pooling** — each PostgreSQL connection is a process (~10 MB). Use PgBouncer or equivalent. See `references/performance.md`.

- **Wrapping read-only queries in `BEGIN`/`COMMIT`** — this holds snapshots and prevents vacuum from cleaning dead tuples. Use autocommit for read-only queries or `SET TRANSACTION READ ONLY`.

- **Running long-running analytics on the primary** — route analytical queries to a read replica to avoid blocking autovacuum and impacting OLTP performance.

## Operational Anti-Patterns

- **No backup testing** — a backup that has never been restored is not a backup. Test restores regularly.

- **Applying DDL without `lock_timeout`** — `ALTER TABLE` on a busy table can wait indefinitely for a lock, queuing all subsequent queries and causing a cascading outage.

  ```sql
  -- Anti-pattern
  ALTER TABLE orders ADD COLUMN notes text;

  -- Fix
  SET lock_timeout = '5s';
  ALTER TABLE orders ADD COLUMN notes text;
  ```

- **Not monitoring `pg_stat_activity`** — idle-in-transaction sessions, long-running queries, and blocked queries all need monitoring. See `references/performance.md`.

- **Using `trust` authentication in production** — `pg_hba.conf` with `trust` allows password-free connections. Always use `scram-sha-256`. See `references/security.md`.

- **Not setting `statement_timeout`** — runaway queries can consume all resources. Always set a timeout.

  ```
  statement_timeout = '30s'
  ```

## JSONB Anti-Patterns

- **Storing relational data in JSONB** — if you filter, join, or enforce constraints on a field, it belongs in a relational column, not JSONB.

- **Using `json` instead of `jsonb`** — `json` stores the raw text and re-parses on every access. `jsonb` is binary, indexable, and faster for reads. Always use `jsonb`.

- **Querying JSONB with `->>` without an index** — JSONB field extraction without a GIN or expression index results in a sequential scan. See `references/indexing.md`.

## Trigger Anti-Patterns

- **Complex business logic in triggers** — triggers are invisible to application code, hard to debug, and cannot be unit-tested easily. Keep triggers simple (timestamps, audit logs).

- **Triggers that call external services** — triggers run within a transaction. A slow HTTP call in a trigger blocks the transaction and holds locks.

- **Not guarding against recursive triggers** — use `pg_trigger_depth() = 0` to prevent infinite recursion. See `references/functions.md`.
