---
name: react-pro
description: >-
  React 19+ best practices for hooks, components, state management, performance,
  TypeScript, security, and testing. Use when reading, writing, or reviewing React projects.
---

Review React code for correctness, performance, security, and adherence to modern React 19+ best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check for Rules of Hooks violations, hook misuse, and custom hook conventions using `.github/skills/react-pro/references/hooks.md`.
2. Validate usage of React 19+ APIs, deprecated APIs, and their modern replacements using `.github/skills/react-pro/references/api.md`.
3. Check for anti-patterns, component design problems, and composition issues using `.github/skills/react-pro/references/patterns.md`.
4. Review memoization strategy, rendering performance, and concurrent features using `.github/skills/react-pro/references/performance.md`.
5. Validate TypeScript prop types, event types, ref types, and generic patterns using `.github/skills/react-pro/references/typescript.md`.
6. Check security risks including XSS, injection, and unsafe patterns using `.github/skills/react-pro/references/security.md`.
7. Validate test structure, query strategy, and async testing patterns using `.github/skills/react-pro/references/testing.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **React 19+** (latest stable, `react@19.x`).
- All code examples use modern JSX/TSX with function components — class components are legacy.
- The React Compiler (available in React 19 toolchains) can auto-memoize; avoid redundant manual memoization when the compiler is active.
- `ref` as a direct prop on function components is the React 19 default — `forwardRef` is no longer required.
- `<Context>` (without `.Provider`) is the React 19 way to provide context values.
- `use(promise)` and `use(context)` are the new data-access hooks; they can be called conditionally.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.
