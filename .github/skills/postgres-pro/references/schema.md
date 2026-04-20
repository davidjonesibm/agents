# Schema Design

Best practices for PostgreSQL schema design, normalization, data types, and constraints.

---

## Normalization

- Normalize to **3NF by default**. Denormalize only when you have measured performance evidence that joins are the bottleneck — not speculatively.

- Every table **must have a primary key**. Tables without PKs cannot be replicated, vacuumed efficiently, or referenced by foreign keys.

  ```sql
  -- Before (no primary key)
  CREATE TABLE events (
    event_type text,
    payload jsonb,
    created_at timestamptz
  );

  -- After
  CREATE TABLE events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ```

- Use **foreign keys** to enforce referential integrity. Disable them only in bulk-load scripts, re-enable after.

  ```sql
  -- Always specify ON DELETE behavior explicitly
  CREATE TABLE order_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity int NOT NULL CHECK (quantity > 0)
  );
  ```

## Primary Key Strategy

- Use `bigint GENERATED ALWAYS AS IDENTITY` for internal-only IDs — sequential, compact, index-friendly.

  ```sql
  CREATE TABLE users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL UNIQUE
  );
  ```

- Use `uuid` (v7 preferred for sortability) when IDs are exposed externally or generated client-side.

  ```sql
  CREATE TABLE api_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id bigint NOT NULL REFERENCES users(id),
    token_hash text NOT NULL
  );
  ```

- **Never use `serial`** — it is legacy. Use `GENERATED ALWAYS AS IDENTITY` instead. `serial` creates an unlinked sequence that can desync on restores.

  ```sql
  -- Before (legacy serial)
  CREATE TABLE items (id serial PRIMARY KEY);

  -- After (modern identity column)
  CREATE TABLE items (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);
  ```

## Data Types

- Prefer **`text`** over `varchar(n)` — there is no performance difference in PostgreSQL, and `varchar(n)` adds an unnecessary constraint that often needs migration later.

  ```sql
  -- Before
  CREATE TABLE profiles (name varchar(100), bio varchar(500));

  -- After
  CREATE TABLE profiles (name text NOT NULL, bio text NOT NULL DEFAULT '');
  ```

- Use **`timestamptz`** (not `timestamp`) for all time columns. `timestamp` silently drops timezone information.

  ```sql
  -- Before (loses timezone context)
  created_at timestamp DEFAULT now()

  -- After
  created_at timestamptz NOT NULL DEFAULT now()
  ```

- Use **`numeric`** or `integer` for money — never `float` or `double precision`. Floating-point types have rounding errors.

  ```sql
  -- Before (rounding errors)
  price double precision

  -- After
  price numeric(12, 2) NOT NULL CHECK (price >= 0)
  ```

- Use **`boolean`** — not `int` or `smallint` as a boolean proxy.

- Use **`inet`** / **`cidr`** for IP addresses — not `text`. These types support containment operators and indexing.

  ```sql
  -- Before
  ip_address text

  -- After
  ip_address inet NOT NULL
  ```

## PostgreSQL-Specific Types

- Use **arrays** for small, fixed-cardinality lists where you do not need to query individual elements relationally.

  ```sql
  -- Good use — tags are queried as a set, not joined
  CREATE TABLE articles (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title text NOT NULL,
    tags text[] NOT NULL DEFAULT '{}'
  );

  -- Query: articles with any of these tags
  SELECT * FROM articles WHERE tags && ARRAY['postgres', 'sql'];

  -- GIN index for array containment queries
  CREATE INDEX idx_articles_tags ON articles USING gin(tags);
  ```

- Use **enums** for stable, rarely-changing value sets. If values change frequently, use a lookup table or a `text` column with a `CHECK` constraint instead.

  ```sql
  -- Good — statuses are stable and finite
  CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');
  CREATE TABLE orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    status order_status NOT NULL DEFAULT 'pending'
  );

  -- Adding a new value (append only — cannot reorder or remove)
  ALTER TYPE order_status ADD VALUE 'refunded' AFTER 'cancelled';
  ```

  **Warning:** Enum values cannot be removed or reordered without recreating the type. If the value set is volatile, prefer `text` with `CHECK`:

  ```sql
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'))
  ```

- Use **ranges** for intervals (time ranges, numeric ranges) — they support overlap (`&&`), containment (`@>`), and exclusion constraints.

  ```sql
  CREATE TABLE reservations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id bigint NOT NULL REFERENCES rooms(id),
    during tstzrange NOT NULL,
    EXCLUDE USING gist (room_id WITH =, during WITH &&)
  );

  -- Query: overlapping reservations
  SELECT * FROM reservations WHERE during && tstzrange('2026-01-01', '2026-01-07');
  ```

- Use **`jsonb`** for semi-structured data that does not need relational integrity. Always prefer `jsonb` over `json` — `jsonb` is stored in a decomposed binary format, supports indexing, and is faster for reads.

  ```sql
  CREATE TABLE audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
  );

  -- GIN index for containment queries on JSONB
  CREATE INDEX idx_audit_metadata ON audit_logs USING gin(metadata);

  -- Query: logs where metadata contains a specific key-value
  SELECT * FROM audit_logs WHERE metadata @> '{"action": "delete"}';
  ```

  See also `references/queries.md` for JSONB query patterns and `references/indexing.md` for JSONB indexing strategies.

## Constraints

- Always use **`NOT NULL`** unless the column genuinely represents an optional/unknown value. Nullable columns complicate queries and defeat index efficiency.

- Use **`CHECK` constraints** for domain validation — they are evaluated at insertion/update time and provide clear error messages.

  ```sql
  CREATE TABLE products (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    price numeric(12, 2) NOT NULL CHECK (price >= 0),
    quantity int NOT NULL CHECK (quantity >= 0)
  );
  ```

- Use **exclusion constraints** with `EXCLUDE USING gist` to prevent overlapping ranges.

- Use **unique constraints** instead of unique indexes when the intent is data integrity (constraints carry semantic meaning; indexes are implementation details).

  ```sql
  -- Prefer (semantic)
  ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);

  -- Over (implementation detail)
  CREATE UNIQUE INDEX idx_users_email ON users (email);
  ```

## Naming Conventions

- Tables: **plural snake_case** (`order_items`, `user_profiles`).
- Columns: **singular snake_case** (`created_at`, `user_id`).
- Indexes: **`idx_{table}_{columns}`** (`idx_orders_user_id`).
- Constraints: **`{type}_{table}_{detail}`** (`uq_users_email`, `fk_orders_user_id`, `chk_products_price`).
- Functions: **verb_noun** (`get_user_by_email`, `calculate_total`).
