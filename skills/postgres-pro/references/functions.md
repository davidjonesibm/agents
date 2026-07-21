# PL/pgSQL Functions, Triggers, and Stored Procedures

Best practices for writing PostgreSQL functions, triggers, and stored procedures.

---

## Functions vs. Procedures

- Use **functions** (`CREATE FUNCTION`) when you need to return a value or use the result in a query.
- Use **procedures** (`CREATE PROCEDURE`, PostgreSQL 11+) for multi-statement operations that need transaction control (`COMMIT`/`ROLLBACK` within the body).

  ```sql
  -- Function — returns a value, callable in SELECT
  CREATE OR REPLACE FUNCTION get_user_balance(p_user_id bigint)
  RETURNS numeric
  LANGUAGE sql STABLE
  AS $$
    SELECT balance FROM accounts WHERE user_id = p_user_id;
  $$;

  -- Procedure — transaction control, callable with CALL
  CREATE OR REPLACE PROCEDURE transfer_funds(
    p_from bigint, p_to bigint, p_amount numeric
  )
  LANGUAGE plpgsql
  AS $$
  BEGIN
    UPDATE accounts SET balance = balance - p_amount WHERE user_id = p_from;
    UPDATE accounts SET balance = balance + p_amount WHERE user_id = p_to;
    -- Can COMMIT or ROLLBACK here in a procedure
  END;
  $$;

  CALL transfer_funds(1, 2, 100.00);
  ```

## Function Volatility

- Always set the correct **volatility category** — it affects query optimization.
  - **`IMMUTABLE`** — never changes for the same inputs. Safe for index expressions. (e.g., `lower()`, math functions).
  - **`STABLE`** — doesn't modify the database, returns the same result within a single statement/transaction. (e.g., `now()`, lookups).
  - **`VOLATILE`** (default) — can return different results on each call, may have side effects. (e.g., `random()`, functions that modify data).

  ```sql
  -- Before (default VOLATILE — prevents index usage)
  CREATE FUNCTION normalize_email(email text) RETURNS text
  LANGUAGE sql AS $$ SELECT lower(trim(email)); $$;

  -- After (IMMUTABLE — can be used in index expressions)
  CREATE FUNCTION normalize_email(email text) RETURNS text
  LANGUAGE sql IMMUTABLE
  AS $$ SELECT lower(trim(email)); $$;

  CREATE INDEX idx_users_norm_email ON users (normalize_email(email));
  ```

  **Warning:** Marking a function as `IMMUTABLE` when it is not causes **incorrect query results** — PostgreSQL caches the result.

## PL/pgSQL Best Practices

- Use **`RETURNS TABLE`** or **`RETURNS SETOF`** for functions that return multiple rows.

  ```sql
  CREATE OR REPLACE FUNCTION get_active_users()
  RETURNS TABLE (id bigint, email text, last_login timestamptz)
  LANGUAGE sql STABLE
  AS $$
    SELECT id, email, last_login FROM users WHERE active = true;
  $$;

  -- Use in a query
  SELECT * FROM get_active_users() WHERE last_login > now() - interval '7 days';
  ```

- Prefer **SQL language** over PL/pgSQL for simple one-statement functions — SQL functions can be inlined by the planner.

  ```sql
  -- SQL function (inlineable — planner can optimize)
  CREATE FUNCTION user_exists(p_email text) RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT EXISTS (SELECT 1 FROM users WHERE email = p_email); $$;

  -- PL/pgSQL function (not inlineable — treated as a black box)
  CREATE FUNCTION user_exists(p_email text) RETURNS boolean
  LANGUAGE plpgsql STABLE
  AS $$
  BEGIN
    RETURN EXISTS (SELECT 1 FROM users WHERE email = p_email);
  END;
  $$;
  ```

- Use **`EXECUTE ... USING`** for dynamic SQL — never concatenate parameters.

  ```sql
  CREATE FUNCTION count_rows(p_table text) RETURNS bigint
  LANGUAGE plpgsql STABLE
  AS $$
  DECLARE
    row_count bigint;
  BEGIN
    EXECUTE format('SELECT count(*) FROM %I', p_table) INTO row_count;
    RETURN row_count;
  END;
  $$;
  ```

  See also `references/security.md` for SQL injection prevention in PL/pgSQL.

- Use **`RAISE`** for errors with meaningful messages and error codes.

  ```sql
  CREATE FUNCTION withdraw(p_account_id bigint, p_amount numeric)
  RETURNS numeric
  LANGUAGE plpgsql
  AS $$
  DECLARE
    current_balance numeric;
  BEGIN
    SELECT balance INTO current_balance FROM accounts WHERE id = p_account_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found', p_account_id USING ERRCODE = 'P0002';
    END IF;

    IF current_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient funds: balance=%, requested=%', current_balance, p_amount
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE accounts SET balance = balance - p_amount WHERE id = p_account_id;
    RETURN current_balance - p_amount;
  END;
  $$;
  ```

## SECURITY DEFINER Functions

- `SECURITY DEFINER` functions run with the privileges of the **function owner**, not the caller. Use them to grant controlled access to data the caller cannot directly query.

- **Always set `search_path = ''`** on SECURITY DEFINER functions to prevent search-path injection.

  ```sql
  -- Before (vulnerable to search_path manipulation)
  CREATE FUNCTION admin_get_users() RETURNS SETOF users
  LANGUAGE sql SECURITY DEFINER
  AS $$ SELECT * FROM users; $$;

  -- After
  CREATE FUNCTION admin_get_users() RETURNS SETOF public.users
  LANGUAGE sql SECURITY DEFINER
  SET search_path = ''
  AS $$ SELECT * FROM public.users; $$;
  ```

- Place SECURITY DEFINER functions in a **private schema** to prevent direct API invocation (especially in Supabase/PostgREST environments).

  See also `references/security.md` for detailed SECURITY DEFINER patterns.

## Triggers

- Use triggers for **audit logging**, **derived column updates**, and **cross-table consistency** — not for business logic that belongs in the application layer.

  ```sql
  -- Audit trigger — automatically log changes
  CREATE OR REPLACE FUNCTION audit_trigger()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    INSERT INTO audit_log (table_name, operation, row_id, changed_at, old_data, new_data)
    VALUES (
      TG_TABLE_NAME,
      TG_OP,
      coalesce(NEW.id, OLD.id),
      now(),
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  END;
  $$;

  CREATE TRIGGER trg_orders_audit
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  ```

- Use **`BEFORE` triggers** to modify the row before it is written, **`AFTER` triggers** for side effects.

  ```sql
  -- BEFORE INSERT — auto-set updated_at
  CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$;

  CREATE TRIGGER trg_set_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  ```

- Use **statement-level triggers** (`FOR EACH STATEMENT`) when you need to act once per statement, not per row.

- **Avoid long-running operations in triggers** — they execute within the transaction and delay the commit.

## Common Function/Trigger Mistakes

- **Marking a function as IMMUTABLE when it reads tables** — this is incorrect and causes stale cached results.
- **Using triggers for complex business logic** — triggers are invisible to application developers and hard to debug. Keep them simple.
- **Forgetting `RETURN NEW`** in BEFORE triggers — returning NULL silently cancels the row operation.
- **Not handling `TG_OP`** in multi-operation triggers — always check `IF TG_OP = 'INSERT'` etc.
- **Creating recursive triggers** — trigger A modifies table B, which fires trigger B that modifies table A. Use `pg_trigger_depth()` to guard against recursion.
