---
name: api-design-pro
description: >-
  Comprehensively reviews and guides API architecture using the 3-layer design pattern
  (service layer / manager layer / resilience layer), RESTful conventions, resilience patterns,
  DTO design, error handling taxonomy, and API best practices. Framework-agnostic — works with
  Fastify, Express, ASP.NET, Go, Python, or any HTTP framework. Use when designing, implementing,
  or reviewing API connectivity layers, external API integrations, or backend service architecture.
---

Design and review API connectivity layers for correctness, resilience, and adherence to industry best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Validate 3-layer architecture (service / manager / resilience) using `references/layers.md`.
2. Check resilience patterns (circuit breaker, bulkhead, retry, timeout, fallback) using `references/resilience.md`.
3. Validate RESTful conventions, resource naming, and HTTP semantics using `references/rest.md`.
4. Check DTO design, validation, and data transfer patterns using `references/dtos.md`.
5. Audit error handling taxonomy and error response design using `references/errors.md`.
6. Validate API versioning strategy using `references/versioning.md`.
7. Check authentication and authorization patterns using `references/auth.md`.
8. Validate pagination patterns using `references/pagination.md`.
9. Check caching strategies and conditional requests using `references/caching.md`.
10. Validate API documentation and OpenAPI spec using `references/openapi.md`.
11. Check rate limiting and throttling using `references/rate-limiting.md`.
12. Validate testing patterns for API integrations using `references/testing.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- This skill is **framework-agnostic** — apply the patterns regardless of language or HTTP framework.
- The **3-layer pattern is non-negotiable** for external API integrations: service → manager → resilience.
- Always generate **complete, fully implemented code** — never use placeholders, TODOs, or "implement similarly" comments.
- Use the **most popular resilience library** for the target language (see `references/resilience.md`).
- Use **dependency injection** between layers for testability — never hard-code dependencies.
- All three layers must be implemented even for basic integrations — separation of concerns is the priority.
- Follow **RFC 9457** (Problem Details for HTTP APIs) for error responses.
- Prefer **cursor-based pagination** for large or frequently-updated collections.
- **Idempotency is mandatory** — all operations must be safe to retry without side effects.
- Use **OpenAPI 3.1** for API documentation and contract-first design.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated (with reference file).
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

## References

- `references/layers.md` — 3-layer architecture: service layer, manager layer, resilience layer.
- `references/resilience.md` — Resilience patterns: circuit breaker, bulkhead, retry, timeout, fallback.
- `references/rest.md` — RESTful API design: resource naming, HTTP methods, status codes, HATEOAS.
- `references/dtos.md` — DTO design: request/response shapes, validation, transformation, mapping.
- `references/errors.md` — Error handling: taxonomy, RFC 9457 Problem Details, error propagation.
- `references/versioning.md` — API versioning: URL path, query parameter, header-based, date-based.
- `references/auth.md` — Authentication & authorization: OAuth2, JWT, API keys, scopes.
- `references/pagination.md` — Pagination: cursor-based, offset-based, keyset, server-driven paging.
- `references/caching.md` — Caching: HTTP caching, ETag, Cache-Control, conditional requests.
- `references/openapi.md` — API documentation: OpenAPI 3.1, schema design, component reuse.
- `references/rate-limiting.md` — Rate limiting: throttling, 429 responses, Retry-After, RateLimit headers.
- `references/testing.md` — Testing: contract testing, integration testing, mocking external APIs.
