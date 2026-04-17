# Lifecycle Hooks

Rules for correct usage of Fastify lifecycle hooks, request/reply decorators, and encapsulation context.

## Hook Execution Order

The request lifecycle hooks execute in this order:

1. `onRequest` — request received, body NOT parsed yet
2. `preParsing` — can transform the raw request stream
3. `preValidation` — body parsed, not yet validated
4. `preHandler` — body validated, before route handler
5. `preSerialization` — handler done, before serialization (NOT called for string/Buffer/stream/null)
6. `onSend` — serialized payload, can transform the final output
7. `onResponse` — response sent, for logging/metrics only
8. `onError` — called when an error occurs (before error handler)
9. `onTimeout` — socket-level timeout (connectionTimeout)
10. `onRequestAbort` — client closed connection early

## Async Hooks

- Always use async hooks. Never mix `done` callbacks with `async`/`await` — it causes double execution.

  ```typescript
  // Before (dangerous callback/async mix)
  fastify.addHook('onRequest', async (request, reply, done) => {
    await someAsyncWork();
    done(); // BUG: double execution
  });

  // After (pure async — no done parameter)
  fastify.addHook('onRequest', async (request, reply) => {
    await someAsyncWork();
  });
  ```

  **Why:** When a function is async, Fastify automatically handles completion via the returned Promise. Calling `done()` as well triggers the next hook twice.

## onRequest

- Use `onRequest` for request-level setup (logging, tracing, early rejection). `request.body` is always `undefined` here.

  ```typescript
  // Before (accessing body in onRequest — always undefined)
  fastify.addHook('onRequest', async (request) => {
    if (request.body?.admin) {
      /* never true */
    }
  });

  // After (use onRequest for non-body checks)
  fastify.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
  });
  ```

## preHandler vs preValidation

- Use `preValidation` for auth checks that don't need a parsed/validated body. Use `preHandler` for checks that need validated request data.

  ```typescript
  // Before (auth in preHandler — unnecessary, body is already parsed and validated)
  fastify.addHook('preHandler', async (request, reply) => {
    if (!request.headers.authorization) {
      throw fastify.httpErrors.unauthorized();
    }
  });

  // After (auth in preValidation — runs earlier, fails faster)
  fastify.addHook('preValidation', async (request, reply) => {
    if (!request.headers.authorization) {
      throw fastify.httpErrors.unauthorized();
    }
  });
  ```

  **Why:** `preValidation` runs before the body is validated against the schema, so rejecting unauthorized requests here avoids unnecessary validation work.

- Use `preHandler` for authorization checks that need the validated body or params.

  ```typescript
  fastify.addHook('preHandler', async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    const isMember = await checkMembership(request.user.id, groupId);
    if (!isMember) {
      throw fastify.httpErrors.forbidden('Not a member of this group');
    }
  });
  ```

## Route-Level Hooks

- Prefer route-level hooks over plugin-level hooks when the hook only applies to a single route.

  ```typescript
  // Before (plugin-level hook affecting all routes in scope)
  fastify.addHook('preHandler', ownershipCheck);
  fastify.delete('/:id', deleteHandler);
  fastify.get('/', listHandler); // ownershipCheck runs unnecessarily

  // After (route-level hook — only runs for DELETE)
  fastify.delete(
    '/:id',
    {
      preHandler: [ownershipCheck],
    },
    deleteHandler,
  );

  fastify.get('/', listHandler);
  ```

- Route-level hooks always execute AFTER plugin-level hooks of the same type.

  ```typescript
  // Plugin-level onRequest runs first
  fastify.addHook('onRequest', async (request) => {
    request.log.info('plugin-level hook — runs first');
  });

  fastify.get(
    '/example',
    {
      onRequest: async (request) => {
        request.log.info('route-level hook — runs second');
      },
    },
    handler,
  );
  ```

## Responding from Hooks

- When responding early from an async hook (e.g., cache hit), call `reply.send()` and `return reply` to stop the lifecycle.

  ```typescript
  // Before (missing return — handler still executes)
  fastify.addHook('preHandler', async (request, reply) => {
    const cached = cache.get(request.url);
    if (cached) {
      reply.send(cached);
      // BUG: handler runs anyway, causes FST_ERR_REP_ALREADY_SENT
    }
  });

  // After (return reply to halt the lifecycle)
  fastify.addHook('preHandler', async (request, reply) => {
    const cached = cache.get(request.url);
    if (cached) {
      reply.send(cached);
      return reply; // stops the lifecycle
    }
  });
  ```

## onSend

- Use `onSend` to transform the serialized payload (string/Buffer/stream). It is NOT called if the payload is `null`.

  ```typescript
  fastify.addHook('onSend', async (request, reply, payload) => {
    // Add custom header based on response
    if (typeof payload === 'string' && payload.includes('"error"')) {
      reply.header('x-has-error', 'true');
    }
    return payload; // must return the (possibly modified) payload
  });
  ```

## onResponse

- Use `onResponse` for metrics and cleanup. The response has already been sent — you cannot modify it.

  ```typescript
  // Before (trying to send data in onResponse — too late)
  fastify.addHook('onResponse', async (request, reply) => {
    reply.send({ extra: 'data' }); // throws error
  });

  // After (use for metrics/logging only)
  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - request.startTime;
    request.log.info(
      { duration, statusCode: reply.statusCode },
      'request completed',
    );
  });
  ```

## onError

- Use `onError` for custom error logging. Do NOT call `reply.send()` inside `onError` — it will throw.

  ```typescript
  // Before (trying to modify response in onError)
  fastify.addHook('onError', async (request, reply, error) => {
    reply.send({ custom: 'error' }); // throws FST_ERR_REP_ALREADY_SENT
  });

  // After (onError is for logging only — use setErrorHandler to change the response)
  fastify.addHook('onError', async (request, reply, error) => {
    request.log.error({ err: error, requestId: request.id }, 'Request error');
    await reportToExternalService(error);
  });
  ```

  **Why:** `onError` runs before the error handler but after the error has been caught. Use `setErrorHandler` if you need to change the response.

## Application Hooks

- Use `onClose` for resource cleanup (DB pools, connections). Child plugin `onClose` hooks run before parent hooks.

  ```typescript
  export default fp(
    async function dbPlugin(fastify) {
      const pool = new Pool(connectionString);
      fastify.decorate('db', pool);

      fastify.addHook('onClose', async () => {
        await pool.end();
        fastify.log.info('Database pool closed');
      });
    },
    { name: 'db-plugin' },
  );
  ```

- Use `preClose` for closing WebSocket connections or SSE streams that would prevent `server.close()` from completing.

  ```typescript
  fastify.addHook('preClose', async () => {
    for (const ws of activeConnections) {
      ws.close(1001, 'Server shutting down');
    }
  });
  ```

  **Why:** `preClose` runs while the server is still draining. At `onClose` time, all HTTP requests are complete but upgraded connections (WebSocket) may still be open.

## Hook Scoping

- Hooks registered inside `register` are encapsulated to that context (and children), unless the plugin uses `fastify-plugin`.

  ```typescript
  fastify.register(async (instance) => {
    // This hook ONLY applies to routes within this register call
    instance.addHook('preHandler', rateLimitHook);
    instance.get('/limited', limitedHandler); // rate-limited
  });

  fastify.get('/unlimited', unlimitedHandler); // NOT rate-limited
  ```

- Hooks registered with `fastify-plugin` propagate to the parent scope.

  ```typescript
  import fp from 'fastify-plugin';

  // This hook applies to ALL routes in the parent scope
  export default fp(async function (fastify) {
    fastify.addHook('onRequest', async (request) => {
      request.log.info('global hook from fp-wrapped plugin');
    });
  });
  ```
