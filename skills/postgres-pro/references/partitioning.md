# Partitioning

Best practices for PostgreSQL declarative partitioning: range, list, and hash strategies.

---

## When to Partition

- Partition tables with **100M+ rows** or **hundreds of gigabytes** where queries naturally filter on the partition key (e.g., time range, tenant ID).
- Do **not** partition small tables — the overhead of partition routing and planning outweighs the benefit.
- Partitioning is not a substitute for indexing — always create indexes on partition tables too.

## Declarative Partitioning (PostgreSQL 10+)

- Always use **declarative partitioning** (`PARTITION BY`). Never use legacy inheritance-based partitioning.

### Range Partitioning

Best for **time-series data** and append-only logs where queries filter on a date/time range.

```sql
-- Parent table
CREATE TABLE events (
  id bigint GENERATED ALWAYS AS IDENTITY,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE events_2026_01 PARTITION OF events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE events_2026_02 PARTITION OF events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE events_2026_03 PARTITION OF events
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Indexes are created on each partition (not the parent)
CREATE INDEX idx_events_2026_01_type ON events_2026_01 (event_type);
CREATE INDEX idx_events_2026_02_type ON events_2026_02 (event_type);
CREATE INDEX idx_events_2026_03_type ON events_2026_03 (event_type);
```

**Tip:** To avoid creating indexes manually on every partition, create the index on the parent (PostgreSQL 11+) — it propagates automatically:

```sql
CREATE INDEX idx_events_type ON events (event_type);
```

### List Partitioning

Best for **multi-tenant** data or categorical splits.

```sql
CREATE TABLE orders (
  id bigint GENERATED ALWAYS AS IDENTITY,
  region text NOT NULL,
  user_id bigint NOT NULL,
  total numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY LIST (region);

CREATE TABLE orders_us PARTITION OF orders FOR VALUES IN ('us-east', 'us-west');
CREATE TABLE orders_eu PARTITION OF orders FOR VALUES IN ('eu-west', 'eu-central');
CREATE TABLE orders_apac PARTITION OF orders FOR VALUES IN ('ap-southeast', 'ap-northeast');
```

### Hash Partitioning

Best for **evenly distributing** rows when there is no natural range or list key (e.g., by user ID for load balancing).

```sql
CREATE TABLE user_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY,
  user_id bigint NOT NULL,
  session_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY HASH (user_id);

CREATE TABLE user_sessions_0 PARTITION OF user_sessions FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE user_sessions_1 PARTITION OF user_sessions FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE user_sessions_2 PARTITION OF user_sessions FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE user_sessions_3 PARTITION OF user_sessions FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

## Default Partition

- Always create a **default partition** to catch rows that don't match any defined partition. Without it, inserts that don't match fail with an error.

  ```sql
  CREATE TABLE events_default PARTITION OF events DEFAULT;
  ```

- Monitor the default partition — if it grows, you are missing partition definitions.

## Partition Key Rules

- The partition key **must be included in the primary key** (or any unique constraint).

  ```sql
  -- Before (fails — partition key not in PK)
  CREATE TABLE events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz NOT NULL
  ) PARTITION BY RANGE (created_at);

  -- After (composite PK includes partition key)
  CREATE TABLE events (
    id bigint GENERATED ALWAYS AS IDENTITY,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (id, created_at)
  ) PARTITION BY RANGE (created_at);
  ```

- Always include the partition key in `WHERE` clauses so the planner can **prune** irrelevant partitions. Without it, Postgres scans all partitions.

  ```sql
  -- Before (scans all partitions)
  SELECT * FROM events WHERE event_type = 'login';

  -- After (prunes to relevant partition)
  SELECT * FROM events
  WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01'
    AND event_type = 'login';
  ```

## Partition Maintenance

- **Automate partition creation** — use `pg_partman` or a cron job to create partitions ahead of time. Do not rely on manual creation.

  ```sql
  -- Using pg_partman
  CREATE EXTENSION IF NOT EXISTS pg_partman;
  SELECT create_parent(
    p_parent_table := 'public.events',
    p_control := 'created_at',
    p_interval := '1 month'
  );
  ```

- **Detach old partitions** instead of deleting data — `DETACH PARTITION` is near-instant vs. `DELETE` which generates dead tuples.

  ```sql
  -- Detach for archival (fast, no dead tuples)
  ALTER TABLE events DETACH PARTITION events_2025_01;

  -- Optionally archive or drop
  DROP TABLE events_2025_01;
  ```

- In PostgreSQL 14+, use **`DETACH PARTITION ... CONCURRENTLY`** to avoid blocking queries on the parent table.

  ```sql
  ALTER TABLE events DETACH PARTITION events_2025_01 CONCURRENTLY;
  ```

## Sub-Partitioning

- Use sparingly — sub-partitioning can lead to thousands of partitions, which degrades query planning time and increases file descriptor usage.

  ```sql
  -- Two-level: partition by range (month), sub-partition by list (region)
  CREATE TABLE events_2026_01 PARTITION OF events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')
    PARTITION BY LIST (region);
  ```

## Common Partitioning Mistakes

- **Too many partitions** — keep under ~1000 total. Each partition adds planning overhead.
- **Missing partition key in queries** — without it, Postgres cannot prune partitions.
- **Forgetting the default partition** — inserts fail if no matching partition exists.
- **Not automating partition creation** — missing future partitions cause insert failures.
- **Using partitioning for small tables** — the overhead is not worthwhile under ~10 GB.

See also `references/performance.md` for vacuum considerations on partitioned tables and `references/operations.md` for partition automation.
