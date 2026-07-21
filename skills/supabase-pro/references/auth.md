# Supabase Auth Patterns

Target: Supabase Auth with `@supabase/supabase-js` v2.

---

## Client Setup

- Use the **anon key** for frontend auth. The anon key is safe to expose — RLS enforces access control.

  ```typescript
  // Frontend — anon key (auth only, no direct DB queries)
  import { createClient } from '@supabase/supabase-js';

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  );
  ```

- Use the **service-role key** on the server for admin operations. Always disable session management.

  ```typescript
  // Backend — service role
  const supabaseAdmin = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
  ```

## Sign Up

- Pass user metadata during `signUp()` to store it in `raw_user_meta_data`. Use a trigger to sync this to your public `profiles` table.

  ```typescript
  // Before (sign up without metadata — profile trigger gets null values)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  // After
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username,
        name: displayName,
      },
    },
  });
  ```

  ```sql
  -- Corresponding trigger (syncs metadata to profiles table)
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

  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  ```

## Token Verification

- Verify JWTs on the server using `auth.getUser(token)` — this validates the token against Supabase Auth.

  ```typescript
  // Before (decodes but doesn't verify — accepts expired/forged tokens)
  import jwt from 'jsonwebtoken';
  const payload = jwt.decode(token);

  // After
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    throw reply.unauthorized('Invalid or expired token');
  }
  ```

- Extract the token from the `Authorization: Bearer <token>` header in route handlers.

  ```typescript
  // Authentication preHandler
  export async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw reply.unauthorized('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw reply.unauthorized('Invalid Authorization header format');
    }

    const {
      data: { user },
      error,
    } = await request.server.supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      throw reply.unauthorized('Invalid or expired token');
    }

    request.user = {
      id: user.id,
      email: user.email || '',
      username: (user.user_metadata?.username as string) || '',
      avatar: (user.user_metadata?.avatar as string) || '',
      created_at: user.created_at,
      updated_at: user.updated_at || user.created_at,
    };
  }
  ```

## User Metadata

- Use `raw_user_meta_data` for user-editable fields (username, name, avatar). Use `raw_app_meta_data` for system-controlled fields (roles, permissions).

  ```typescript
  // Before (storing roles in user_metadata — user can edit these!)
  await supabase.auth.updateUser({
    data: { role: 'admin' }, // SECURITY ISSUE: user can modify this
  });

  // After (roles in app_metadata — only settable via service role)
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'admin' },
  });
  ```

  **Why:** Users can update their own `user_metadata` via `supabase.auth.updateUser()`, but `app_metadata` can only be modified via the admin API. See also `references/security.md`.

- Update user metadata through the API, which syncs automatically to `auth.users`.

  ```typescript
  // Update avatar from frontend
  const { data, error } = await supabase.auth.updateUser({
    data: { avatar: newAvatarUrl },
  });

  // Also update the profiles table (if not using a trigger)
  await fetch('/api/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ avatar: newAvatarUrl }),
  });
  ```

## Admin Operations

- Use `supabaseAdmin.auth.admin.*` methods for server-side user management (listing users, deleting users, updating roles).

  ```typescript
  // List users (paginated)
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  // Delete user
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  // Update app_metadata (roles, permissions)
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'moderator' },
  });
  ```

## Session Handling (Frontend)

- Listen for auth state changes to keep the app in sync with the session.

  ```typescript
  // Before (checking session only on mount — misses token refresh)
  onMounted(async () => {
    const { data } = await supabase.auth.getSession();
    user.value = data.session?.user ?? null;
  });

  // After (reactive listener)
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    user.value = session?.user ?? null;

    if (event === 'SIGNED_OUT') {
      router.push('/login');
    }
  });

  // Clean up on unmount
  onUnmounted(() => subscription.unsubscribe());
  ```

- Use `getSession()` for cached session data and `getUser()` for a fresh verification from the server.

  ```typescript
  // Fast (cached, uses local JWT — may be stale)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Verified (round-trip to Supabase — always accurate)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  ```

## JWT Claims in RLS

- Access user metadata in RLS policies via `auth.jwt()`. Use `app_metadata` for authorization, never `user_metadata`.

  ```sql
  -- Before (user_metadata — users can self-edit, INSECURE for authz)
  CREATE POLICY "admin_access" ON admin_settings
  FOR ALL TO authenticated
  USING (auth.jwt()->'user_metadata'->>'role' = 'admin');

  -- After (app_metadata — only settable via service role)
  CREATE POLICY "admin_access" ON admin_settings
  FOR ALL TO authenticated
  USING (auth.jwt()->'app_metadata'->>'role' = 'admin');
  ```

  **Note:** JWTs are not refreshed instantly. After updating `app_metadata`, the change takes effect when the user's JWT is next refreshed (up to the token expiry period).

## WebSocket Auth

- Pass the JWT as a query parameter for WebSocket connections, and validate it in the connection handler.

  ```typescript
  // Client
  const ws = new WebSocket(`${wsUrl}?token=${accessToken}`);

  // Server
  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    const token = (request.query as { token?: string }).token;
    if (!token) {
      socket.close(4001, 'Missing token');
      return;
    }

    const {
      data: { user },
      error,
    } = await fastify.supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      socket.close(4001, 'Invalid token');
      return;
    }
  });
  ```

  See also `references/security.md` for JWT verification patterns.
