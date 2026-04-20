# Query Optimization

Best practices for writing efficient queries, using EXPLAIN, window functions, CTEs, full-text search, and JSONB patterns.

---

## EXPLAIN and Query Analysis

- Always use **`EXPLAIN (ANALYZE, BUFFERS)`** to diagnose slow queries — never guess from query shape alone. `ANALYZE` runs the query; `BUFFERS` shows I/O.

  ```sql
  EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
  SELECT * FROM orders WHERE user_id = 42 ORDER BY created_at DESC LIMIT 20;
  ```

- Key things to check in EXPLAIN output:
  - **Seq Scan** on large tables — usually means a missing index.
  - **Nested Loop** with high `loops` count — may need a hash or merge join instead.
  - **Sort** node with `Sort Method: external merge` — `work_mem` is too low for this query.
  - **Bitmap Heap Scan → Recheck Cond** with `lossy` — `work_mem` too low for bitmap.
  - **Rows** estimate vs actual — large discrepancies mean stale statistics (`ANALYZE` the table).
  - **Buffers: shared hit/read** — high `read` means data is not cached.

- Use **`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`** for machine-parseable output. Tools like `auto_explain` log slow queries automatically.

  ```sql
  -- Enable auto_explain for queries over 500ms
  LOAD 'auto_explain';
  SET auto_explain.log_min_duration = '500ms';
  SET auto_explain.log_analyze = true;
  SET auto_explain.log_buffers = true;
  ```

## Query Patterns

- **Always use `LIMIT`** with `ORDER BY` — unbounded sorted queries are expensive on large tables.

  ```sql
  -- Before (sorts all rows, returns all)
  SELECT * FROM events ORDER BY created_at DESC;

  -- After
  SELECT * FROM events ORDER BY created_at DESC LIMIT 50;
  ```

- Use **keyset pagination** (cursor-based) instead of `OFFSET` for deep pagination. `OFFSET N` scans and discards N rows.

  ```sql
  -- Before (OFFSET-based — gets slower as page number increases)
  SELECT * FROM messages ORDER BY created_at DESC LIMIT 20 OFFSET 10000;

  -- After (keyset — constant performance regardless of page depth)
  SELECT * FROM messages
  WHERE created_at < '2026-03-15T10:00:00Z'
  ORDER BY created_at DESC
  LIMIT 20;
  ```

- Prefer **`EXISTS`** over `IN` with a subquery for existence checks — `EXISTS` short-circuits on the first match.

  ```sql
  -- Before (IN materializes entire subquery result)
  SELECT * FROM users
  WHERE id IN (SELECT user_id FROM orders WHERE total > 100);

  -- After (EXISTS short-circuits)
  SELECT * FROM users u
  WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.total > 100);
  ```

- Use **`count(*)`** instead of `count(column)` when counting rows — `count(column)` skips NULLs, which is rarely the intent and prevents some optimizations.

- Avoid **`SELECT *`** in production queries — select only the columns you need. This reduces I/O, enables index-only scans, and is resilient to schema changes.

- Use **`RETURNING`** to get modified rows back without a separate `SELECT`.

  ```sql
  -- Before (two round trips)
  INSERT INTO orders (user_id, total) VALUES (1, 99.99);
  SELECT * FROM orders WHERE user_id = 1 ORDER BY id DESC LIMIT 1;

  -- After (single statement)
  INSERT INTO orders (user_id, total) VALUES (1, 99.99) RETURNING *;
  ```

## Window Functions

- Use window functions for **ranking, running totals, and row numbering** without collapsing rows.

  ```sql
  -- Rank users by order count within their region
  SELECT
    user_id,
    region,
    order_count,
    RANK() OVER (PARTITION BY region ORDER BY order_count DESC) AS region_rank
  FROM user_stats;
  ```

- Use **`ROW_NUMBER()`** for deduplication.

  ```sql
  -- Keep only the latest record per user
  DELETE FROM user_events
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
      FROM user_events
    ) sub
    WHERE rn > 1
  );
  ```

- Use **`LAG()` / `LEAD()`** for comparing adjacent rows.

  ```sql
  -- Calculate day-over-day revenue change
  SELECT
    date,
    revenue,
    revenue - LAG(revenue) OVER (ORDER BY date) AS daily_change
  FROM daily_revenue;
  ```

- **Frame clauses** matter — `ROWS BETWEEN` vs `RANGE BETWEEN` produce different results with duplicates. Always specify explicitly.

  ```sql
  -- Running total (all rows up to current)
  SUM(amount) OVER (ORDER BY created_at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
  ```

## Common Table Expressions (CTEs)

- In PostgreSQL 12+, CTEs are **inlined by default** (optimized as subqueries). Use `MATERIALIZED` only when you need the CTE to act as an optimization fence.

  ```sql
  -- This CTE is inlined — the planner can push predicates into it
  WITH recent_orders AS (
    SELECT * FROM orders WHERE created_at > now() - interval '30 days'
  )
  SELECT * FROM recent_orders WHERE user_id = 42;

  -- Force materialization when the CTE is referenced multiple times
  -- and you want to avoid re-executing it
  WITH MATERIALIZED user_stats AS (
    SELECT user_id, count(*) AS cnt FROM orders GROUP BY user_id
  )
  SELECT * FROM user_stats WHERE cnt > 10
  UNION ALL
  SELECT * FROM user_stats WHERE cnt = 1;
  ```

- Use **recursive CTEs** for hierarchical data (trees, graphs).

  ```sql
  -- Fetch a category tree
  WITH RECURSIVE category_tree AS (
    SELECT id, name, parent_id, 0 AS depth
    FROM categories WHERE parent_id IS NULL
    UNION ALL
    SELECT c.id, c.name, c.parent_id, ct.depth + 1
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
  )
  SELECT * FROM category_tree ORDER BY depth, name;
  ```

  **Warning:** Always include a termination condition or `LIMIT` to prevent infinite recursion on cyclic data.

## Full-Text Search

- Use **`tsvector`** and **`tsquery`** with a GIN index for full-text search. Do not use `LIKE '%term%'` for text search — it cannot use standard indexes and scans the entire table.

  ```sql
  -- Add a generated tsvector column
  ALTER TABLE articles ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(body, '')), 'B')
    ) STORED;

  -- GIN index on the tsvector column
  CREATE INDEX idx_articles_search ON articles USING gin(search_vector);

  -- Query with ranking
  SELECT id, title, ts_rank(search_vector, query) AS rank
  FROM articles, to_tsquery('english', 'postgres & replication') AS query
  WHERE search_vector @@ query
  ORDER BY rank DESC
  LIMIT 20;
  ```

- Use **`setweight()`** to boost title matches over body matches (weights A > B > C > D).

- Use **`ts_headline()`** to generate snippets with highlighted matches for display.

  ```sql
  SELECT id, title,
    ts_headline('english', body, to_tsquery('english', 'postgres'), 'StartSel=<b>, StopSel=</b>') AS snippet
  FROM articles
  WHERE search_vector @@ to_tsquery('english', 'postgres');
  ```

- For **substring search** (`LIKE '%term%'`), use `pg_trgm` with a GIN index instead.

  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX idx_users_name_trgm ON users USING gin(name gin_trgm_ops);

  SELECT * FROM users WHERE name ILIKE '%john%';
  ```

  See also `references/indexing.md` for GIN index details.

## JSONB Query Patterns

- Use **containment operator `@>`** for structured lookups — it uses GIN indexes.

  ```sql
  -- GIN indexed — fast
  SELECT * FROM events WHERE data @> '{"type": "purchase", "region": "US"}';
  ```

- Use **`->>` operator** for extracting text values, **`->` operator** for extracting JSON objects.

  ```sql
  SELECT data->>'name' AS name, (data->'address'->>'city') AS city
  FROM customers
  WHERE data->>'status' = 'active';
  ```

- Use **`jsonb_path_query()`** (SQL/JSON path) for complex JSONB traversals (PostgreSQL 12+).

  ```sql
  SELECT jsonb_path_query(data, '$.items[*] ? (@.price > 100)')
  FROM orders;
  ```

- **Do not use JSONB as a substitute for relational columns** when you frequently filter, sort, or join on a value. Extract it to a proper column.

  ```sql
  -- Before (filtering on JSONB field in every query — no index benefit without expression index)
  SELECT * FROM users WHERE profile->>'country' = 'US';

  -- After (add a proper column if queried frequently)
  ALTER TABLE users ADD COLUMN country text GENERATED ALWAYS AS (profile->>'country') STORED;
  CREATE INDEX idx_users_country ON users (country);
  ```

- Create **expression indexes** on frequently-queried JSONB paths as an alternative to generated columns.

  ```sql
  CREATE INDEX idx_events_type ON events ((data->>'type'));

  -- Query must match the expression exactly
  SELECT * FROM events WHERE data->>'type' = 'purchase';
  ```

  See also `references/indexing.md` for JSONB GIN index options (`jsonb_ops` vs `jsonb_path_ops`).
