# Supabase TypeScript Patterns

---

## database.types.ts

- **Every table must** have `Row`, `Insert`, `Update`, and `Relationships` entries in `database.types.ts`. Never cast `supabaseAdmin as any` to bypass a missing table.

  ```typescript
  // Before (missing table type — cast as workaround)
  const { data } = await (supabaseAdmin as any).from('reactions').select('*')

  // After — add to database.types.ts
  message_reactions: {
    Row: {
      id: string
      message_id: string
      user_id: string
      emoji: string
      created_at: string
      updated_at: string
    }
    Insert: {
      id?: string
      message_id: string
      user_id: string
      emoji: string
      created_at?: string
      updated_at?: string
    }
    Update: {
      id?: string
      message_id?: string
      user_id?: string
      emoji?: string
      created_at?: string
      updated_at?: string
    }
    Relationships: [
      {
        foreignKeyName: 'message_reactions_message_id_fkey'
        columns: ['message_id']
        isOneToOne: false
        referencedRelation: 'messages'
        referencedColumns: ['id']
      },
    ]
  }
  ```

- **Row type**: All columns non-optional (what you get from SELECT).
  **Insert type**: Columns with DB defaults (`id`, `created_at`, `updated_at`) are optional.
  **Update type**: All columns optional (partial updates).

  ```typescript
  // Row — all required
  Row: {
    id: string           // has DEFAULT gen_random_uuid(), but always returned
    name: string
    created_at: string   // has DEFAULT now(), but always returned
  }

  // Insert — columns with DB defaults are optional
  Insert: {
    id?: string          // optional (DB generates if omitted)
    name: string         // required (no default)
    created_at?: string  // optional (DB generates if omitted)
  }

  // Update — all optional (partial update)
  Update: {
    id?: string
    name?: string
    created_at?: string
  }
  ```

- Use `seq?: never` for auto-increment / generated columns that should never be set by client code.

  ```typescript
  // Before (allows client to set seq, which will fail)
  Insert: {
    seq?: number
  }

  // After (TypeScript error if client tries to set seq)
  Insert: {
    seq?: never
  }
  Update: {
    seq?: never
  }
  ```

- Mark `search_vector` and other generated columns as `unknown` in Row type (not directly queryable as string).

  ```typescript
  Row: {
    content: string;
    search_vector: unknown; // tsvector — use textSearch(), not direct access
  }
  ```

## Typed Client

- Always pass the `Database` type generic when creating the Supabase client.

  ```typescript
  // Before (untyped — .from() accepts any string, no column inference)
  const supabase = createClient(url, key)

  // After (fully typed)
  import type { Database } from '../../../database.types'
  const supabase = createClient<Database>(url, key, { ... })
  ```

- Use `SupabaseClient<Database>` for type declarations and module augmentation.

  ```typescript
  // Before (generic SupabaseClient, no type inference)
  declare module 'fastify' {
    interface FastifyInstance {
      supabaseAdmin: SupabaseClient;
    }
  }

  // After
  import type { SupabaseClient } from '@supabase/supabase-js';
  import type { Database } from '../../../database.types';

  declare module 'fastify' {
    interface FastifyInstance {
      supabaseAdmin: SupabaseClient<Database>;
    }
  }
  ```

## Type Helpers

- Extract table row types from the Database type for use in function signatures.

  ```typescript
  // Before (manually redefining types)
  type Channel = {
    id: string;
    name: string;
    group_id: string;
    // ...
  };

  // After (derived from Database type)
  type Tables = Database['public']['Tables'];
  type ChannelRow = Tables['channels']['Row'];
  type ChannelInsert = Tables['channels']['Insert'];
  type MessageRow = Tables['messages']['Row'];
  ```

- Use `.overrideTypes<T>()` for views or complex queries where inference fails.

  ```typescript
  // Before (data is typed as any[] or unknown)
  const { data } = await supabase.from('message_stats').select('*');

  // After
  type MessageStats = { channel_id: string; count: number; last_at: string };
  const { data } = await supabase
    .from('message_stats')
    .select('*')
    .overrideTypes<MessageStats[]>();
  ```

- Define RPC return types in the `Functions` section of `database.types.ts`.

  ```typescript
  // Before (Functions section empty, rpc() returns unknown)
  Functions: {
    [_ in never]: never
  }

  // After
  Functions: {
    get_message_count: {
      Args: { p_channel_id: string }
      Returns: number
    }
    search_messages: {
      Args: { query_text: string; channel_ids: string[] }
      Returns: {
        id: string
        content: string
        sender_id: string
        created_at: string
      }[]
    }
  }
  ```

## Error Handling

- Always destructure `error` alongside `data`. The `error` object has `message`, `code`, `details`, and `hint` fields.

  ```typescript
  // Before (error swallowed)
  const { data } = await supabase.from('channels').select('*');

  // After
  const { data, error } = await supabase.from('channels').select('*');
  if (error) {
    fastify.log.error(error);
    throw fastify.httpErrors.internalServerError(`DB error: ${error.message}`);
  }
  ```

- Type-narrow the error for specific PostgREST error codes.

  ```typescript
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Row not found — use .maybeSingle() instead if this is expected
      throw fastify.httpErrors.notFound('Profile not found');
    }
    throw fastify.httpErrors.internalServerError(error.message);
  }
  ```

## Shared Types

- Use `@chat/shared` types for API shapes. The `*Record` type is the full DB row; API shapes are `Pick<>` subsets.

  ```typescript
  // Before (redefining types locally)
  type Channel = {
    id: string;
    name: string;
    group: string;
  };

  // After (import from shared)
  import type { Channel, CreateChannelRequest } from '@chat/shared';
  ```

  See `references/patterns.md` for mapping DB rows to API shapes.
