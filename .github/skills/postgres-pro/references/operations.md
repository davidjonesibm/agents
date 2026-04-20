# Operations

Best practices for PostgreSQL migrations, backups, replication, and extensions.

---

## Migrations

- **Every migration must be idempotent** — use `IF NOT EXISTS`, `IF EXISTS`, and `CREATE OR REPLACE` guards so running a migration twice has no side effect.

  ```sql
  -- Before (fails on re-run)
  CREATE TABLE notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id)
  );

  -- After (idempotent)
  CREATE TABLE IF NOT EXISTS notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id)
  );
  ```

- **Wrap DDL in transactions** — PostgreSQL supports transactional DDL (unlike MySQL). If any statement fails, everything rolls back.

  ```sql
  BEGIN;
  ALTER TABLE orders ADD COLUMN shipping_status text;
  CREATE INDEX CONCURRENTLY idx_orders_shipping ON orders (shipping_status);
  -- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
  -- Split it into a separate migration.
  COMMIT;
  ```

  **Warning:** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Always separate it into its own migration.

- **Never add a column with a volatile default to a large table** — in PostgreSQL 11+, adding a column with a constant default is instant (metadata-only). But a volatile default (e.g., `DEFAULT now()`) rewrites the entire table.

  ```sql
  -- Fast (instant metadata change — PG 11+)
  ALTER TABLE orders ADD COLUMN archived boolean NOT NULL DEFAULT false;

  -- Slow (rewrites entire table — volatile default)
  ALTER TABLE orders ADD COLUMN processed_at timestamptz DEFAULT now();

  -- Fix: add column without default, then backfill
  ALTER TABLE orders ADD COLUMN processed_at timestamptz;
  -- Backfill in batches
  UPDATE orders SET processed_at = created_at WHERE processed_at IS NULL AND id BETWEEN 1 AND 100000;
  ```

- **Create indexes concurrently** to avoid locking the table during index creation.

  ```sql
  -- Before (locks the table for writes during index build)
  CREATE INDEX idx_orders_user ON orders (user_id);

  -- After (non-blocking)
  CREATE INDEX CONCURRENTLY idx_orders_user ON orders (user_id);
  ```

- **Never drop a column in production without a multi-phase approach:**
  1. Stop writing to the column.
  2. Deploy code that no longer reads the column.
  3. Drop the column in a migration.
     This prevents errors during rolling deployments.

- Use a **migration tool** (`dbmate`, `golang-migrate`, `sqitch`, `Flyway`, `pg_partman`) to version and track migrations. Never run ad-hoc SQL against production.

## Safe Schema Changes

- **Adding a `NOT NULL` constraint** on an existing column requires a full table scan in PostgreSQL 11 and earlier. In PostgreSQL 12+, use `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID` then `VALIDATE`:

  ```sql
  -- Phase 1 (instant — does not scan existing rows)
  ALTER TABLE orders ADD CONSTRAINT chk_status_not_null CHECK (status IS NOT NULL) NOT VALID;

  -- Phase 2 (scans table, but allows concurrent reads/writes)
  ALTER TABLE orders VALIDATE CONSTRAINT chk_status_not_null;

  -- Phase 3 (optional — promote to actual NOT NULL if desired)
  ALTER TABLE orders ALTER COLUMN status SET NOT NULL;
  ALTER TABLE orders DROP CONSTRAINT chk_status_not_null;
  ```

- **Renaming tables or columns** breaks application code. Prefer adding a new column + backfilling + dropping the old one over renaming.

- **Changing a column type** may require a full table rewrite. If the table is large, add a new column with the new type, backfill, then swap.

## Backups

- Use **`pg_dump`** for logical backups (portable, can restore individual tables).

  ```bash
  # Full database backup (custom format — compressed, parallelizable restore)
  pg_dump -Fc -j 4 -f mydb.dump mydb

  # Restore
  pg_restore -j 4 -d mydb mydb.dump
  ```

- Use **`pg_basebackup`** for physical backups (required for point-in-time recovery and replication setup).

  ```bash
  pg_basebackup -D /backups/base -Ft -z -P
  ```

- Enable **continuous archiving** (WAL archiving) for point-in-time recovery.

  ```
  # postgresql.conf
  archive_mode = on
  archive_command = 'cp %p /archive/%f'
  ```

- **Test your backups regularly** — a backup that cannot be restored is not a backup.

- Use **`pg_dumpall`** for backing up global objects (roles, tablespaces) that `pg_dump` does not include.

  ```bash
  pg_dumpall --globals-only -f globals.sql
  ```

## Replication

- **Streaming replication** is the standard for high availability — replicas receive WAL records in real-time.

  ```
  # postgresql.conf on primary
  wal_level = replica
  max_wal_senders = 10
  wal_keep_size = '1GB'
  ```

- **Synchronous replication** guarantees no data loss (zero RPO) but adds latency. Use for critical workloads.

  ```
  # postgresql.conf on primary
  synchronous_standby_names = 'replica1'
  ```

- **Logical replication** (PostgreSQL 10+) replicates specific tables and allows different indexes/schemas on the subscriber. Useful for zero-downtime migrations and data distribution.

  ```sql
  -- On publisher
  CREATE PUBLICATION my_pub FOR TABLE orders, users;

  -- On subscriber
  CREATE SUBSCRIPTION my_sub
    CONNECTION 'host=primary dbname=mydb'
    PUBLICATION my_pub;
  ```

- Use connection **routing** (e.g., PgBouncer, HAProxy, Patroni) to direct read queries to replicas.

## Extensions

- **`pg_stat_statements`** — essential for query performance monitoring. Enable it in every production database.

  ```
  # postgresql.conf
  shared_preload_libraries = 'pg_stat_statements'
  pg_stat_statements.track = top
  ```

  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
  ```

- **`pgcrypto`** — cryptographic functions (hashing, encryption). See `references/security.md`.

  ```sql
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  ```

- **`pg_trgm`** — trigram matching for fuzzy search and `ILIKE` index support. See `references/indexing.md`.

  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ```

- **`btree_gist`** — enables exclusion constraints with B-tree operators in GiST indexes.

  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ```

- **`PostGIS`** — geospatial data types and functions. Use when storing geographic data.

- **`pg_partman`** — automated partition management. See `references/partitioning.md`.

- **`uuid-ossp`** or use built-in `gen_random_uuid()` (PostgreSQL 13+) for UUID generation.

- Always check that extensions are **available on your hosting provider** before depending on them. Managed services (RDS, Cloud SQL, Supabase) restrict which extensions can be installed.

## Monitoring Extensions

- **`auto_explain`** — automatically logs EXPLAIN plans for slow queries.

  ```
  # postgresql.conf
  shared_preload_libraries = 'pg_stat_statements, auto_explain'
  auto_explain.log_min_duration = '500ms'
  auto_explain.log_analyze = true
  ```

- **`pg_stat_user_tables`** — tracks sequential scans, index scans, dead tuples, and vacuum timing per table.

- **`pg_stat_bgwriter`** — tracks checkpoint and background writer activity for I/O tuning.

See also `references/performance.md` for monitoring queries.
