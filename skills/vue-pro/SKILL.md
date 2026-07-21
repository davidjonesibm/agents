---
name: vue-pro
description: >-
  Comprehensively reviews Vue.js code for best practices on Composition API,
  TypeScript integration, Pinia state management, performance, and security.
  Use when reading, writing, or reviewing Vue 3 projects with TypeScript.
---

Review Vue 3 and TypeScript code for correctness, modern API usage, and adherence to project conventions. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check for deprecated or outdated API usage using `references/api.md`.
2. Validate idiomatic Composition API patterns using `references/patterns.md`.
3. Check TypeScript usage for proper typing using `references/typescript.md`.
4. Validate Pinia store design and reactivity using `references/state.md`.
5. Ensure performance best practices are followed using `references/performance.md`.
6. Check for security vulnerabilities using `references/security.md`.
7. Validate test quality and patterns using `references/testing.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **Vue 3.5+** with `<script setup lang="ts">` in all SFC components.
- **Composition API only** — flag any Options API usage as a deprecated pattern.
- All components must use **TypeScript** (`lang="ts"`).
- Do not introduce third-party UI frameworks without asking first.
- Prefer composables (`use*`) for reusable logic, Pinia stores for shared state.
- Import shared types from `@chat/shared` — never redefine locally.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

Example output:

### ChatView.vue

**Line 15: Use `defineModel()` instead of manual `modelValue` prop + emit pattern.**

```vue
<!-- Before -->
<script setup lang="ts">
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<!-- After -->
<script setup lang="ts">
const model = defineModel<string>();
</script>
```

**Line 32: Use `useTemplateRef()` instead of `ref(null)` for template refs.**

```vue
<!-- Before -->
<script setup lang="ts">
const inputEl = ref<HTMLInputElement | null>(null);
</script>
<template><input ref="inputEl" /></template>

<!-- After -->
<script setup lang="ts">
const inputEl = useTemplateRef<HTMLInputElement>('input');
</script>
<template><input ref="input" /></template>
```

**Line 48: Use `storeToRefs()` when destructuring reactive state from a Pinia store.**

```vue
<!-- Before -->
<script setup lang="ts">
const store = useChatStore();
const { messages, loading } = store; // loses reactivity
</script>

<!-- After -->
<script setup lang="ts">
import { storeToRefs } from 'pinia';
const store = useChatStore();
const { messages, loading } = storeToRefs(store);
</script>
```
