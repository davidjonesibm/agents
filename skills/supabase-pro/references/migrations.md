# SQL Migration Best Practices

Target: PostgreSQL 15+ via Supabase migrations.

---

## Table Design

- Use `uuid` primary keys with `gen_random_uuid()` default. Never use serial/auto-increment for distributed systems.

  ```sql
  -- Before
  CREATE TABLE channels (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
  );

  -- After
  CREATE TABLE channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
  );
  ```

- Always include `created_at` and `updated_at` timestamp columns with defaults.

  ```sql
  -- Before
  CREATE TABLE channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
  );

  -- After
  CREATE TABLE channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ```

- Use `timestamptz` (not `timestamp`) for all time columns to avoid timezone ambiguity.

  ```sql
  -- Before (timezone-naive — ambiguous)
  created_at timestamp DEFAULT now()

  -- After (timezone-aware)
  created_at timestamptz DEFAULT now() NOT NULL
  ```

- Use `text` instead of `varchar(n)` unless you need a strict length constraint. Postgres `text` has no performance penalty.

  ```sql
  -- Before (arbitrary length limit)
  username varchar(50)

  -- After
  username text
  -- Add CHECK constraint if you truly need a max length:
  username text CHECK (char_length(username) <= 50)
  ```

## Foreign Keys

- Always specify `ON DELETE` behavior. Use `CASCADE` for child entities, `SET NULL` for optional references.

  ```sql
  -- Before (default ON DELETE NO ACTION — orphaned rows)
  CREATE TABLE channels (
    group_id uuid REFERENCES groups(id)
  );

  -- After
  CREATE TABLE channels (
    group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL
  );

  -- For optional owner references:
  CREATE TABLE groups (
    owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
  );
  ```

- Only reference **primary keys** of Supabase-managed tables (`auth.users`). Never reference unique constraints — they can change.

  ```sql
  -- Before (references a unique index — might change)
  CREATE TABLE profiles (
    email text REFERENCES auth.users(email)
  );

  -- After (references the PK)
  CREATE TABLE profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
  );
  ```

## Junction Tables

- Use composite primary keys for junction / many-to-many tables. No separate `id` column needed.

  ```sql
  -- Before (unnecessary surrogate key)
  CREATE TABLE group_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    UNIQUE (group_id, user_id)
  );

  -- After (composite PK)
  CREATE TABLE group_members (
    group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (group_id, user_id)
  );
  ```

## Constraints

- Use `CHECK` constraints for value validation instead of relying on application-level checks.

  ```sql
  -- Before (no constraint — DB accepts any string)
  CREATE TABLE messages (
    type text NOT NULL
  );

  -- After
  CREATE TABLE messages (
    type text NOT NULL CHECK (type IN ('text', 'system', 'giphy', 'image'))
  );
  ```

- Use `UNIQUE` constraints with compound columns to prevent duplicates.

  ```sql
  -- Before (allows duplicate reactions)
  CREATE TABLE message_reactions (
    message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    emoji text NOT NULL
  );

  -- After
  CREATE TABLE message_reactions (
    message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    emoji text NOT NULL CHECK (char_length(emoji) <= 10),
    UNIQUE (message_id, user_id, emoji)
  );
  ```

## RLS in Migrations

- **Always enable RLS** on new tables in the same migration that creates the table.

  ```sql
  -- Before (RLS added later or forgotten)
  CREATE TABLE group_invites ( ... );

  -- After (in the same migration file)
  CREATE TABLE group_invites ( ... );
  ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "members_can_view_invites" ON group_invites
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_id = group_invites.group_id
      AND user_id = (SELECT auth.uid())
    )
  );
  ```

  See also `references/security.md` for RLS patterns.

## Triggers and Functions

- Use `SECURITY DEFINER` with `SET search_path = ''` on all trigger functions.

  ```sql
  -- Before (vulnerable search path)
  CREATE FUNCTION handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    INSERT INTO profiles (id, username)
    VALUES (new.id, new.raw_user_meta_data->>'username');
    RETURN new;
  END;
  $$;

  -- After
  CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = ''
  AS $$
  BEGIN
    INSERT INTO public.profiles (id, username, name)
    VALUES (
      new.id,
      new.raw_user_meta_data ->> 'username',
      new.raw_user_meta_data ->> 'name'
    );
    RETURN new;
  END;
  $$;
  ```

- Use `CREATE OR REPLACE` for functions and `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER` for idempotency.

  ```sql
  -- Before (fails on re-run)
  CREATE FUNCTION handle_new_user() RETURNS trigger ...;
  CREATE TRIGGER on_auth_user_created ...;

  -- After (idempotent)
  CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger ...;
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  ```

## Indexes

- Create indexes for columns used in `WHERE`, `JOIN`, and `ORDER BY` clauses.

  ```sql
  -- For foreign key lookups (not auto-indexed in Postgres)
  CREATE INDEX idx_messages_channel_id ON messages (channel_id);

  -- For composite filter + order queries
  CREATE INDEX idx_messages_channel_created
    ON messages (channel_id, created_at DESC);

  -- For full-text search
  CREATE INDEX idx_messages_search_vector
    ON messages USING gin(search_vector);
  ```

- Use `IF NOT EXISTS` on indexes for idempotent migrations.

  ```sql
  -- Before (fails if re-run)
  CREATE INDEX idx_messages_channel_id ON messages (channel_id);

  -- After
  CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages (channel_id);
  ```

## Generated Columns

- Use `GENERATED ALWAYS AS ... STORED` for derived data (e.g., search vectors) instead of triggers.

  ```sql
  -- Before (trigger approach — separate function needed)
  CREATE FUNCTION update_search_vector() RETURNS trigger ...;
  CREATE TRIGGER trg_messages_search BEFORE INSERT OR UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_search_vector();

  -- After (generated column — automatic, always consistent)
  ALTER TABLE messages ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
  ```

## Migration Naming

- Use the timestamp prefix format: `YYYYMMDDHHMMSS_descriptive_name.sql`.

  ```
  -- Before
  001_create_tables.sql
  add_messages.sql

  -- After
  20260324000001_initial_schema.sql
  20260402000001_add_message_search.sql
  20260405000002_add_message_reactions.sql
  ```

## database.types.ts Contract

- **Every migration that creates a new table MUST be accompanied by a corresponding update to `database.types.ts`.**

  ```
  -- Creating: 20260410000001_add_user_settings.sql
  -- Must also update: apps/backend/database.types.ts

  -- Add Row, Insert, Update, Relationships for the new table
  ```

  See `references/typescript.md` for the exact type structure.
