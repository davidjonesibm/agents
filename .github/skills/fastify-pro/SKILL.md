---
name: fastify-pro
description: >-
  Comprehensively reviews Fastify code for best practices on modern APIs, plugin architecture,
  TypeScript integration, and performance. Use when reading, writing, or reviewing Fastify backend projects.
---

Review Fastify and TypeScript backend code for correctness, modern API usage, and adherence to best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check for deprecated APIs and modern replacements using `references/api.md`.
2. Validate plugin architecture, encapsulation, and route organization using `references/patterns.md`.
3. Ensure lifecycle hooks are used correctly using `references/hooks.md`.
4. Check performance best practices using `references/performance.md`.
5. Validate security practices using `references/security.md`.
6. Ensure TypeScript integration is correct using `references/typescript.md`.
7. Validate testing patterns using `references/testing.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target Fastify v5 (latest) or later.
- All code examples use TypeScript with async/await.
- Prefer `fastify-plugin` (`fp`) for plugins that should share encapsulation context.
- Always validate input with JSON Schema attached to route `schema` options.
- Never use the callback-style `done` pattern when `async`/`await` is available.
- Do not introduce third-party plugins without confirming they support Fastify v5.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated (e.g., "Use async plugin functions instead of callback-style `done`").
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

Example output:

### routes/users.ts

**Line 15: Always provide a response schema for serialization performance.**

```typescript
// Before
fastify.get('/users', async (request, reply) => {
  return db.getUsers();
});

// After
fastify.get(
  '/users',
  {
    schema: {
      response: {
        200: {
          type: 'array',
          items: { $ref: 'user#' },
        },
      },
    },
  },
  async (request, reply) => {
    return db.getUsers();
  },
);
```

**Line 32: Use `@fastify/sensible` httpErrors instead of manual error construction.**

```typescript
// Before
reply.code(404).send({ error: 'User not found' });

// After
throw fastify.httpErrors.notFound('User not found');
```

**Line 48: Prefer `fastify.log` over `console.log` for structured logging.**

```typescript
// Before
console.log('User created:', user.id);

// After
fastify.log.info({ userId: user.id }, 'User created');
```

### Summary

1. **Performance (high):** Missing response schema on line 15 bypasses fast-json-stringify.
2. **Consistency (medium):** Use `@fastify/sensible` error helpers on line 32.
3. **Observability (low):** Replace console.log with structured logging on line 48.

End of example.

## References

- `references/api.md` — Modern Fastify API usage, deprecated patterns, correct replacements.
- `references/patterns.md` — Idiomatic Fastify patterns: plugin architecture, decorators, encapsulation, route organization.
- `references/hooks.md` — Lifecycle hooks, request/reply decorators, encapsulation context.
- `references/performance.md` — Performance best practices: serialization, schema compilation, logging, connection handling.
- `references/security.md` — Security best practices: input validation, CORS, rate limiting, helmet, auth patterns.
- `references/typescript.md` — TypeScript integration: type providers, generic constraints, plugin typing, route typing.
- `references/testing.md` — Testing patterns: inject, test server setup, mocking, lifecycle.
