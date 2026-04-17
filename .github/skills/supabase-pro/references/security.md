# Supabase Security Best Practices

---

## Row Level Security (RLS)

- **Always enable RLS** on every table in the `public` schema, even if only accessed via service-role.

  ```sql
  -- Before (RLS not enabled — table fully exposed via API)
  CREATE TABLE public.messages ( ... );

  -- After
  CREATE TABLE public.messages ( ... );
  ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
  ```

  **Why:** Defense in depth — if the anon key is ever leaked, RLS prevents unauthorized access.

- Always specify the **target role** with `TO` in policies. This prevents the policy body from executing for irrelevant roles.

  ```sql
  -- Before (runs for all roles including anon)
  CREATE POLICY "users can read own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id);

  -- After
  CREATE POLICY "users can read own messages" ON messages
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = sender_id);
  ```

  See also `references/performance.md` for why `TO` improves performance.

- Wrap `auth.uid()` and `auth.jwt()` in a `SELECT` subquery within policies to enable Postgres query plan caching.

  ```sql
  -- Before (function called per-row)
  CREATE POLICY "own_data" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

  -- After (function cached per-statement via initPlan)
  CREATE POLICY "own_data" ON profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);
  ```

- Explicitly check for `auth.uid() IS NOT NULL` when unauthenticated access is possible.

  ```sql
  -- Before (silently fails for anonymous — null = user_id is always false)
  CREATE POLICY "read_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

  -- After (explicit intent)
  CREATE POLICY "read_own" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND (SELECT auth.uid()) = id);
  ```

- For `UPDATE` policies, always include both `USING` and `WITH CHECK` to prevent privilege escalation.

  ```sql
  -- Before (missing WITH CHECK — user could change user_id to another user's)
  CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id);

  -- After
  CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
  ```

- Use `EXISTS` subqueries for membership checks in policies to avoid joins to the source table.

  ```sql
  -- Before (join to source table — slower)
  CREATE POLICY "group_members_read_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IN (
      SELECT user_id FROM group_members
      WHERE group_members.group_id = (
        SELECT group_id FROM channels WHERE channels.id = messages.channel_id
      )
    )
  );

  -- After (EXISTS with no source-table join)
  CREATE POLICY "group_members_read_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      JOIN channels c ON c.group_id = gm.group_id
      WHERE c.id = messages.channel_id
      AND gm.user_id = (SELECT auth.uid())
    )
  );
  ```

  See also `references/performance.md` for join optimization.

- Place `SECURITY DEFINER` functions in a **private schema** (not `public`) to prevent direct API invocation.

  ```sql
  -- Before (accessible via PostgREST API — security risk)
  CREATE FUNCTION public.is_group_member(gid uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER AS $$ ... $$;

  -- After
  CREATE FUNCTION private.is_group_member(gid uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = ''
  AS $$ ... $$;
  ```

- Always set `search_path = ''` on `SECURITY DEFINER` functions to prevent search path hijacking.

  ```sql
  -- Before (vulnerable to search path manipulation)
  CREATE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    INSERT INTO profiles (id, username) VALUES (new.id, new.raw_user_meta_data->>'username');
    RETURN new;
  END;
  $$;

  -- After
  CREATE FUNCTION public.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = ''
  AS $$
  BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (new.id, new.raw_user_meta_data ->> 'username');
    RETURN new;
  END;
  $$;
  ```

## Service Role vs Anon Key

- **Never expose the service-role key** to the browser or client-side code.

  ```typescript
  // Before (service key in environment accessible to browser)
  // .env
  VITE_SUPABASE_KEY=your-service-role-key  // CRITICAL VULNERABILITY

  // After — frontend .env
  VITE_SUPABASE_URL=https://xyz.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key  // safe: RLS enforced

  // After — backend .env (never prefix with VITE_)
  SUPABASE_SECRET=your-service-role-key  // only server-side
  ```

- Disable session features on the service-role client to prevent token leaks.

  ```typescript
  // Before (session persistence enabled — leaks tokens in server-side storage)
  const supabaseAdmin = createClient(url, serviceKey);

  // After
  const supabaseAdmin = createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  ```

## JWT Verification

- Verify tokens using `supabase.auth.getUser(token)` — never decode JWTs manually for auth decisions.

  ```typescript
  // Before (manual decode — doesn't verify signature or expiration)
  import jwt from 'jsonwebtoken';
  const decoded = jwt.decode(token);
  const userId = decoded?.sub;

  // After (server-side verification via Supabase)
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw reply.unauthorized('Invalid or expired token');
  }
  ```

- For WebSocket auth, pass the JWT as a query parameter and validate it in the connection handler.

  ```typescript
  // Before (no auth on WebSocket connections)
  fastify.get('/ws', { websocket: true }, (socket) => { ... })

  // After
  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    const token = (request.query as { token?: string }).token
    if (!token) { socket.close(4001, 'Missing token'); return }

    const { data: { user }, error } = await fastify.supabaseAdmin.auth.getUser(token)
    if (error || !user) { socket.close(4001, 'Invalid token'); return }

    // Attach user to socket context
    socket.user = user
  })
  ```

## Storage Security

- Use **private buckets** by default. Only make buckets public when files must be accessible without authentication.

  ```typescript
  // Before (public bucket for user uploads — anyone can access)
  await supabase.storage.createBucket('avatars', { public: true });

  // After (private bucket with signed URLs)
  await supabase.storage.createBucket('avatars', {
    public: false,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  ```

  See also `references/storage.md` for storage patterns.

- Use `allowedMimeTypes` and `fileSizeLimit` on buckets to prevent abuse.

  ```typescript
  // Before (no restrictions — users can upload anything)
  await supabase.storage.createBucket('uploads', { public: false });

  // After
  await supabase.storage.createBucket('uploads', {
    public: false,
    fileSizeLimit: 10485760, // 10MB
    allowedMimeTypes: ['image/*', 'application/pdf'],
  });
  ```
