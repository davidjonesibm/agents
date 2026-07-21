# Supabase Performance Best Practices

---

## Query Optimization

- Always add **indexes** on columns used in RLS policy `USING` clauses and in `WHERE` / `eq()` / `order()` filters.

  ```sql
  -- Before (full table scan for user_id lookups)
  CREATE POLICY "own_data" ON messages
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = sender_id);

  -- After (index on the filtered column)
  CREATE INDEX idx_messages_sender_id ON messages (sender_id);
  ```

- Use **composite indexes** for queries that filter on multiple columns or combine filter + order.

  ```sql
  -- Before (two separate indexes, Postgres can only use one efficiently)
  CREATE INDEX idx_messages_channel ON messages (channel_id);
  CREATE INDEX idx_messages_created ON messages (created_at DESC);

  -- After (single composite index covers both filter and sort)
  CREATE INDEX idx_messages_channel_created
    ON messages (channel_id, created_at DESC);
  ```

- Use **GIN indexes** for full-text search on `tsvector` columns.

  ```sql
  -- Before (no index on search_vector — full table scan)
  ALTER TABLE messages ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

  -- After
  ALTER TABLE messages ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

  CREATE INDEX idx_messages_search_vector
    ON messages USING gin(search_vector);
  ```

- **Select only needed columns** — avoid `select('*')` on tables with many columns or large text/json fields.

  ```typescript
  // Before (transfers all columns including search_vector, content, etc.)
  const { data } = await supabase.from('messages').select('*');

  // After
  const { data } = await supabase
    .from('messages')
    .select('id, content, sender_id, type, created_at');
  ```

## RLS Performance

- Wrap `auth.uid()` and `auth.jwt()` calls in `(SELECT ...)` within RLS policies to trigger initPlan caching.

  ```sql
  -- Before (~180ms per query — function called per-row)
  CREATE POLICY "read_own" ON test_table
  TO authenticated
  USING (auth.uid() = user_id);

  -- After (~9ms per query — function cached per-statement)
  CREATE POLICY "read_own" ON test_table
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
  ```

  **Why:** Without `SELECT`, Postgres calls `auth.uid()` for every row. With `SELECT`, it runs once then reuses the result.

- Always specify the **role** with `TO authenticated` or `TO anon` to short-circuit policy evaluation for irrelevant roles.

  ```sql
  -- Before (policy body evaluated even for anon role)
  CREATE POLICY "read_own" ON messages
  USING ((SELECT auth.uid()) = sender_id);

  -- After (skipped entirely for anon users)
  CREATE POLICY "read_own" ON messages
  TO authenticated
  USING ((SELECT auth.uid()) = sender_id);
  ```

- **Add client-side filters** that duplicate the RLS policy condition to help the query planner build a better execution plan.

  ```typescript
  // Before (relies entirely on RLS, poor query plan)
  const { data } = await supabase.from('messages').select('*');

  // After (explicit filter helps query planner use indexes)
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('sender_id', userId);
  ```

- Rewrite RLS policies to **avoid joins to the source table**. Fetch filter criteria into a set using `IN` or `ANY`.

  ```sql
  -- Before (slow — joins to source table's team_id)
  CREATE POLICY "team_access" ON documents
  TO authenticated
  USING (
    (SELECT auth.uid()) IN (
      SELECT user_id FROM team_members
      WHERE team_members.team_id = team_id  -- implicit join to documents.team_id
    )
  );

  -- After (no join — fetches user's teams as a set)
  CREATE POLICY "team_access" ON documents
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = (SELECT auth.uid())
    )
  );
  ```

- Use **`SECURITY DEFINER` functions** for complex RLS checks that involve multiple table lookups.

  ```sql
  -- Before (complex subquery in policy, hard to optimize)
  CREATE POLICY "channel_access" ON messages
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN channels c ON c.group_id = gm.group_id
      WHERE c.id = messages.channel_id
      AND gm.user_id = (SELECT auth.uid())
    )
  );

  -- After (encapsulate in security definer function)
  CREATE FUNCTION private.user_can_access_channel(p_channel_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = ''
  AS $$
  BEGIN
    RETURN EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.channels c ON c.group_id = gm.group_id
      WHERE c.id = p_channel_id
      AND gm.user_id = (SELECT auth.uid())
    );
  END;
  $$;

  CREATE POLICY "channel_access" ON messages
  TO authenticated
  USING ((SELECT private.user_can_access_channel(channel_id)));
  ```

  See also `references/security.md` for SECURITY DEFINER placement rules.

## Connection Management

- On the **server-side service-role client**, disable session management to avoid unnecessary token refresh overhead.

  ```typescript
  // Before (default auth settings create overhead)
  const supabase = createClient(url, serviceKey);

  // After
  const supabase = createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  ```

- Use **Supavisor** (Supabase's built-in connection pooler) for high-concurrency applications. Connect via port 6543 for transaction-mode pooling.

  ```
  # Before (direct connection — one connection per client)
  postgresql://postgres:password@db.xyz.supabase.co:5432/postgres

  # After (pooled connection via Supavisor — shared connections)
  postgresql://postgres:password@db.xyz.supabase.co:6543/postgres
  ```

## Pagination

- Prefer **cursor-based pagination** over offset pagination for large datasets. Offset pagination degrades as page number increases.

  ```typescript
  // Before (offset — slow for deep pages, inconsistent with concurrent writes)
  const { data } = await supabase
    .from('messages')
    .select('*')
    .range(1000, 1049);

  // After (cursor — consistent performance regardless of depth)
  const { data } = await supabase
    .from('messages')
    .select('*')
    .lt('created_at', cursor)
    .order('created_at', { ascending: false })
    .limit(50);
  ```

- Fetch `limit + 1` rows to determine if more pages exist without a separate count query.

  ```typescript
  // Before (separate count query)
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true });
  const { data } = await supabase.from('messages').select('*').limit(50);

  // After (overfetch by 1)
  const limit = 50;
  const { data } = await supabase
    .from('messages')
    .select('*')
    .limit(limit + 1);

  const hasMore = data.length > limit;
  const items = data.slice(0, limit);
  ```

## Batch Operations

- Use batch inserts instead of inserting rows in a loop to reduce round-trips.

  ```typescript
  // Before (N round-trips)
  for (const id of userIds) {
    await supabase.from('group_members').insert({ group_id: gid, user_id: id });
  }

  // After (1 round-trip)
  const rows = userIds.map((id) => ({ group_id: gid, user_id: id }));
  const { error } = await supabase.from('group_members').insert(rows);
  ```

- Use `Promise.all()` for independent queries that don't depend on each other.

  ```typescript
  // Before (sequential — total time = sum of all queries)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
  const { data: groups } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', uid);

  // After (parallel — total time = max of all queries)
  const [profileRes, groupsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    supabase.from('group_members').select('group_id').eq('user_id', uid),
  ]);
  ```
