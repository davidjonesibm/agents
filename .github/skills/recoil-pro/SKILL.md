---
name: recoil-pro
description: >-
  Comprehensively reviews Recoil code for best practices on atoms, selectors,
  RecoilRoot, useRecoilState, useRecoilValue, atomFamily, selectorFamily, async
  selectors, snapshots, atom effects, and React state management patterns. Use
  when reading, writing, or reviewing React projects that use Recoil for state
  management. Trigger keywords: Recoil, atoms, selectors, RecoilRoot, state
  management, useRecoilState, useRecoilValue, atomFamily, selectorFamily, async
  selectors, snapshots, atom effects, React state.
---

Review Recoil state management code for correctness, performance, and adherence to best practices. Report only genuine problems — do not nitpick or invent issues.

> **Status note:** Recoil is in maintenance / experimental status as of 2024. Facebook/Meta has not committed to a stable 1.0 release. APIs marked `_UNSTABLE` may change. For greenfield projects, consider evaluating Jotai or Zustand as alternatives. For existing Recoil codebases, the patterns in this skill remain valid and the library is stable in practice.

Review process:

1. Check for correct hook selection and API usage using `references/api.md`.
2. Validate atom design, atomFamily usage, and atom effects using `references/atoms.md`.
3. Validate idiomatic patterns and anti-patterns using `references/patterns.md`.
4. Check performance best practices (memoization, atom granularity, re-render prevention) using `references/performance.md`.
5. Validate TypeScript typing patterns using `references/typescript.md`.
6. Check testing patterns (snapshot testing, component tests, async selector tests) using `references/testing.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **Recoil 0.7.x** — the latest stable release.
- All state must live inside a `<RecoilRoot>` ancestor.
- Atom keys must be globally unique strings — duplicates cause silent bugs in production.
- Never put business logic directly in components — use selectors and atoms.
- Selectors are automatically memoized; derived state belongs in selectors, not `useMemo`.
- APIs suffixed `_UNSTABLE` are subject to change — prefer stable equivalents where they exist.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

### Example output

**src/state/userAtoms.ts — Line 12: Atom keys must be globally unique.**

```tsx
// Before — generic key risks collision in large apps
const userState = atom({
  key: 'user',
  default: null,
});

// After — namespaced key avoids collision
const userState = atom({
  key: 'user/current',
  default: null,
});
```
