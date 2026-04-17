# Idiomatic Supabase Patterns

---

- Use the **service-role client on the server** and the **anon client on the browser**. Never mix them.

  ```typescript
  // Before (service role key in browser — CRITICAL SECURITY ISSUE)
  const supabase = createClient(url, process.env.SUPABASE_SECRET!);

  // After — Server (Fastify plugin)
  const supabaseAdmin = createClient<Database>(
    url,
    process.env.SUPABASE_SECRET!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );

  // After — Browser (anon key, auth only)
  const supabase = createClient(url, publicAnonKey);
  ```

  **Why:** The service-role key bypasses RLS and has full database access. See also `references/security.md`.

- Use the `fastify-plugin` pattern to register the Supabase client as a Fastify decorator.

  ```typescript
  // Before (creating client in every route file)
  export default async function (fastify: FastifyInstance) {
    const supabase = createClient(url, key);
    // ...
  }

  // After (registered once as plugin, available everywhere)
  // plugins/supabase.ts
  const supabasePlugin: FastifyPluginAsync = async (fastify) => {
    const client = createClient<Database>(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    fastify.decorate('supabaseAdmin', client);
  };
  export default fp(supabasePlugin, { name: 'supabase-plugin' });

  // routes/channels.ts — access via fastify.supabaseAdmin
  const { data } = await fastify.supabaseAdmin.from('channels').select('*');
  ```

- Prefer `.select().single()` over `.select()` + array index access when expecting exactly one row.

  ```typescript
  // Before
  const { data } = await supabase.from('profiles').select('*').eq('id', userId);
  const profile = data?.[0];

  // After
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  ```

- Use database functions (RPC) for multi-step operations that must be atomic.

  ```sql
  -- Database function for atomic group creation
  CREATE OR REPLACE FUNCTION create_group_with_channel(
    p_name text,
    p_description text,
    p_owner_id uuid
  ) RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
  DECLARE
    v_group_id uuid;
    v_channel_id uuid;
  BEGIN
    INSERT INTO public.groups (name, description, owner_id)
    VALUES (p_name, p_description, p_owner_id)
    RETURNING id INTO v_group_id;

    INSERT INTO public.group_members (group_id, user_id)
    VALUES (v_group_id, p_owner_id);

    INSERT INTO public.channels (name, group_id, description, is_default)
    VALUES ('general', v_group_id, 'General discussion', true)
    RETURNING id INTO v_channel_id;

    RETURN json_build_object('group_id', v_group_id, 'channel_id', v_channel_id);
  END;
  $$;
  ```

  ```typescript
  // Before (3 separate queries, not atomic)
  const { data: group } = await supabase.from('groups').insert({ ... }).select().single()
  await supabase.from('group_members').insert({ group_id: group.id, user_id: userId })
  await supabase.from('channels').insert({ name: 'general', group_id: group.id })

  // After (single atomic RPC call)
  const { data, error } = await supabase.rpc('create_group_with_channel', {
    p_name: name,
    p_description: description,
    p_owner_id: userId,
  })
  ```

- Use batch inserts instead of inserting rows in a loop.

  ```typescript
  // Before (N separate inserts)
  for (const member of memberIds) {
    await supabase
      .from('group_members')
      .insert({ group_id: gid, user_id: member });
  }

  // After (single batch insert)
  const rows = memberIds.map((uid) => ({ group_id: gid, user_id: uid }));
  const { error } = await supabase.from('group_members').insert(rows);
  ```

- Use `count` option on `.select()` to get row count without fetching all rows.

  ```typescript
  // Before (fetches all rows just to count)
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('channel_id', channelId);
  const total = data?.length ?? 0;

  // After (only gets the count)
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', channelId);
  ```

- Always check membership / authorization before executing queries in route handlers.

  ```typescript
  // Before (query first, check after — data leak risk)
  const { data: channel } = await fastify.supabaseAdmin
    .from('channels')
    .select('*')
    .eq('id', channelId)
    .single();
  // then check if user is a member...

  // After (verify membership first)
  const { data: membership } = await fastify.supabaseAdmin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    throw fastify.httpErrors.forbidden('Not a member of this group');
  }

  const { data: channel } = await fastify.supabaseAdmin
    .from('channels')
    .select('*')
    .eq('id', channelId)
    .single();
  ```

- Map database column names to API response field names at the route level, not in the database.

  ```typescript
  // Before (returning raw DB columns to the client)
  return channel;

  // After (map to API shape)
  return {
    id: channel.id,
    name: channel.name,
    group: channel.group_id,
    description: channel.description || '',
    is_default: channel.is_default,
    created_at: channel.created_at,
    updated_at: channel.updated_at,
  };
  ```

- Use `Promise.all()` for independent queries that can run in parallel.

  ```typescript
  // Before (sequential, slower)
  const { data: channels } = await supabase
    .from('channels')
    .select('*')
    .eq('group_id', gid);
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', gid);

  // After (parallel)
  const [channelsResult, membersResult] = await Promise.all([
    supabase.from('channels').select('*').eq('group_id', gid),
    supabase.from('group_members').select('user_id').eq('group_id', gid),
  ]);
  ```

- Use `GENERATED ALWAYS AS ... STORED` for derived columns like search vectors.

  ```sql
  -- Before (trigger-based, harder to maintain)
  CREATE TRIGGER update_search_vector BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_message_search_vector();

  -- After (auto-computed, always consistent)
  ALTER TABLE messages ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
  ```

  See also `references/migrations.md` for more SQL patterns.

- Escape user input used in `.ilike()` or `.like()` filters to prevent wildcard injection.

  ```typescript
  // Before (user can inject % or _ wildcards)
  const { data } = await supabase
    .from('messages')
    .select('*')
    .ilike('content', `%${userInput}%`);

  // After
  const escaped = userInput.replace(/[%_]/g, '\\$&');
  const { data } = await supabase
    .from('messages')
    .select('*')
    .ilike('content', `%${escaped}%`);
  ```
