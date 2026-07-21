# Idiomatic Fastify Patterns

Rules for plugin architecture, decorators, encapsulation, and route organization.

## Plugin Architecture

- Always wrap shared plugins (DB connectors, auth, utilities) with `fastify-plugin` (`fp`) so decorators and hooks are exposed to the parent scope.

  ```typescript
  // Before (decorators trapped in encapsulated scope)
  import { FastifyInstance } from 'fastify';

  export default async function dbPlugin(fastify: FastifyInstance) {
    const pool = createPool(process.env.DATABASE_URL);
    fastify.decorate('db', pool);
  }
  // fastify.db is undefined in sibling plugins

  // After (shared across the application via fastify-plugin)
  import fp from 'fastify-plugin';
  import { FastifyInstance } from 'fastify';

  export default fp(
    async function dbPlugin(fastify: FastifyInstance) {
      const pool = createPool(process.env.DATABASE_URL);
      fastify.decorate('db', pool);
    },
    {
      name: 'db-plugin',
    },
  );
  // fastify.db is now available everywhere
  ```

  **Why:** Without `fp`, Fastify creates an encapsulation context. Decorators, hooks, and schemas defined inside are invisible to sibling or parent plugins.

- Route plugins should NOT use `fastify-plugin` — they should be encapsulated to isolate their hooks and decorators.

  ```typescript
  // Before (leaking route-specific hooks to parent)
  import fp from 'fastify-plugin';

  export default fp(async function userRoutes(fastify) {
    fastify.addHook('preHandler', fastify.authenticate); // leaks to sibling routes
    fastify.get('/users', handler);
  });

  // After (encapsulated — hooks stay within this plugin)
  export default async function userRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', fastify.authenticate);
    fastify.get('/users', handler);
  }
  ```

## Plugin Registration Order

- Register plugins in this order: ecosystem plugins → custom shared plugins → decorators/hooks → route plugins. Dependencies must be registered before dependents.

  ```typescript
  // Before (chaotic ordering, auth may fail if supabase isn't ready)
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(supabasePlugin);
  fastify.register(sensible);

  // After (correct dependency order)
  // 1. Ecosystem plugins
  fastify.register(sensible);
  fastify.register(cors, { origin: true });

  // 2. Custom shared plugins
  fastify.register(supabasePlugin);
  fastify.register(authPlugin);

  // 3. Route plugins
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(userRoutes, { prefix: '/users' });
  ```

- Declare plugin dependencies explicitly in `fastify-plugin` options.

  ```typescript
  // Before (implicit dependency — fails silently if supabase not registered)
  export default fp(async function authPlugin(fastify) {
    fastify.decorate('authenticate', async (request: FastifyRequest) => {
      const user = await fastify.supabaseAdmin.auth.getUser(token);
    });
  });

  // After (explicit dependency declaration)
  export default fp(
    async function authPlugin(fastify) {
      fastify.decorate('authenticate', async (request: FastifyRequest) => {
        const user = await fastify.supabaseAdmin.auth.getUser(token);
      });
    },
    {
      name: 'auth-plugin',
      dependencies: ['supabase-plugin', '@fastify/sensible'],
    },
  );
  ```

  **Why:** Explicit dependencies cause Fastify to throw a clear error if a required plugin isn't registered, instead of a cryptic runtime failure.

## Route Organization

- Group related routes into plugin files under a `routes/` directory. Register each with a prefix.

  ```typescript
  // Before (all routes in one file)
  fastify.get('/api/users', usersHandler);
  fastify.get('/api/users/:id', userByIdHandler);
  fastify.post('/api/groups', createGroupHandler);
  fastify.get('/api/groups', listGroupsHandler);

  // After (route plugins with prefixes)
  // routes/users.ts
  export default async function userRoutes(fastify: FastifyInstance) {
    fastify.get('/', listUsersHandler);
    fastify.get('/:id', getUserHandler);
  }

  // app.ts
  fastify.register(userRoutes, { prefix: '/users' });
  fastify.register(groupRoutes, { prefix: '/groups' });
  ```

- Use `addHook('preHandler', fastify.authenticate)` at the plugin level to protect all routes in a group, not per-route.

  ```typescript
  // Before (repetitive per-route auth)
  fastify.get('/users', { preHandler: [fastify.authenticate] }, handler1);
  fastify.post('/users', { preHandler: [fastify.authenticate] }, handler2);
  fastify.delete(
    '/users/:id',
    { preHandler: [fastify.authenticate] },
    handler3,
  );

  // After (plugin-level auth hook)
  export default async function userRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get('/', handler1);
    fastify.post('/', handler2);
    fastify.delete('/:id', handler3);
  }
  ```

## Encapsulation

- Understand that `register` creates a new encapsulation context. Decorators and hooks defined inside do not leak to siblings or parent.

  ```typescript
  // This is encapsulated — hooks only apply to routes inside
  fastify.register(async (instance) => {
    instance.addHook('onRequest', rateLimitHook); // only applies to /public routes
    instance.get('/public/data', handler);
  });

  // This route is NOT rate-limited
  fastify.get('/internal/health', healthHandler);
  ```

- Use nested `register` calls to create route groups with shared middleware.

  ```typescript
  // Group authenticated routes together
  fastify.register(
    async (authenticated) => {
      authenticated.addHook('preHandler', authenticated.authenticate);

      authenticated.register(userRoutes, { prefix: '/users' });
      authenticated.register(groupRoutes, { prefix: '/groups' });
    },
    { prefix: '/api' },
  );

  // Public routes outside the authenticated context
  fastify.get('/health', async () => ({ status: 'ok' }));
  ```

## Error Handling Patterns

- Use `@fastify/sensible` for consistent HTTP error helpers. See also `references/api.md`.

  ```typescript
  // Before (manual error response)
  if (!user) {
    reply.code(403).send({ error: 'Forbidden' });
    return;
  }

  // After (throw httpErrors — automatically sets status code and format)
  if (!user) {
    throw fastify.httpErrors.forbidden(
      'Not authorized to access this resource',
    );
  }
  ```

- Throw errors from async handlers instead of using `reply.code().send()`. Fastify's error handler will format the response.

  ```typescript
  // Before
  fastify.get('/users/:id', async (request, reply) => {
    const user = await findUser(request.params.id);
    if (!user) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    reply.send(user);
  });

  // After
  fastify.get('/users/:id', async (request, reply) => {
    const user = await findUser(request.params.id);
    if (!user) {
      throw fastify.httpErrors.notFound('User not found');
    }
    return user;
  });
  ```

## Application Structure

- Separate application setup from server startup. Export the `app` function for testing.

  ```typescript
  // Before (app and server intertwined)
  const server = Fastify({ logger: true });
  server.get('/', handler);
  server.listen({ port: 3000 });

  // After (separated concerns)
  // app.ts — exported for testing
  export async function buildApp(fastify: FastifyInstance) {
    fastify.register(sensible);
    fastify.register(routes);
  }

  // main.ts — server startup
  const server = Fastify({ logger: true });
  server.register(buildApp);
  server.listen({ port: 3000 });
  ```

  **Why:** This allows `fastify.inject()` to be used in tests without starting an actual server. See also `references/testing.md`.
