# Security

Best practices for PostgreSQL Row Level Security, permissions, and SQL injection prevention.

---

## Row Level Security (RLS)

- **Enable RLS on every table that stores user-facing data**, even if you currently only access it via a trusted backend.

  ```sql
  -- Before (no RLS — any role with SELECT can read all rows)
  CREATE TABLE documents (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id bigint NOT NULL REFERENCES users(id),
    content text NOT NULL
  );

  -- After
  CREATE TABLE documents (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id bigint NOT NULL REFERENCES users(id),
    content text NOT NULL
  );
  ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
  ```

- **Always specify `TO <role>`** in policies to restrict which roles the policy applies to. Policies without `TO` apply to all roles.

  ```sql
  -- Before (applies to all roles, including superusers bypassing intent)
  CREATE POLICY "read_own" ON documents
  FOR SELECT USING (owner_id = current_setting('app.user_id')::bigint);

  -- After
  CREATE POLICY "read_own" ON documents
  FOR SELECT TO app_user
  USING (owner_id = current_setting('app.user_id')::bigint);
  ```

- **Use `WITH CHECK` on `INSERT` and `UPDATE`** policies to prevent privilege escalation.

  ```sql
  CREATE POLICY "update_own" ON documents
  FOR UPDATE TO app_user
  USING (owner_id = current_setting('app.user_id')::bigint)
  WITH CHECK (owner_id = current_setting('app.user_id')::bigint);
  ```

  **Why:** Without `WITH CHECK`, a user could `UPDATE` a row they own to change `owner_id` to someone else's ID.

- Use **`FORCE ROW LEVEL SECURITY`** on tables accessed by the table owner, since RLS is bypassed for table owners by default.

  ```sql
  ALTER TABLE documents FORCE ROW LEVEL SECURITY;
  ```

- Index columns used in RLS policy `USING` clauses — every query against the table will filter on them.

  ```sql
  CREATE INDEX idx_documents_owner ON documents (owner_id);
  ```

  See also `references/performance.md` for RLS performance patterns.

## Permissions and Roles

- Follow the **principle of least privilege** — application roles should only have the permissions they need.

  ```sql
  -- Create a read-only role for reporting
  CREATE ROLE reporting_reader;
  GRANT CONNECT ON DATABASE mydb TO reporting_reader;
  GRANT USAGE ON SCHEMA public TO reporting_reader;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporting_reader;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO reporting_reader;
  ```

- **Never use the `postgres` superuser** for application connections. Create dedicated roles.

  ```sql
  -- Application role with limited permissions
  CREATE ROLE app_backend LOGIN PASSWORD 'use-a-password-manager';
  GRANT CONNECT ON DATABASE mydb TO app_backend;
  GRANT USAGE ON SCHEMA public TO app_backend;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_backend;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_backend;
  ```

- **Revoke `CREATE` on `public` schema** — by default, any role can create objects in the `public` schema.

  ```sql
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;
  ```

- Use **`SET search_path = ''`** on `SECURITY DEFINER` functions to prevent search-path injection attacks.

  ```sql
  -- Before (vulnerable to search_path manipulation)
  CREATE FUNCTION get_user_count() RETURNS bigint
  LANGUAGE sql SECURITY DEFINER
  AS $$ SELECT count(*) FROM users; $$;

  -- After
  CREATE FUNCTION get_user_count() RETURNS bigint
  LANGUAGE sql SECURITY DEFINER
  SET search_path = ''
  AS $$ SELECT count(*) FROM public.users; $$;
  ```

## SQL Injection Prevention

- **Always use parameterized queries** from application code. Never concatenate user input into SQL strings.

  ```typescript
  // Before (SQL injection vulnerability)
  const result = await pool.query(
    `SELECT * FROM users WHERE email = '${email}'`,
  );

  // After (parameterized query)
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [
    email,
  ]);
  ```

- In **PL/pgSQL**, use `EXECUTE ... USING` for dynamic SQL — never concatenate parameters.

  ```sql
  -- Before (SQL injection in PL/pgSQL)
  CREATE FUNCTION find_user(p_email text) RETURNS SETOF users AS $$
  BEGIN
    RETURN QUERY EXECUTE 'SELECT * FROM users WHERE email = ''' || p_email || '''';
  END;
  $$ LANGUAGE plpgsql;

  -- After (parameterized dynamic SQL)
  CREATE FUNCTION find_user(p_email text) RETURNS SETOF users AS $$
  BEGIN
    RETURN QUERY EXECUTE 'SELECT * FROM users WHERE email = $1' USING p_email;
  END;
  $$ LANGUAGE plpgsql;
  ```

- When you **must** dynamically build identifiers (table/column names), use `format()` with `%I` (identifier) and `%L` (literal) — never `%s`.

  ```sql
  -- Safe dynamic table name
  EXECUTE format('SELECT * FROM %I WHERE id = $1', table_name) USING row_id;
  ```

## Data Protection

- Use **`pgcrypto`** for hashing sensitive data stored in the database.

  ```sql
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  -- Hash a value (one-way)
  INSERT INTO api_keys (key_hash) VALUES (crypt('raw-key', gen_salt('bf')));

  -- Verify
  SELECT * FROM api_keys WHERE key_hash = crypt('raw-key', key_hash);
  ```

- **Never store plaintext passwords** — always hash with `crypt()` / `gen_salt('bf')` (bcrypt) or handle hashing in the application layer.

- Enable **SSL (`sslmode=verify-full`)** for all connections, especially over networks.

  ```
  # postgresql.conf
  ssl = on
  ssl_cert_file = '/path/to/server.crt'
  ssl_key_file = '/path/to/server.key'
  ```

- Restrict access in **`pg_hba.conf`** — never use `trust` authentication in production.

  ```
  # pg_hba.conf — require scram-sha-256 for all connections
  host  all  all  0.0.0.0/0  scram-sha-256
  ```

See also `references/functions.md` for SECURITY DEFINER function patterns.
