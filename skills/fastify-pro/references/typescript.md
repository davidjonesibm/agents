# TypeScript Integration

Rules for TypeScript type providers, generic constraints, plugin typing, route typing, and declaration merging.

## Type Providers

- Use a type provider (`@fastify/type-provider-typebox` or `fastify-type-provider-zod`) for automatic type inference from schemas instead of manually defining route generics.

  ```typescript
  // Before (manual generic typing — duplicates schema as type)
  interface CreateUserBody {
    name: string;
    email: string;
  }

  fastify.post<{ Body: CreateUserBody }>(
    '/users',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name', 'email'],
        },
      },
    },
    async (request) => {
      // types come from generic, not schema
      return request.body.name;
    },
  );

  // After (TypeBox type provider — types inferred from schema)
  import { Type } from '@sinclair/typebox';
  import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

  const app = fastify().withTypeProvider<TypeBoxTypeProvider>();

  app.post(
    '/users',
    {
      schema: {
        body: Type.Object({
          name: Type.String(),
          email: Type.String({ format: 'email' }),
        }),
      },
    },
    async (request) => {
      // request.body is automatically typed as { name: string; email: string }
      return request.body.name;
    },
  );
  ```

  **Why:** With type providers, the schema is the single source of truth for both validation and types. No more manual type/schema drift.

- Call `withTypeProvider()` inside each plugin scope, not just at the root level.

  ```typescript
  // Before (type provider lost in plugin scope)
  const server = fastify().withTypeProvider<TypeBoxTypeProvider>();

  server.register(myPlugin); // types NOT inferred inside myPlugin

  // After (re-apply type provider within plugin)
  async function myPlugin(fastify: FastifyInstance) {
    const typed = fastify.withTypeProvider<TypeBoxTypeProvider>();

    typed.get(
      '/items',
      {
        schema: {
          response: { 200: Type.Array(Type.Object({ id: Type.String() })) },
        },
      },
      async (request) => {
        // types correctly inferred
      },
    );
  }
  ```

## Route Generic Typing

- Use the `RouteGenericInterface` properties (`Body`, `Querystring`, `Params`, `Headers`, `Reply`) for route generics.

  ```typescript
  // Before (untyped params)
  fastify.get('/:id', async (request) => {
    const id = (request.params as any).id;
  });

  // After (typed via generics)
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async (request) => {
      const { id } = request.params; // string, fully typed
    },
  );
  ```

- Type the `Reply` generic for status-code-specific response typing.

  ```typescript
  interface MyReply {
    200: { success: true; data: User };
    404: { error: string };
  }

  fastify.get<{ Params: { id: string }; Reply: MyReply }>(
    '/users/:id',
    {
      schema: {
        /* ... */
      },
    },
    async (request, reply) => {
      const user = await findUser(request.params.id);
      if (!user) {
        reply.code(404).send({ error: 'Not found' });
        return;
      }
      reply.code(200).send({ success: true, data: user });
    },
  );
  ```

## Declaration Merging

- Use declaration merging to extend `FastifyRequest`, `FastifyReply`, and `FastifyInstance` for custom decorators.

  ```typescript
  // Before (using type assertions everywhere)
  fastify.addHook('preHandler', async (req) => {
    (req as any).user = await getUser(req);
  });

  // After (declaration merging — types available everywhere)
  import type { User } from '@chat/shared';

  declare module 'fastify' {
    interface FastifyRequest {
      user?: User;
    }
    interface FastifyInstance {
      authenticate: (
        request: FastifyRequest,
        reply: FastifyReply,
      ) => Promise<void>;
      supabaseAdmin: SupabaseClient;
    }
  }
  ```

  **Why:** Declaration merging ensures `request.user` and `fastify.authenticate` are properly typed across the entire codebase without manual casts.

- Place declaration merging in the plugin file that defines the decorator, not in a global `d.ts` file.

  ```typescript
  // Before (global d.ts — types always present even if plugin not registered)
  // global.d.ts
  declare module 'fastify' {
    interface FastifyInstance {
      db: DatabasePool;
    }
  }

  // After (co-located with the plugin)
  // plugins/database.ts
  import fp from 'fastify-plugin';

  export default fp(
    async function (fastify) {
      const pool = new Pool(connectionString);
      fastify.decorate('db', pool);
    },
    { name: 'db-plugin' },
  );

  declare module 'fastify' {
    interface FastifyInstance {
      db: Pool;
    }
  }
  ```

## Plugin Typing

- Use `FastifyPluginAsync<Options>` for typed async plugins.

  ```typescript
  // Before (loosely typed)
  export default async function (fastify: FastifyInstance, opts: any) {
    // opts is any
  }

  // After (fully typed options)
  import { FastifyPluginAsync } from 'fastify';

  interface PushPluginOptions {
    vapidPublicKey: string;
    vapidPrivateKey: string;
    vapidSubject: string;
  }

  const pushPlugin: FastifyPluginAsync<PushPluginOptions> = async (
    fastify,
    opts,
  ) => {
    // opts.vapidPublicKey is typed as string
    fastify.decorate('push', createPushService(opts));
  };

  export default fp(pushPlugin, { name: 'push-plugin' });
  ```

- Prefer `export default async function` with explicit `FastifyInstance` parameter type for route plugins (which don't need `fp`).

  ```typescript
  import { FastifyInstance } from 'fastify';

  export default async function userRoutes(fastify: FastifyInstance) {
    fastify.get('/users', handler);
  }
  ```

## getDecorator / setDecorator

- Use `getDecorator<T>()` and `setDecorator<T>()` for scoped type safety without global module augmentation (Fastify v5+).

  ```typescript
  // Before (requires global declaration merging)
  declare module 'fastify' {
    interface FastifyRequest {
      session: ISession;
    }
  }
  request.session; // typed via global augmentation

  // After (scoped type safety)
  fastify.decorateRequest('session', null);
  fastify.addHook('onRequest', async (req) => {
    req.setDecorator<ISession>('session', await loadSession(req));
  });

  fastify.get('/me', async (request) => {
    const session = request.getDecorator<ISession>('session');
    return session;
  });
  ```

  **Why:** `getDecorator<T>` avoids global type pollution when multiple Fastify instances exist or when plugins are encapsulated. It is complementary to, not a replacement for, declaration merging.

## Schema Typing

- Use `as const` for inline JSON Schema objects to get literal types needed by type providers like `json-schema-to-ts`.

  ```typescript
  // Before (type widens to { type: string })
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    required: ['name'],
  };

  // After (literal type preserved)
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    required: ['name'],
  } as const;
  ```

## Type-Safe Error Handling

- Type custom errors by extending `FastifyError` or by using `@fastify/sensible` which returns properly typed HTTP errors.

  ```typescript
  // Before (generic Error — no statusCode type)
  throw new Error('Not found');

  // After (typed HTTP error with statusCode)
  import createError from '@fastify/error';

  const UserNotFoundError = createError(
    'USER_NOT_FOUND',
    'User %s not found',
    404,
  );
  throw new UserNotFoundError(userId);
  ```

## Avoid `any`

- Never cast `request.body`, `request.params`, or `request.query` as `any`. Use route generics or type providers instead.

  ```typescript
  // Before (any cast — loses all type safety)
  const { name } = request.body as any;

  // After (properly typed via route generic)
  fastify.post<{ Body: { name: string } }>(
    '/users',
    {
      schema: {
        body: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      },
    },
    async (request) => {
      const { name } = request.body; // typed as string
    },
  );
  ```
