# Performance Tuning

Best practices for PostgreSQL configuration, vacuum/autovacuum, connection pooling, and performance diagnostics.

---

## Key Configuration Parameters

- **`shared_buffers`** — Set to **25% of total RAM** as a starting point. This is the kernel-shared memory cache for PostgreSQL.

  ```
  # 16 GB RAM server
  shared_buffers = 4GB
  ```

- **`work_mem`** — Memory per **sort/hash operation** (not per connection). Start at **4–16 MB** for OLTP workloads. Increase for analytical queries.

  ```
  # Default 4MB — increase for complex queries
  work_mem = 16MB
  ```

  **Warning:** A query with 5 sort nodes uses 5× `work_mem`. Multiply by `max_connections` to estimate worst-case memory. Set it high only in session for batch jobs: `SET work_mem = '256MB';`.

- **`maintenance_work_mem`** — Memory for maintenance operations (VACUUM, CREATE INDEX). Set to **256 MB–1 GB**.

  ```
  maintenance_work_mem = 512MB
  ```

- **`effective_cache_size`** — Hint to the planner about how much memory is available (OS cache + shared_buffers). Set to **50–75% of total RAM**.

  ```
  # 16 GB RAM server
  effective_cache_size = 12GB
  ```

- **`random_page_cost`** — For SSD storage, lower this from the default `4.0` to `1.1`–`1.5`. This makes the planner prefer index scans over sequential scans.

  ```
  # SSD storage
  random_page_cost = 1.1
  ```

- **`effective_io_concurrency`** — For SSD, increase from the default `1` to `200`. Allows Postgres to initiate multiple I/O requests in parallel.

  ```
  effective_io_concurrency = 200
  ```

- **`max_connections`** — Keep this **low** (100–200) and use a connection pooler. Each connection consumes ~10 MB of memory.

  ```
  max_connections = 100
  ```

## Vacuum and Autovacuum

- **Never disable autovacuum** — it prevents transaction ID wraparound and reclaims dead tuple space. Without it, the database will eventually shut down to prevent data corruption.

- The autovacuum trigger formula is: `threshold + scale_factor × table_size`. For large tables, the default `scale_factor = 0.2` means 20% of rows must be dead before vacuum runs. Lower it for write-heavy tables.

  ```sql
  -- Per-table autovacuum tuning for a high-write table
  ALTER TABLE events SET (
    autovacuum_vacuum_threshold = 1000,
    autovacuum_vacuum_scale_factor = 0.01,    -- 1% instead of 20%
    autovacuum_analyze_threshold = 500,
    autovacuum_analyze_scale_factor = 0.005
  );
  ```

- Increase **`autovacuum_max_workers`** (default 3) if you have many tables. Each worker vacuums one table at a time.

  ```
  autovacuum_max_workers = 6
  ```

- Increase **`autovacuum_vacuum_cost_limit`** to make autovacuum more aggressive (finish faster, use more I/O).

  ```
  # Default 200 — increase for faster cleanup
  autovacuum_vacuum_cost_limit = 800
  ```

- Decrease **`autovacuum_vacuum_cost_delay`** for faster vacuum on modern SSDs.

  ```
  # Default 2ms — reduce for SSDs
  autovacuum_vacuum_cost_delay = 0
  ```

- **`VACUUM FULL`** rewrites the entire table and requires an `ACCESS EXCLUSIVE` lock. Use it only when the table has extreme bloat. For routine maintenance, plain `VACUUM` is sufficient and runs concurrently.

- Monitor vacuum activity:

  ```sql
  -- Check tables that need vacuuming
  SELECT schemaname, relname, n_dead_tup, last_vacuum, last_autovacuum
  FROM pg_stat_user_tables
  WHERE n_dead_tup > 10000
  ORDER BY n_dead_tup DESC;
  ```

- Monitor for **transaction ID wraparound** risk:

  ```sql
  SELECT datname, age(datfrozenxid) AS xid_age,
    current_setting('autovacuum_freeze_max_age')::bigint - age(datfrozenxid) AS remaining
  FROM pg_database
  ORDER BY xid_age DESC;
  ```

## Connection Pooling

- **Always use a connection pooler** (PgBouncer, PgCat, or Supavisor) in production. Do not connect directly with high connection counts.

  **Why:** Each PostgreSQL connection is a separate OS process (~10 MB RAM). 500 direct connections = 5 GB just for connection overhead.

- **PgBouncer transaction mode** is the most common setting — connections are returned to the pool at transaction end.

  ```ini
  # pgbouncer.ini
  [databases]
  mydb = host=127.0.0.1 port=5432 dbname=mydb

  [pgbouncer]
  pool_mode = transaction
  max_client_conn = 1000
  default_pool_size = 25
  reserve_pool_size = 5
  server_idle_timeout = 300
  ```

- In **transaction mode**, these features are **not available**: `SET` statements (use `SET LOCAL`), `LISTEN/NOTIFY`, prepared statements (use `server_prepared_statements` in PgBouncer 1.21+), advisory locks (use transaction-level advisory locks only).

  ```sql
  -- Before (incompatible with transaction pooling)
  SET work_mem = '256MB';
  SELECT expensive_query();

  -- After (SET LOCAL scoped to transaction)
  BEGIN;
  SET LOCAL work_mem = '256MB';
  SELECT expensive_query();
  COMMIT;
  ```

- Set `default_pool_size` to **2–3× CPU cores** on the database server, not the number of app servers or expected users.

## Monitoring

- Enable **`pg_stat_statements`** to track query performance across all sessions.

  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

  -- Top 10 slowest queries by total time
  SELECT
    calls,
    round(total_exec_time::numeric, 2) AS total_ms,
    round(mean_exec_time::numeric, 2) AS mean_ms,
    query
  FROM pg_stat_statements
  ORDER BY total_exec_time DESC
  LIMIT 10;
  ```

- Monitor **table and index cache hit ratio** — aim for >99% cache hit rate.

  ```sql
  SELECT
    sum(heap_blks_hit) AS hit,
    sum(heap_blks_read) AS read,
    round(sum(heap_blks_hit)::numeric / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 4) AS ratio
  FROM pg_statio_user_tables;
  ```

- Monitor **long-running queries** and idle-in-transaction sessions.

  ```sql
  -- Queries running longer than 5 minutes
  SELECT pid, now() - query_start AS duration, state, query
  FROM pg_stat_activity
  WHERE state != 'idle'
    AND now() - query_start > interval '5 minutes'
  ORDER BY duration DESC;
  ```

- Set **`statement_timeout`** and **`idle_in_transaction_session_timeout`** to prevent runaway queries and leaked transactions.

  ```
  statement_timeout = '30s'
  idle_in_transaction_session_timeout = '60s'
  ```

See also `references/indexing.md` for index diagnostics and `references/operations.md` for `pg_stat_statements` setup.
