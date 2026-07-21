# Modern Fastify API Usage

Rules for using modern Fastify v5 APIs and avoiding deprecated patterns.

## Plugin Registration

- Use `FastifyPluginAsync` instead of `FastifyPluginCallback` for plugin definitions. The callback-style `done` parameter is unnecessary with async functions and can cause double-invocation bugs.

  ```typescript
  // Before (callback-style — deprecated pattern)
  import { FastifyInstance } from 'fastify';

  export default function myPlugin(
    fastify: FastifyInstance,
    opts: Record<string, unknown>,
    done: () => void,
  ) {
    fastify.get('/hello', async () => ({ hello: 'world' }));
    done();
  }

  // After (async plugin — modern pattern)
  import { FastifyInstance } from 'fastify';

  export default async function myPlugin(
    fastify: FastifyInstance,
    opts: Record<string, unknown>,
  ) {
    fastify.get('/hello', async () => ({ hello: 'world' }));
  }
  ```

  **Why:** Mixing `done()` with async functions can cause `FST_ERR_PROMISE_NOT_FULFILLED` or duplicate handler execution.

- Use `FastifyPluginAsync<OptionsType>` for typed plugin signatures instead of bare `FastifyInstance` parameter types.

  ```typescript
  // Before
  import { FastifyInstance } from 'fastify';

  export default async function (fastify: FastifyInstance) {
    // no option types
  }

  // After
  import { FastifyPluginAsync } from 'fastify';

  interface MyPluginOptions {
    prefix: string;
  }

  const myPlugin: FastifyPluginAsync<MyPluginOptions> = async (
    fastify,
    opts,
  ) => {
    fastify.log.info(`Registered with prefix: ${opts.prefix}`);
  };

  export default myPlugin;
  ```

## Decorator APIs

- Use `getDecorator<T>()` and `setDecorator<T>()` instead of direct property access with type assertions for better type safety (Fastify v5+).

  ```typescript
  // Before (type assertions needed)
  fastify.addHook('preHandler', async (req) => {
    (req as typeof req & { user: string }).user = 'Bob';
  });

  // After (type-safe decorators)
  fastify.decorateRequest('user', '');
  fastify.addHook('preHandler', async (req) => {
    req.setDecorator<string>('user', 'Bob');
  });

  fastify.get('/me', async (request) => {
    const user = request.getDecorator<string>('user');
    return { user };
  });
  ```

  **Why:** `getDecorator<T>` and `setDecorator<T>` eliminate the need for explicit type assertions and provide scoped type safety.

- Use `fastify.decorateRequest('prop', null)` with a sentinel value for reference-type decorators, not the actual default object. Objects passed to `decorateRequest` are shared across all requests.

  ```typescript
  // Before (DANGEROUS — shared mutable state across requests)
  fastify.decorateRequest('data', { items: [] });

  // After (safe — set per-request in a hook)
  fastify.decorateRequest('data', null);
  fastify.addHook('onRequest', async (request) => {
    request.data = { items: [] };
  });
  ```

  **Why:** The default value for `decorateRequest` is shared by reference across all requests, causing data leaks between concurrent requests.

## Error Handling

- Use `@fastify/sensible` httpErrors instead of manually constructing error responses. See also `references/patterns.md`.

  ```typescript
  // Before
  reply
    .code(404)
    .send({ statusCode: 404, error: 'Not Found', message: 'User not found' });

  // After
  throw fastify.httpErrors.notFound('User not found');
  ```

- Use `setErrorHandler` per encapsulation context instead of a single global error handler. Error handlers are scoped to their plugin context.

  ```typescript
  // Before (overriding in same scope — last one wins silently)
  fastify.setErrorHandler(handlerA);
  fastify.setErrorHandler(handlerB); // handlerA is lost

  // After (scoped error handlers)
  fastify.register(async (instance) => {
    instance.setErrorHandler((error, request, reply) => {
      request.log.error(error);
      reply.status(error.statusCode ?? 500).send({ error: error.message });
    });
    instance.register(apiRoutes);
  });
  ```

## Route Definitions

- Use `return` from async handlers instead of `reply.send()`. When using async handlers, the return value is automatically sent as the response.

  ```typescript
  // Before (unnecessary reply.send in async handler)
  fastify.get('/users', async (request, reply) => {
    const users = await getUsers();
    reply.send(users);
  });

  // After (return value is automatically sent)
  fastify.get('/users', async (request, reply) => {
    const users = await getUsers();
    return users;
  });
  ```

  **Why:** Calling `reply.send()` in an async handler and also returning a value will cause `FST_ERR_REP_ALREADY_SENT`.

- Always use the options object (second argument) for schema, not inline in the handler.

  ```typescript
  // Before (schema separate from route)
  const schema = {
    body: { type: 'object', properties: { name: { type: 'string' } } },
  };
  fastify.post('/users', { schema }, handler);

  // After (schema inline in route options — same effect, but keep it close to the route)
  fastify.post<{ Body: CreateUserRequest }>(
    '/users',
    {
      schema: {
        body: {
          type: 'object',
          properties: { name: { type: 'string', minLength: 1 } },
          required: ['name'],
        },
      },
    },
    async (request) => {
      return createUser(request.body);
    },
  );
  ```

## Logging

- Use `request.log` or `fastify.log` instead of `console.log` / `console.error`. Fastify uses Pino for structured, context-aware logging.

  ```typescript
  // Before
  console.log('Request received:', request.url);
  console.error('Database error:', error);

  // After
  request.log.info({ url: request.url }, 'Request received');
  request.log.error({ err: error }, 'Database error');
  ```

  **Why:** Pino structured logs include request ID, timestamp, and are JSON-serializable for production log aggregation.

## Server Instantiation

- Use `Fastify()` factory with explicit options instead of relying on defaults for production servers.

  ```typescript
  // Before (missing production options)
  const server = Fastify();

  // After (explicit production configuration)
  const server = Fastify({
    logger: true,
    trustProxy: true,
    requestTimeout: 30000,
  });
  ```

- Use `Symbol.asyncDispose` with `await using` in tests for automatic cleanup (TypeScript 5.2+).

  ```typescript
  // Before (manual cleanup)
  const app = Fastify();
  try {
    // test logic
  } finally {
    await app.close();
  }

  // After (automatic cleanup with using)
  await using app = Fastify();
  // test logic — app.close() called automatically
  ```

## Schema References

- Use `addSchema` with `$id` for reusable schemas and reference them with `$ref` instead of duplicating schema definitions.

  ```typescript
  // Before (duplicated schema)
  fastify.get(
    '/users',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: { id: { type: 'string' }, name: { type: 'string' } },
          },
        },
      },
    },
    handler,
  );

  // After (shared schema reference)
  fastify.addSchema({
    $id: 'user',
    type: 'object',
    properties: { id: { type: 'string' }, name: { type: 'string' } },
  });

  fastify.get(
    '/users',
    {
      schema: {
        response: { 200: { type: 'array', items: { $ref: 'user#' } } },
      },
    },
    handler,
  );
  ```

  **Why:** Shared schemas are compiled once and reused, improving both DX and serialization performance.
