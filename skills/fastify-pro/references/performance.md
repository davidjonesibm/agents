# Performance Best Practices

Rules for optimizing Fastify application performance: serialization, schema compilation, logging, and connection handling.

## Response Schema Serialization

- Always define `response` schemas on routes. Fastify uses `fast-json-stringify` to serialize responses 2-3x faster than `JSON.stringify` — but only when a response schema is provided.

  ```typescript
  // Before (no response schema — falls back to slow JSON.stringify)
  fastify.get('/users', async () => {
    return db.getUsers();
  });

  // After (fast-json-stringify kicks in — 2-3x faster serialization)
  fastify.get(
    '/users',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async () => {
      return db.getUsers();
    },
  );
  ```

  **Why:** This is the single biggest performance win in Fastify. It also prevents accidental data leaks — only fields in the schema are serialized. See also `references/security.md`.

- Use `$ref` shared schemas to avoid recompiling the same schema on multiple routes.

  ```typescript
  // Before (schema compiled separately for each route)
  fastify.get(
    '/users',
    { schema: { response: { 200: userObjectSchema } } },
    handler1,
  );
  fastify.get(
    '/users/:id',
    { schema: { response: { 200: userObjectSchema } } },
    handler2,
  );

  // After (compiled once via $ref)
  fastify.addSchema({
    $id: 'user',
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
    },
  });

  fastify.get(
    '/users',
    {
      schema: {
        response: { 200: { type: 'array', items: { $ref: 'user#' } } },
      },
    },
    handler1,
  );
  fastify.get(
    '/users/:id',
    { schema: { response: { 200: { $ref: 'user#' } } } },
    handler2,
  );
  ```

## Validation Schema Performance

- Use `as const` with inline schema objects to enable TypeScript literal type inference and help the JSON schema compiler cache effectively.

  ```typescript
  // Before (schema type widens to Record<string, unknown>)
  const bodySchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    required: ['name'],
  };

  // After (literal types preserved for type providers)
  const bodySchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    required: ['name'],
  } as const;
  ```

## Logging Performance

- Use `disableRequestLogging` for high-throughput routes where default request/response logging adds overhead.

  ```typescript
  // Before (every request logged twice — incoming + outgoing)
  const server = Fastify({ logger: true });

  // After (disable auto-logging, add custom selective logging)
  const server = Fastify({
    logger: true,
    disableRequestLogging: (request) => {
      return request.url === '/health' || request.url === '/ready';
    },
  });
  ```

- Use Pino serializers instead of spreading objects into log calls. Unnecessary object spreading creates garbage.

  ```typescript
  // Before (creates intermediate objects on every log call)
  request.log.info(
    { ...request.headers, url: request.url },
    'incoming request',
  );

  // After (pass the original object — Pino serializes it)
  request.log.info({ req: request }, 'incoming request');
  ```

- Set appropriate log levels in production. Use `info` or `warn` — never `trace` or `debug` in production.

  ```typescript
  // Before
  const server = Fastify({ logger: { level: 'trace' } }); // extremely verbose in production

  // After
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });
  ```

## Connection Management

- Set `requestTimeout` in production to protect against slowloris attacks.

  ```typescript
  // Before (no timeout — vulnerable to slow clients holding connections)
  const server = Fastify();

  // After (requests must complete within 120 seconds)
  const server = Fastify({
    requestTimeout: 120_000,
  });
  ```

- Use `handlerTimeout` for per-route application-level timeouts, with `request.signal` for cooperative cancellation.

  ```typescript
  // Before (no timeout — slow handlers block indefinitely)
  fastify.get('/report', async (request) => {
    return await generateSlowReport();
  });

  // After (cooperative timeout with signal propagation)
  fastify.get(
    '/report',
    {
      handlerTimeout: 30_000, // 30s timeout
    },
    async (request) => {
      return await generateSlowReport({ signal: request.signal });
    },
  );
  ```

  **Why:** `handlerTimeout` sends a 503 when exceeded and aborts `request.signal`. APIs that accept `signal` (fetch, DB drivers) will cancel automatically.

- Use `forceCloseConnections: 'idle'` (default) for graceful shutdown. Use `true` only if you need fast shutdown.

  ```typescript
  const server = Fastify({
    forceCloseConnections: 'idle', // close idle connections on shutdown, let active requests finish
  });
  ```

## Body Limit

- Set appropriate `bodyLimit` per-route for file upload endpoints instead of increasing the global limit.

  ```typescript
  // Before (global 50MB limit — affects all routes)
  const server = Fastify({ bodyLimit: 50 * 1024 * 1024 });

  // After (route-specific limit)
  const server = Fastify({ bodyLimit: 1024 * 1024 }); // 1MB default

  fastify.post(
    '/upload',
    {
      bodyLimit: 50 * 1024 * 1024, // 50MB for this route only
    },
    uploadHandler,
  );
  ```

## Avoid Unnecessary Work

- Use `return` in async handlers instead of `reply.send()` — it avoids an extra function call.

  ```typescript
  // Before
  fastify.get('/data', async (request, reply) => {
    const data = await fetchData();
    reply.send(data);
  });

  // After
  fastify.get('/data', async () => {
    return await fetchData();
  });
  ```

- Avoid deep cloning request data unnecessarily. Use `structuredClone` or spread only when mutation is required.

  ```typescript
  // Before (unnecessary clone)
  const body = JSON.parse(JSON.stringify(request.body));

  // After (use directly if not mutating)
  const { name, email } = request.body;
  ```

## Plugin Loading

- Set `pluginTimeout` appropriately for plugins that connect to external services during startup.

  ```typescript
  // Before (default 10s timeout — may fail for slow DB connections)
  const server = Fastify();

  // After (30s for slow startup connections)
  const server = Fastify({
    pluginTimeout: 30_000,
  });
  ```

## JSON Parsing Security vs Performance

- Keep `onProtoPoisoning: 'error'` and `onConstructorPoisoning: 'error'` (the defaults) in production. Do NOT switch to `'ignore'` for performance.

  ```typescript
  // DANGEROUS — disables prototype poisoning protection
  const server = Fastify({ onProtoPoisoning: 'ignore' });

  // SAFE — keep defaults (or explicitly set to 'error')
  const server = Fastify({
    onProtoPoisoning: 'error',
    onConstructorPoisoning: 'error',
  });
  ```

  **Why:** Prototype poisoning attacks can lead to RCE. The security cost of `'error'` is negligible compared to the risk. See also `references/security.md`.
