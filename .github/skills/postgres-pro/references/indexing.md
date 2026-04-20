# Indexing Strategies

Best practices for PostgreSQL index types, when to use each, and common indexing mistakes.

---

## Index Type Selection

| Index Type           | Use When                                                        | Operators Supported                                   |
| -------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| **B-tree** (default) | Equality, range, sorting, `LIKE 'prefix%'`                      | `=`, `<`, `>`, `<=`, `>=`, `BETWEEN`, `IS NULL`, `IN` |
| **GIN**              | Multi-valued columns (arrays, JSONB, tsvector, trigrams)        | `@>`, `<@`, `?`, `?&`, `?\|`, `@@`, `&&`              |
| **GiST**             | Geometric, range types, full-text (ranking), nearest-neighbor   | `&&`, `@>`, `<@`, `<<`, `>>`, `<->`                   |
| **BRIN**             | Large, naturally ordered tables (time-series, append-only logs) | `<`, `<=`, `=`, `>=`, `>`                             |
| **Hash**             | Equality-only lookups (rarely preferable to B-tree)             | `=`                                                   |

## B-tree Indexes

- B-tree is the **default and most versatile** index type. Use it for equality, range queries, and sorting.

  ```sql
  -- Single-column index for equality/range lookups
  CREATE INDEX idx_orders_user_id ON orders (user_id);

  -- Supports ORDER BY without a separate sort step
  CREATE INDEX idx_orders_created ON orders (created_at DESC);
  ```

- **Column order matters** in composite indexes. Place the most selective (highest cardinality) equality column first, then range/sort columns.

  ```sql
  -- Before (wrong order — low-cardinality status first)
  CREATE INDEX idx_orders_bad ON orders (status, user_id, created_at DESC);

  -- After (high-cardinality user_id first, then sort column)
  CREATE INDEX idx_orders_user_date ON orders (user_id, created_at DESC);
  ```

- A composite index on `(a, b, c)` can satisfy queries filtering on `(a)`, `(a, b)`, or `(a, b, c)` — but **not** `(b)` or `(c)` alone. This is the leftmost-prefix rule.

## GIN Indexes

- Use GIN for **JSONB containment queries** (`@>`, `?`, `?|`, `?&`).

  ```sql
  -- Default jsonb_ops — supports @>, ?, ?|, ?&
  CREATE INDEX idx_events_data ON events USING gin(data);

  -- jsonb_path_ops — smaller, faster, but only supports @>
  CREATE INDEX idx_events_data_path ON events USING gin(data jsonb_path_ops);
  ```

  **Rule of thumb:** Use `jsonb_path_ops` when you only need `@>` containment checks. It produces a smaller, faster index.

- Use GIN for **array containment** queries (`&&`, `@>`, `<@`).

  ```sql
  CREATE INDEX idx_articles_tags ON articles USING gin(tags);

  -- Query: articles with any of these tags
  SELECT * FROM articles WHERE tags && ARRAY['postgres', 'performance'];
  ```

- Use GIN for **full-text search** on `tsvector` columns.

  ```sql
  CREATE INDEX idx_docs_search ON documents USING gin(search_vector);

  -- Query
  SELECT * FROM documents WHERE search_vector @@ to_tsquery('english', 'postgres & replication');
  ```

  See also `references/queries.md` for full-text search patterns.

- Use GIN with **`pg_trgm`** for `LIKE '%substring%'` and similarity searches.

  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  CREATE INDEX idx_users_name_trgm ON users USING gin(name gin_trgm_ops);

  -- Now supports ILIKE with index
  SELECT * FROM users WHERE name ILIKE '%john%';
  ```

## GiST Indexes

- Use GiST for **range type exclusion constraints** and overlap queries.

  ```sql
  -- Required for EXCLUDE USING gist
  CREATE TABLE reservations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id bigint NOT NULL,
    during tstzrange NOT NULL,
    EXCLUDE USING gist (room_id WITH =, during WITH &&)
  );
  ```

- Use GiST for **geometric data** and **PostGIS** spatial queries.

  ```sql
  CREATE INDEX idx_locations_geom ON locations USING gist(geom);
  ```

- Use GiST for **nearest-neighbor** searches (the `<->` distance operator).

  ```sql
  -- KNN search — find 10 nearest points
  SELECT * FROM places ORDER BY location <-> point(40.7, -74.0) LIMIT 10;
  ```

## BRIN Indexes

- Use BRIN for **large, physically ordered** tables where column values correlate with row insertion order (e.g., `created_at` in append-only tables).

  ```sql
  -- BRIN on a time-series table — tiny index, good for range scans
  CREATE INDEX idx_logs_created_brin ON logs USING brin(created_at);
  ```

  **Why:** BRIN stores min/max summaries per block range. On a 100M-row table, a BRIN index may be 1000x smaller than a B-tree. But it is **only effective** when the column values are physically correlated with row order.

- **Do not use BRIN** on columns with random insertion order (e.g., `uuid` PKs) — it will scan most blocks and be slower than a sequential scan.

## Partial Indexes

- Use **partial indexes** to index only a subset of rows — reduces index size and speeds up both writes and reads.

  ```sql
  -- Before (indexes all rows, most of which are 'delivered')
  CREATE INDEX idx_orders_status ON orders (status);

  -- After (indexes only active orders — much smaller)
  CREATE INDEX idx_orders_active ON orders (status)
    WHERE status NOT IN ('delivered', 'cancelled');
  ```

- Partial unique indexes enforce uniqueness on a subset of rows.

  ```sql
  -- Only one active subscription per user
  CREATE UNIQUE INDEX uq_active_subscription
    ON subscriptions (user_id) WHERE status = 'active';
  ```

## Expression Indexes

- Use **expression indexes** when you query on a transformed value of a column.

  ```sql
  -- Before (index on email is not used for case-insensitive search)
  SELECT * FROM users WHERE lower(email) = 'alice@example.com';

  -- After (expression index matches the query expression)
  CREATE INDEX idx_users_email_lower ON users (lower(email));
  ```

- **The query expression must match the index expression exactly** — `lower(email)` index is only used when the query also uses `lower(email)`.

## Covering Indexes (INCLUDE)

- Use `INCLUDE` to add columns to a B-tree index for **index-only scans** without increasing the index's search key.

  ```sql
  -- The query needs user_id (filter) + email, name (select)
  -- INCLUDE avoids a heap lookup for the non-filter columns
  CREATE INDEX idx_users_lookup ON users (user_id) INCLUDE (email, name);
  ```

## Index Maintenance

- Run `REINDEX CONCURRENTLY` to rebuild bloated indexes without locking the table.

  ```sql
  REINDEX INDEX CONCURRENTLY idx_orders_user_date;
  ```

- Monitor unused indexes with `pg_stat_user_indexes` — unused indexes waste write I/O and storage.

  ```sql
  SELECT schemaname, relname, indexrelname, idx_scan
  FROM pg_stat_user_indexes
  WHERE idx_scan = 0
  ORDER BY pg_relation_size(indexrelid) DESC;
  ```

- Monitor index bloat and consider rebuilding indexes with a high ratio of dead tuples.

## Common Indexing Mistakes

- **Over-indexing** — every index slows writes (`INSERT`, `UPDATE`, `DELETE`). Only create indexes that serve actual query patterns.

- **Indexing low-cardinality columns alone** — an index on `status` (3 values) is rarely useful by itself. Combine with a higher-cardinality column or use a partial index.

- **Missing indexes on foreign keys** — PostgreSQL does **not** auto-index foreign key columns. Missing FK indexes cause slow `DELETE` cascades and join performance issues.

  ```sql
  -- Always index the FK column
  ALTER TABLE order_items ADD CONSTRAINT fk_order
    FOREIGN KEY (order_id) REFERENCES orders(id);
  CREATE INDEX idx_order_items_order_id ON order_items (order_id);
  ```

- **Creating redundant indexes** — `(user_id, created_at)` already covers queries on `(user_id)` alone. A separate `(user_id)` index is redundant.

- **Using indexes for columns only in `SELECT`** — indexes help `WHERE`, `JOIN`, `ORDER BY`, and `GROUP BY`. Indexing a column that only appears in `SELECT` is pointless (unless using `INCLUDE` for index-only scans).

See also `references/performance.md` for EXPLAIN-based index diagnostics.
