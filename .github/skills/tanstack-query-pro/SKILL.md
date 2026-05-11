---
name: tanstack-query-pro
description: >-
  Comprehensively reviews TanStack Query (React Query) v5 code for best practices on
  useQuery, useMutation, QueryClient, caching, data fetching, server state management,
  invalidation, prefetching, optimistic updates, infinite queries, SSR hydration, and
  TypeScript integration. Use when reading, writing, or reviewing React (or any framework)
  projects using TanStack Query for data fetching and server state. Trigger keywords:
  TanStack Query, React Query, useQuery, useMutation, QueryClient, caching, data fetching,
  server state, invalidation, prefetching, optimistic updates, infinite queries.
---

Review TanStack Query v5 code for correctness, idiomatic patterns, performance, and type safety. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check for deprecated v4 APIs and v5 migration issues using `references/api.md`.
2. Validate idiomatic query patterns, anti-patterns, and common mistakes using `references/patterns.md`.
3. Check caching configuration, staleTime, gcTime, and performance pitfalls using `references/performance.md`.
4. Review mutation patterns, optimistic updates, and rollback logic using `references/mutations.md`.
5. Validate TypeScript types, generics, and type inference patterns using `references/typescript.md`.
6. Check test setup, hook testing, and mock strategies using `references/testing.md`.
7. Review SSR hydration patterns, server/client QueryClient setup, and dehydration using `references/ssr.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **TanStack Query v5** (`@tanstack/react-query@^5`). Flag any v4 or earlier patterns as deprecated.
- All React examples use TypeScript/TSX with modern hooks.
- **Never mix v4 and v5 APIs** in the same codebase — flag any inconsistency.
- `queryFn` must return a Promise that resolves data or throws an Error — never return `undefined`.
- Every `useQuery` call requires both `queryKey` and `queryFn` (unless a default queryFn is registered).
- All hooks accept a **single object argument** in v5 — positional arguments are removed.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

## Example Output

### src/hooks/usePosts.ts

**Line 8: Use `gcTime` instead of removed `cacheTime` (v5 breaking change).**

```typescript
// Before (v4 — removed in v5)
const queryClient = new QueryClient({
  defaultOptions: { queries: { cacheTime: 5 * 60 * 1000 } },
});

// After (v5)
const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 5 * 60 * 1000 } },
});
```
