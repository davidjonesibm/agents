---
applyTo: '**'
---

# Codebase Instructions

**BEFORE planning or implementing any feature, read [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).** It is the authoritative living reference for this codebase.

## Stack Quick-Reference

| Concern            | Location                                 | Notes                                      |
| ------------------ | ---------------------------------------- | ------------------------------------------ |
| Frontend app       | `apps/frontend/`                         | Vue 3 + TypeScript + DaisyUI (Tailwind)    |
| Backend app        | `apps/backend/`                          | Fastify + TypeScript                       |
| Shared types       | `libs/shared/`                           | Imported as `@chat/shared`                 |
| Auth               | Supabase                                 | Frontend SDK for auth only                 |
| Database           | PocketBase                               | Group / channel / message data             |
| Real-time          | Fastify WebSocket (`@fastify/websocket`) | Ephemeral: typing, presence, message relay |
| Push notifications | `web-push` (VAPID) via Fastify           | Served from `routes/push.ts`               |
| PWA                | `vite-plugin-pwa` (`injectManifest`)     | Service worker in `apps/frontend/`         |
| Monorepo tooling   | pnpm workspaces                          | Run tasks via `pnpm --filter …`            |

## Shared Types (`@chat/shared`)

- Always import types from `@chat/shared` — never redefine locally what already exists there.
- All DB record types **must** extend `BaseRecord` (provides `id`, `created_at`, `updated_at`).
- Follow the `*Record → Pick<>` pattern: `*Record` is the full DB row; API-facing shapes are `Pick<*Record, ...>` subsets.
- Use `*Request` / `*Response` for every API endpoint payload pair.
- WebSocket messages use `ClientMessage` / `ServerMessage` discriminated unions (keyed on `type`).
- Use `MessageWithSender` for read-heavy message responses (avoids N+1 joins).
- Use `PaginatedResponse<T>` for any paginated endpoint.

## Frontend Conventions

- **Composition API only** — never use Options API.
- State management: **Pinia** stores in `stores/` (`*Store` naming, e.g. `chatStore`).
- Reusable logic: composables in `composables/` (`use*` naming, e.g. `useChat`).
- Components: `components/auth/` and `components/chat/`; route-level components in `views/` (`*View.vue`).
- **Supabase SDK is for auth only** — never use it for direct DB queries.
- All application data flows through the **Fastify REST API**.

## Backend Conventions

- New routes → `routes/` directory; register with descriptive Fastify plugin names (`*Plugin`).
- New plugins → `plugins/` directory.
- Always use `@chat/shared` types for request/response shapes.
- **Validate all input** with Fastify JSON Schema (attach `schema` to each route).
- DB access uses the Supabase **service-role client** — never the anon key on the server.
- WebSocket auth: JWT passed as query param (`/ws?token=JWT`); validated in `plugins/auth.ts`.

## WebSocket Type Safety

- Every new WS message type **must** be added to the `ClientMessage` or `ServerMessage` discriminated union in `libs/shared/src/types/events.ts`.
- Never send untyped / ad-hoc JSON over the WebSocket — always use the shared union types.

## Naming Conventions

| Thing                     | Convention               | Example                |
| ------------------------- | ------------------------ | ---------------------- |
| DB record type            | `*Record`                | `ChannelRecord`        |
| API request/response      | `*Request` / `*Response` | `CreateChannelRequest` |
| Composable                | `use*`                   | `useChannels`          |
| Pinia store               | `*Store`                 | `channelStore`         |
| Route-level Vue component | `*View.vue`              | `ChatView.vue`         |
| Fastify plugin            | `*Plugin`                | `authPlugin`           |

## Database Types Contract

`apps/backend/database.types.ts` is the hand-maintained Supabase type file. `supabaseAdmin` is typed as `SupabaseClient<Database>` — every table must have `Row`, `Insert`, `Update`, and `Relationships` entries in that file.

**Every SQL migration that creates a new table MUST be accompanied by a corresponding addition to `database.types.ts`.** Never cast `supabaseAdmin as any` to work around a missing table type — adding the type is the fix.

## Type Narrowing Patterns

- **Nullable store → required prop**: Use `v-if` guards (e.g., `v-if="store.value"`) so Vue narrows the type before the prop binding.
- **`null` → `undefined` for DOM bindings**: Use `?? undefined` (e.g., `:src="url ?? undefined"`).
- **Guard before action**: Use early returns (e.g., `if (!id) return;`) before using nullable values.

## Validation

After any code change, **always** run the following checks before considering the task complete:

1. **Type-check**: `pnpm --filter @chat/backend exec tsc --noEmit` and `pnpm --filter @chat/frontend exec vue-tsc --noEmit`
2. **Build**: `pnpm build`
3. **Lint**: `pnpm lint`

Never rely solely on build success — `tsc --noEmit` catches type errors that the build toolchain (esbuild, Vite) silently ignores.

## Debugging & Logging Protocol

When investigating a bug or unexpected behavior, **always instrument with logging before attempting a speculative fix**. Observe first, then fix — don't guess blindly.

### Step 1: Add Diagnostic Logging

Before changing any logic, add targeted log statements around the suspected code path to capture:

- **Inputs**: Function arguments, request payloads, props/state at entry
- **Control flow**: Which branch was taken, whether a guard returned early
- **Outputs**: Return values, response payloads, emitted events
- **Errors**: Full error objects (not just messages), stack traces where available

### Step 2: Reproduce and Read Logs

Ask the user to reproduce the issue (or reproduce it yourself if possible), then analyze the log output to identify the root cause before writing a fix.

### Step 3: Fix and Retain Useful Logging

After the fix, **keep logging that aids future diagnostics** (error catches, unexpected-state warnings). Remove overly verbose debug-only lines.

### Stack-Specific Logging Patterns

| Stack | Pattern | Example |
|-------|---------|---------|
| **Backend (Fastify)** | `fastify.log.{level}({ contextObj }, 'message')` | `fastify.log.debug({ userId, channelId }, 'Fetching messages')` |
| **Frontend (Vue/TS)** | `console.{level}('[Tag]', ...data)` | `console.error('[ChannelStore] Failed to fetch:', err)` |
| **iOS (Swift)** | `Logger(subsystem: "com.chatapp", category: "…")` | `logger.debug("Loading messages for channel \(channelId)")` |

- **Backend**: Use Fastify's structured logger (`fastify.log.debug`, `.info`, `.warn`, `.error`). Always pass context as the first object arg for structured output. Never use bare `console.log` in backend code.
- **Frontend**: Prefix every log with a bracketed tag matching the component/store name (e.g., `[ChannelStore]`, `[ChatView]`). Use `console.error` for caught exceptions, `console.warn` for unexpected-but-recoverable states.
- **iOS**: Use `os.Logger` with subsystem `"com.chatapp"` and a descriptive category. Use `.debug` for diagnostic output, `.error` for failures. Never use bare `print()` in production code paths.

## Do NOT

- Query Supabase directly from the frontend (except auth).
- Use the Vue Options API anywhere.
- Define types locally that belong in `@chat/shared`.
- Add fields to `BaseRecord` — it is a fixed base interface.
- Send untyped JSON over WebSocket.
- Bypass Fastify JSON Schema validation for user-supplied input.
- Cast `supabaseAdmin as any` (or `untypedAdmin`) — update `database.types.ts` instead.
- Use the TypeScript `!` non-null assertion operator — use `v-if` type narrowing, `?? undefined` coalescing, or control-flow guards instead.
