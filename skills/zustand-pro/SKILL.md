---
name: zustand-pro
description: >-
  Comprehensively reviews Zustand code for best practices on store creation, selectors,
  middleware (persist, immer, devtools, subscribeWithSelector), slices pattern, subscriptions,
  performance optimization, re-render prevention, TypeScript typing, and testing. Use when
  reading, writing, or reviewing React state management with Zustand v5 stores, selectors,
  middleware, or slices.
---

Review Zustand state management code for correctness, performance, and adherence to best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check for deprecated v4 APIs and v5 breaking changes using `references/api.md`.
2. Validate idiomatic store patterns, action co-location, and anti-patterns using `references/patterns.md`.
3. Check selector usage, `useShallow`, and re-render prevention using `references/performance.md`.
4. Review middleware usage (`persist`, `immer`, `devtools`, `subscribeWithSelector`) using `references/middleware.md`.
5. Check TypeScript typings — curried `create`, `StateCreator`, slice generics using `references/typescript.md`.
6. Validate testing setup, store reset, and mocking patterns using `references/testing.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **Zustand v5** on **React 18+** with **TypeScript 4.5+**.
- All code examples use TypeScript with named imports (no default exports in v5).
- Always use the curried `create<T>()((set) => ...)` form with TypeScript — the non-curried form loses type inference with middleware.
- Actions live inside the store alongside state — no separate action files unless using the slices pattern.
- Selectors must return stable references; wrap object/array selections in `useShallow` to prevent infinite loops.
- Never put derived state into the store if it can be computed in a selector.
- Apply middleware from the outside in: `devtools(persist(immer(...)))`.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated (e.g., "Wrap object selectors with `useShallow` to prevent re-render loops").
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

Example output:

### stores/userStore.ts

**Line 18: Selectors returning new objects cause infinite re-render loops in v5.**

```tsx
// Before
const { name, email } = useUserStore((state) => ({
  name: state.name,
  email: state.email,
}));

// After
import { useShallow } from 'zustand/react/shallow';
const { name, email } = useUserStore(
  useShallow((state) => ({ name: state.name, email: state.email })),
);
```
