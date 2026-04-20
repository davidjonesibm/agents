# Reference File Entry Examples

Examples of well-written reference file entries and what makes them effective.

## Anatomy of a Good Entry

Every rule entry should have:

1. **Rule statement** — a concise, imperative instruction (start with a verb).
2. **Before/after code block** — concrete example of the wrong and right way.
3. **"Why" explanation** (optional) — one sentence explaining the reason when it's not obvious.

````markdown
- Always use `defineModel()` instead of the manual `modelValue` prop + `update:modelValue` emit pattern.

  ```vue
  <!-- Before (deprecated pattern) -->
  <script setup lang="ts">
  const props = defineProps<{ modelValue: string }>();
  const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
  </script>

  <!-- After -->
  <script setup lang="ts">
  const model = defineModel<string>();
  </script>
  ```
````

````

## Good Entry: Pattern with "Why" Explanation

```markdown
- Prefer `useTemplateRef()` over `ref(null)` for template element references (Vue 3.5+).

  ```vue
  <!-- Before -->
  <script setup>
  const inputEl = ref<HTMLInputElement | null>(null)
  </script>
  <template><input ref="inputEl" /></template>

  <!-- After -->
  <script setup>
  const inputEl = useTemplateRef<HTMLInputElement>('input')
  </script>
  <template><input ref="input" /></template>
````

**Why:** `useTemplateRef()` provides better type inference and avoids the naming collision
between reactive refs and template refs.

````

Key qualities: imperative verb ("Prefer"), version-pinned ("Vue 3.5+"), before/after code, brief "why".

## Good Entry: API Deprecation

```markdown
- Use `fastify.register()` with async functions instead of callback-style `done` parameter.

  ```typescript
  // Before (callback style — deprecated in v5)
  fastify.register((instance, opts, done) => {
    instance.get('/health', handler);
    done();
  });

  // After (async — modern pattern)
  fastify.register(async (instance, opts) => {
    instance.get('/health', handler);
  });
````

````

Key qualities: states what's deprecated and what replaces it, labels the version, clean before/after.

## Good Entry: Security Rule with Severity

```markdown
- **Critical:** Never interpolate user input into raw SQL — always use parameterized queries.

  ```typescript
  // Before (SQL injection vulnerability)
  const result = await db.query(`SELECT * FROM users WHERE id = '${userId}'`);

  // After (parameterized query)
  const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
````

````

Key qualities: severity flag ("Critical"), clear vulnerability name, concise fix.

## Good Entry: Cross-Reference

```markdown
- Wrap shared plugins with `fastify-plugin` (`fp`) so decorators are exposed to sibling plugins
  (see also `references/typescript.md` for typing decorated instances).

  ```typescript
  // Before (decorators trapped in encapsulated scope)
  export default async function dbPlugin(fastify: FastifyInstance) {
    fastify.decorate('db', pool);
  }

  // After
  import fp from 'fastify-plugin';
  export default fp(async function dbPlugin(fastify: FastifyInstance) {
    fastify.decorate('db', pool);
  }, { name: 'db-plugin' });
````

````

Key qualities: rule stands alone in its file, cross-references related content without duplicating it.

## Bad Entry: Too Vague

```markdown
- Use proper error handling in your application.
````

Problems: no code example, no specifics, not actionable. An agent can't apply this rule.

## Bad Entry: Too Long / Prose-Heavy

```markdown
- When you're working with Fastify and you want to add a database connection,
  you should think about whether to use fastify-plugin or not. The main thing
  to consider is encapsulation. Fastify has a concept called encapsulation where
  each plugin gets its own scope. If you want to share something across plugins...
  [continues for 15 more lines of explanation before any code]
```

Problems: buries the rule in prose, no concise imperative statement, code example comes too late.

## Bad Entry: Hallucinated API

````markdown
- Use `fastify.createValidator()` to build reusable schema validators.

  ```typescript
  const validate = fastify.createValidator(mySchema);
  ```
````

````

Problems: `createValidator` doesn't exist in Fastify. Never include APIs that aren't confirmed by documentation.

## Content Density Example

A well-written 15-line block can contain 3 actionable rules:

```markdown
- Use `reply.code()` instead of `reply.status()` — `status()` is an alias that may be removed.
- Use `reply.send()` or return a value — never use both (causes `FST_ERR_REP_ALREADY_SENT`).
- Use `reply.hijack()` before writing raw responses to prevent Fastify from calling `send()` automatically.
````

Each rule fits on 1-2 lines. Code examples can follow individually when the rule isn't self-explanatory.

## Version Pinning

Always state the target version for version-specific rules:

```markdown
- Use the `Type Provider` pattern for schema-to-type inference (Fastify v4.10+, required in v5).
```

If a rule applies to all versions, no pin is needed. If a rule applies starting from a specific version, include `(vX.Y+)`.
