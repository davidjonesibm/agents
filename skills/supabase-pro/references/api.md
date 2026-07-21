# Supabase JS v2 API — Modern Usage & Deprecated Patterns

Target: `@supabase/supabase-js` v2.x (latest stable).

---

- Always chain `.select()` after `.insert()`, `.update()`, or `.upsert()` when you need the returned data. Without `.select()`, the response `data` is `null`.

  ```typescript
  // Before (data is always null)
  const { data, error } = await supabase
    .from('channels')
    .insert({ name: 'general', group_id: groupId });

  // After
  const { data, error } = await supabase
    .from('channels')
    .insert({ name: 'general', group_id: groupId })
    .select()
    .single();
  ```

- Use `.single()` when you expect exactly one row. Use `.maybeSingle()` when the row may not exist (returns `null` instead of an error).

  ```typescript
  // Before (throws PGRST116 if no row found)
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // After (returns null if not found, no error)
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  ```

- Use `.select('col1, col2')` to fetch only needed columns instead of `.select('*')`. This reduces payload size and improves performance.

  ```typescript
  // Before
  const { data } = await supabase.from('messages').select('*');

  // After
  const { data } = await supabase
    .from('messages')
    .select('id, content, sender_id, created_at');
  ```

- Use relation queries (nested selects) instead of manual joins or N+1 queries.

  ```typescript
  // Before (N+1 — fetches profiles separately)
  const { data: messages } = await supabase.from('messages').select('*');
  for (const msg of messages) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', msg.sender_id)
      .single();
  }

  // After (single query with joined data)
  const { data } = await supabase
    .from('messages')
    .select('id, content, profiles!sender_id(username, avatar)');
  ```

- Use `.in()` for matching against arrays instead of multiple `.or()` calls.

  ```typescript
  // Before
  const { data } = await supabase
    .from('channels')
    .select('*')
    .or('id.eq.abc,id.eq.def,id.eq.ghi');

  // After
  const { data } = await supabase
    .from('channels')
    .select('*')
    .in('id', ['abc', 'def', 'ghi']);
  ```

- Use `.textSearch()` for full-text search with tsvector columns instead of `.ilike()` for large datasets.

  ```typescript
  // Before (slow on large tables)
  const { data } = await supabase
    .from('messages')
    .select('*')
    .ilike('content', '%search term%');

  // After
  const { data } = await supabase
    .from('messages')
    .select('*')
    .textSearch('search_vector', 'search term', {
      type: 'plain',
      config: 'english',
    });
  ```

  **Why:** `textSearch` uses GIN indexes and is orders of magnitude faster. See also `references/performance.md`.

- Use `onConflict` with `.upsert()` to handle unique constraint conflicts.

  ```typescript
  // Before (insert then check for conflict manually)
  const { data: existing } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!existing) {
    await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: userId });
  }

  // After
  const { data, error } = await supabase
    .from('group_members')
    .upsert(
      { group_id: groupId, user_id: userId },
      { onConflict: 'group_id,user_id' },
    );
  ```

- Use `.order()` with `referencedTable` when ordering by a joined table's column.

  ```typescript
  // Before (incorrect — orders by the source table)
  const { data } = await supabase
    .from('group_members')
    .select('groups(*)')
    .order('created_at', { ascending: false });

  // After
  const { data } = await supabase
    .from('group_members')
    .select('groups(*)')
    .order('created_at', { ascending: false, referencedTable: 'groups' });
  ```

- Use `.range()` for offset-based pagination or cursor-based filtering with `.lt()` / `.gt()` for cursor pagination.

  ```typescript
  // Offset pagination
  const { data } = await supabase.from('messages').select('*').range(0, 49);

  // Cursor pagination (preferred for large datasets)
  const { data } = await supabase
    .from('messages')
    .select('*')
    .lt('created_at', cursor)
    .order('created_at', { ascending: false })
    .limit(50);
  ```

- Use `.abortSignal()` to cancel long-running queries when the caller disconnects.

  ```typescript
  // Before (query runs to completion even if client disconnects)
  const { data } = await supabase.from('messages').select('*');

  // After
  const controller = new AbortController();
  const { data } = await supabase
    .from('messages')
    .select('*')
    .abortSignal(controller.signal);
  ```

- Always destructure both `data` and `error` from query results. Never ignore `error`.

  ```typescript
  // Before (ignores potential errors)
  const { data } = await supabase.from('channels').select('*');

  // After
  const { data, error } = await supabase.from('channels').select('*');
  if (error) {
    throw new Error(`Failed to fetch channels: ${error.message}`);
  }
  ```

- Use `.overrideTypes<T>()` when working with database views or complex queries where inferred types are incorrect.

  ```typescript
  // Before (types are unknown or wrong for views)
  const { data } = await supabase.from('message_stats_view').select('*');

  // After
  type MessageStats = { channel_id: string; message_count: number };
  const { data } = await supabase
    .from('message_stats_view')
    .select('*')
    .overrideTypes<MessageStats[]>();
  ```

- Use `.rpc()` for calling database functions instead of raw SQL through the client.

  ```typescript
  // Before (no RPC, doing computation client-side)
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('channel_id', channelId);
  const count = messages?.length ?? 0;

  // After (let the database do the work)
  const { data, error } = await supabase.rpc('get_message_count', {
    p_channel_id: channelId,
  });
  ```
