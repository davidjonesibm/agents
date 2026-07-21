---
name: pocketbase-pro
description: >-
  Comprehensively reviews PocketBase code for best practices on collection design, API rules,
  JavaScript migrations, hooks, authentication, real-time subscriptions, SDK integration,
  file storage, and type safety. Use when reading, writing, or reviewing PocketBase projects,
  collection schemas, API rule configurations, or PocketBase JS SDK code.
---

Review PocketBase code for correctness, security, performance, and adherence to best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check for correct SDK API usage and modern patterns using `references/api.md`.
2. Validate collection design, field types, and schema patterns using `references/collections.md`.
3. Audit API rules, permissions, and access control using `references/security.md`.
4. Review JavaScript migration quality and idempotency using `references/migrations.md`.
5. Validate server-side hook usage and event handling using `references/hooks.md`.
6. Check authentication configuration and auth flows using `references/auth.md`.
7. Validate real-time subscription patterns and cleanup using `references/realtime.md`.
8. Check file upload and storage handling using `references/storage.md`.
9. Validate TypeScript type safety and schema synchronization using `references/typescript.md`.
10. Check performance best practices using `references/performance.md`.
11. Validate idiomatic patterns and avoid anti-patterns using `references/patterns.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target PocketBase **v0.25+** with the official **PocketBase JavaScript SDK v0.25+**.
- PocketBase is an embedded Go application with SQLite backing; the JSVM extends it with server-side JavaScript hooks and migrations.
- All schema changes **must** go through migration files (`pb_migrations/`) — never modify schema through the admin UI in production.
- Design API rules **before** implementing client code — security model first.
- Server-side JS files live in `pb_hooks/` (hooks, routes, crons) and `pb_migrations/` (schema changes).
- The PocketBase JS SDK (client-side) and the PocketBase JSVM (server-side `pb_hooks`) are **different environments** — do not confuse their APIs.
- Never expose superuser credentials or auth tokens to client-side code.
- Use the `expand` parameter or back-relation syntax to load relations and avoid N+1 queries.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.
