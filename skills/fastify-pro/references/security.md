# Security Best Practices

Rules for input validation, CORS, rate limiting, auth patterns, and common security pitfalls.

## Input Validation

- Always attach a `schema` with `body`, `querystring`, `params`, and/or `headers` to every route that accepts input. Fastify uses Ajv for validation — unvalidated input is a vulnerability.

  ```typescript
  // Before (no validation — any input passes through)
  fastify.post('/users', async (request) => {
    const { name, email } = request.body as any;
    return createUser(name, email);
  });

  // After (validated input — rejects malformed requests with 400)
  fastify.post<{ Body: { name: string; email: string } }>(
    '/users',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            email: { type: 'string', format: 'email', maxLength: 255 },
          },
          required: ['name', 'email'],
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      return createUser(request.body.name, request.body.email);
    },
  );
  ```

  **Why:** Without schema validation, attackers can pass arbitrary data including prototype pollution payloads. See also `references/performance.md` for the serialization benefit.

- Set `additionalProperties: false` on body schemas to reject unexpected fields.

  ```typescript
  // Before (allows extra properties — possible mass assignment)
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    },
  }

  // After (rejects extra properties)
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  }
  ```

- Add `maxLength` to all string schema properties to prevent denial-of-service via extremely large payloads.

  ```typescript
  // Before (no length limit — client can send megabytes of string data)
  properties: {
    content: { type: 'string' },
  }

  // After (bounded — prevents memory exhaustion)
  properties: {
    content: { type: 'string', maxLength: 10000 },
  }
  ```

## Response Schema as Security

- Define response schemas to prevent accidental leakage of internal data (database IDs, secrets, internal fields). Only fields in the schema are serialized.

  ```typescript
  // Before (no response schema — leaks all DB columns including internal fields)
  fastify.get('/users/:id', async (request) => {
    return db.query('SELECT * FROM users WHERE id = $1', [request.params.id]);
  });

  // After (response schema strips internal fields)
  fastify.get(
    '/users/:id',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              // password_hash, internal_notes, etc. are NOT included
            },
          },
        },
      },
    },
    async (request) => {
      return db.query('SELECT * FROM users WHERE id = $1', [request.params.id]);
    },
  );
  ```

## Prototype Poisoning

- Keep `onProtoPoisoning: 'error'` and `onConstructorPoisoning: 'error'` (defaults). Never set to `'ignore'`.

  ```typescript
  // DANGEROUS
  const server = Fastify({
    onProtoPoisoning: 'ignore', // allows __proto__ in JSON bodies
  });

  // SAFE (defaults, but explicit is better)
  const server = Fastify({
    onProtoPoisoning: 'error',
    onConstructorPoisoning: 'error',
  });
  ```

  **Why:** `secure-json-parse` protects against prototype pollution attacks that can lead to property injection or RCE. See also `references/performance.md`.

## CORS

- Configure `@fastify/cors` with explicit origins instead of `origin: true` in production.

  ```typescript
  // Before (allows all origins — dangerous in production)
  fastify.register(cors, { origin: true });

  // After (explicit allowlist)
  fastify.register(cors, {
    origin: ['https://app.example.com', 'https://admin.example.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  ```

- Use environment-based CORS configuration for multi-environment deployments.

  ```typescript
  function parseCorsOrigin(): string[] | boolean {
    const env = process.env.CORS_ORIGIN;
    if (!env) return false;
    if (env === '*') return true; // only for development
    return env.split(',').map((o) => o.trim());
  }

  fastify.register(cors, {
    origin: parseCorsOrigin(),
    credentials: true,
  });
  ```

## Authentication Patterns

- Extract auth logic into a reusable plugin decorator, not inline in every route.

  ```typescript
  // Before (auth logic duplicated in every route)
  fastify.get('/users', async (request, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw fastify.httpErrors.unauthorized();
    const user = await verifyToken(token);
    if (!user) throw fastify.httpErrors.unauthorized();
    // ... route logic
  });

  // After (reusable auth decorator via plugin)
  // plugins/auth.ts
  export default fp(
    async function authPlugin(fastify) {
      fastify.decorate(
        'authenticate',
        async (request: FastifyRequest, reply: FastifyReply) => {
          const token = request.headers.authorization?.replace('Bearer ', '');
          if (!token) throw reply.unauthorized('Missing Authorization header');
          const user = await verifyToken(token);
          if (!user) throw reply.unauthorized('Invalid token');
          request.user = user;
        },
      );
    },
    { name: 'auth-plugin', dependencies: ['@fastify/sensible'] },
  );

  // routes/users.ts
  export default async function (fastify: FastifyInstance) {
    fastify.addHook('preHandler', fastify.authenticate);
    fastify.get('/', async (request) => {
      return getUserData(request.user.id);
    });
  }
  ```

- Validate JWT or session tokens in `preValidation` or `preHandler`, never in `onRequest` (where the body hasn't been parsed yet and the request context is incomplete).

## Rate Limiting

- Use `@fastify/rate-limit` to protect endpoints against abuse.

  ```typescript
  // Before (no rate limiting — vulnerable to brute force)
  fastify.post('/auth/login', loginHandler);

  // After (rate limited)
  import rateLimit from '@fastify/rate-limit';

  fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Or per-route for sensitive endpoints
  fastify.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    loginHandler,
  );
  ```

## Security Headers

- Use `@fastify/helmet` to set security-related HTTP headers.

  ```typescript
  import helmet from '@fastify/helmet';

  fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
      },
    },
  });
  ```

## Request Timeout

- Set `requestTimeout` to prevent slow request attacks when not behind a reverse proxy.

  ```typescript
  // Before (no timeout — connections can be held indefinitely)
  const server = Fastify();

  // After
  const server = Fastify({
    requestTimeout: 30_000,
  });
  ```

  See also `references/performance.md` for `handlerTimeout`.

## Trust Proxy

- Enable `trustProxy` only when behind a known proxy. Never set `trustProxy: true` when exposed directly to the internet.

  ```typescript
  // Before (trusts all proxies — X-Forwarded-For can be spoofed)
  const server = Fastify({ trustProxy: true });

  // After (trust only your known proxy)
  const server = Fastify({
    trustProxy: '10.0.0.0/8', // only trust internal network
  });
  ```

## File Uploads

- Use `@fastify/multipart` with explicit file size limits.

  ```typescript
  // Before (no limits)
  fastify.register(multipart);

  // After (explicit limits)
  fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
      files: 1, // single file upload only
    },
  });
  ```
