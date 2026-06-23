---
name: vue-pro
description: >-
  Vue 3.5+ best practices for Composition API, TypeScript integration, Pinia state
  management, performance, and security. Use when reading, writing, or reviewing Vue 3 projects.
---

Review Vue 3 and TypeScript code for correctness, modern API usage, and adherence to project conventions. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check for deprecated or outdated API usage using `.github/skills/vue-pro/references/api.md`.
2. Validate idiomatic Composition API patterns using `.github/skills/vue-pro/references/patterns.md`.
3. Check TypeScript usage for proper typing using `.github/skills/vue-pro/references/typescript.md`.
4. Validate Pinia store design and reactivity using `.github/skills/vue-pro/references/state.md`.
5. Ensure performance best practices are followed using `.github/skills/vue-pro/references/performance.md`.
6. Check for security vulnerabilities using `.github/skills/vue-pro/references/security.md`.
7. Validate test quality and patterns using `.github/skills/vue-pro/references/testing.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **Vue 3.5+** with `<script setup lang="ts">` in all SFC components.
- **Composition API only** — flag any Options API usage as a deprecated pattern.
- All components must use **TypeScript** (`lang="ts"`).
- Do not introduce third-party UI frameworks without asking first.
- Prefer composables (`use*`) for reusable logic, Pinia stores for shared state.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.
