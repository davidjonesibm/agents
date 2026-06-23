---
# CUSTOMIZE: Adjust globs to match your API/backend file locations.
# This pattern covers common API directory structures across frameworks.
# Only loads when a matching file is open — no cost for frontend/test files.
#
# Token budget: target ≤ 1,500 tokens (≈ 6 KB) for this file.
# Estimate: wc -c .github/instructions/api.instructions.md | awk '{print $1/4 " tokens"}'
applyTo: '**/api/**,**/routes/**,**/controllers/**,**/handlers/**,**/server.*,**/router.*'
---

# API Conventions

## Request Validation

<!-- CUSTOMIZE: How and where incoming request data is validated. -->

- Validation library: [e.g. "Zod" / "class-validator" / "FluentValidation" / "pydantic"]
- Where validation runs: [e.g. "at route entry before handler logic; never trust downstream callers"]
- Schema location: [e.g. "`src/schemas/` — one file per resource"]
- On validation failure: [e.g. "return HTTP 422 with `{ error: string, fields: Record<string, string> }`"]

## Response Shape

<!-- CUSTOMIZE: Standardize success and error response shapes. -->

Success (2xx):

```
[e.g. { data: T } for single resource]
[e.g. { data: T[], total: number, page: number } for collections]
```

Error (4xx / 5xx):

```
[e.g. { error: string, code: string }]
[e.g. { error: string, code: string, details?: Record<string, string> }]
```

- Never leak stack traces or internal error messages to clients.
- Use structured error codes (not just HTTP status): [e.g. `USER_NOT_FOUND`, `VALIDATION_FAILED`]

## HTTP Conventions

<!-- CUSTOMIZE: REST conventions or RPC conventions used in this project. -->

- [e.g. "GET for reads, POST for creates, PATCH for partial updates, DELETE for deletes"]
- [e.g. "Resource URLs: `/users/:id` — plural noun, no verbs in path"]
- [e.g. "Query params for filtering/pagination; body for mutation payload"]
- Idempotency: [e.g. "PUT and DELETE must be idempotent"]
- Status codes: [e.g. "201 for creates, 204 for deletes with no body, 404 vs 403 distinction enforced"]

## Authentication & Authorization

<!-- CUSTOMIZE: How auth is implemented and enforced. -->

- Auth mechanism: [e.g. "JWT bearer tokens validated by middleware before route handlers"]
- Where auth runs: [e.g. "as a pre-handler/middleware; never inline in business logic"]
- Authorization: [e.g. "resource ownership checked in service layer, not route layer"]
- Unauthenticated: [e.g. "return 401; do not reveal whether resource exists"]
- Unauthorized: [e.g. "return 403 with `{ error: 'Forbidden', code: 'INSUFFICIENT_PERMISSIONS' }`"]

## Error Handling

<!-- CUSTOMIZE: Error flow from origin to client. -->

- Catch boundary: [e.g. "route handler or global error middleware only — no try/catch in services"]
- Typed errors: [e.g. "throw `AppError` subclasses (defined in `src/errors/`) with HTTP status + code"]
- Unexpected errors: [e.g. "log full error server-side; return generic 500 to client"]
- Logging: [e.g. "log request ID, route, status, and duration at handler exit"]

## Data Access

<!-- CUSTOMIZE: How routes interact with the database / data layer. -->

- [e.g. "Routes call service layer only — never access `src/db/` directly from a route"]
- [e.g. "Services call repository layer — no raw SQL in services"]
- [e.g. "Never expose raw DB row shapes in API responses — map to response DTOs"]

## Middleware / Plugins

<!-- CUSTOMIZE: Common middleware applied to routes. -->

- [e.g. "CORS: configured in `src/plugins/cors.ts`, not per-route"]
- [e.g. "Rate limiting: applied globally; per-route overrides in route options"]
- [e.g. "Request logging: automatic via logger middleware — don't add manual log statements"]

## Versioning

<!-- CUSTOMIZE: API versioning strategy (if any). -->

- [e.g. "URL versioning: `/v1/`, `/v2/` — current stable is v1"]
- [e.g. "Breaking changes require a new version; additive changes are backward-compatible"]
