# Testing Patterns

Rules for testing Fastify applications: `inject`, test server setup, mocking, lifecycle, and plugin testing.

## Test Setup — Separate App from Server

- Always separate application setup from server startup. Export a `build` function for testing.

  ```typescript
  // Before (app and server intertwined — untestable without starting server)
  // main.ts
  const server = Fastify({ logger: true });
  server.get('/', handler);
  server.listen({ port: 3000 });

  // After (separated — testable)
  // app.ts
  import { FastifyInstance } from 'fastify';
  export async function buildApp(fastify: FastifyInstance) {
    fastify.register(sensible);
    fastify.register(routes);
  }

  // main.ts
  const server = Fastify({ logger: true });
  server.register(buildApp);
  server.listen({ port: 3000 });

  // test
  const app = Fastify();
  app.register(buildApp);
  await app.ready();
  ```

  See also `references/patterns.md` for the application structure pattern.

## Use `fastify.inject()` for HTTP Testing

- Use `fastify.inject()` instead of starting a real server for tests. It uses `light-my-request` for in-process HTTP simulation.

  ```typescript
  // Before (starts a real server — slow, port conflicts)
  const server = Fastify();
  server.register(buildApp);
  await server.listen({ port: 0 });
  const response = await fetch(
    `http://localhost:${server.server.address().port}/users`,
  );
  await server.close();

  // After (inject — fast, no port needed)
  const app = Fastify();
  app.register(buildApp);

  const response = await app.inject({
    method: 'GET',
    url: '/users',
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual([]);
  ```

  **Why:** `inject()` boots all plugins and runs the full lifecycle without opening a TCP socket. It is faster and avoids port conflicts in parallel tests.

## inject() API

- Use `response.json()` to parse JSON responses instead of `JSON.parse(response.body)`.

  ```typescript
  // Before
  const response = await app.inject({ method: 'GET', url: '/users' });
  const data = JSON.parse(response.body);

  // After
  const response = await app.inject({ method: 'GET', url: '/users' });
  const data = response.json();
  ```

- Pass headers, body, and query params to `inject()` for realistic request simulation.

  ```typescript
  const response = await app.inject({
    method: 'POST',
    url: '/api/groups',
    headers: {
      authorization: `Bearer ${testToken}`,
      'content-type': 'application/json',
    },
    payload: {
      name: 'Test Group',
      description: 'A test group',
    },
  });

  expect(response.statusCode).toBe(201);
  expect(response.json().group.name).toBe('Test Group');
  ```

## Always Close the Server After Tests

- Always call `app.close()` after tests to release resources (DB connections, timers). Use `afterEach`, `afterAll`, or `using` keyword.

  ```typescript
  // Before (resource leak — DB connections stay open)
  test('creates a user', async () => {
    const app = Fastify();
    app.register(buildApp);
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Test' },
    });
    expect(response.statusCode).toBe(201);
    // app never closed!
  });

  // After (explicit cleanup)
  test('creates a user', async () => {
    const app = Fastify();
    app.register(buildApp);

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: { name: 'Test' },
      });
      expect(response.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });

  // Or with TypeScript 5.2+ using keyword
  test('creates a user', async () => {
    await using app = Fastify();
    app.register(buildApp);

    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Test' },
    });
    expect(response.statusCode).toBe(201);
  });
  ```

## Testing Plugins

- Test plugins in isolation by creating a minimal Fastify instance and registering only the plugin under test.

  ```typescript
  // Before (testing plugin as part of full app — slow, flaky)
  const app = buildFullApp();
  // test something about the auth plugin

  // After (isolated plugin test)
  import authPlugin from '../plugins/auth';

  test('authenticate decorator rejects missing token', async () => {
    const app = Fastify();
    app.register(sensible);
    app.register(supabasePlugin);
    app.register(authPlugin);

    app.get(
      '/test',
      {
        preHandler: [app.authenticate],
      },
      async (request) => {
        return { user: request.user };
      },
    );

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      // no authorization header
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
  ```

## Testing Route Validation

- Test that schema validation rejects invalid input with 400 status codes.

  ```typescript
  test('rejects invalid body', async () => {
    const app = Fastify();
    app.register(buildApp);

    const response = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { authorization: `Bearer ${validToken}` },
      payload: {
        // missing required 'name' field
        description: 'A group without a name',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('name');
    await app.close();
  });
  ```

## Testing Error Handlers

- Test custom error handlers by triggering the error condition and asserting on the response.

  ```typescript
  test('custom error handler formats errors', async () => {
    const app = Fastify();
    app.setErrorHandler((error, request, reply) => {
      reply.status(error.statusCode ?? 500).send({
        error: error.message,
        code: error.code,
      });
    });

    app.get('/fail', async () => {
      throw app.httpErrors.badRequest('Invalid input');
    });

    const response = await app.inject({ method: 'GET', url: '/fail' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Invalid input',
      code: 'ERR_BAD_REQUEST',
    });
    await app.close();
  });
  ```

## Testing Hooks

- Test hooks by observing their side effects (request decoration, response modification, or early responses).

  ```typescript
  test('onRequest hook adds timing', async () => {
    const app = Fastify();

    app.addHook('onRequest', async (request) => {
      request.startTime = Date.now();
    });

    app.get('/test', async (request) => {
      return { hasStartTime: typeof request.startTime === 'number' };
    });

    const response = await app.inject({ method: 'GET', url: '/test' });
    expect(response.json().hasStartTime).toBe(true);
    await app.close();
  });
  ```

## Mocking External Services

- Mock external services by decorating the Fastify instance with mock implementations.

  ```typescript
  // Before (real DB in unit tests)
  const app = Fastify();
  app.register(realDatabasePlugin); // connects to real DB

  // After (mock decorator)
  const app = Fastify();
  app.decorate('db', {
    query: async (sql: string, params: unknown[]) => {
      return { rows: [{ id: '1', name: 'Test User' }] };
    },
  });
  app.register(userRoutes, { prefix: '/users' });

  const response = await app.inject({ method: 'GET', url: '/users' });
  expect(response.json()).toHaveLength(1);
  await app.close();
  ```

## Testing with `ready()` vs `inject()`

- `inject()` automatically calls `ready()` — no need to call both.

  ```typescript
  // Before (redundant ready call)
  const app = Fastify();
  app.register(buildApp);
  await app.ready(); // unnecessary before inject
  const response = await app.inject({ method: 'GET', url: '/' });

  // After (inject handles readiness)
  const app = Fastify();
  app.register(buildApp);
  const response = await app.inject({ method: 'GET', url: '/' });
  ```

  **Why:** `inject()` ensures all registered plugins have booted before processing the request.

## Parallel Test Safety

- Create a fresh Fastify instance per test to avoid state leaking between tests. Do not share instances.

  ```typescript
  // Before (shared instance — state leaks between tests)
  const app = Fastify();
  app.register(buildApp);

  test('test 1', async () => {
    /* modifies app state */
  });
  test('test 2', async () => {
    /* sees state from test 1 */
  });

  // After (fresh instance per test)
  function createTestApp() {
    const app = Fastify();
    app.register(buildApp);
    return app;
  }

  test('test 1', async () => {
    const app = createTestApp();
    // ...
    await app.close();
  });

  test('test 2', async () => {
    const app = createTestApp();
    // ...
    await app.close();
  });
  ```
