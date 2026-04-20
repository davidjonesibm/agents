# SKILL.md Frontmatter

Rules for the YAML frontmatter block at the top of every `SKILL.md` file.

## Required Fields

Every `SKILL.md` must begin with a YAML frontmatter block containing exactly two fields:

```yaml
---
name: <kebab-case-name>
description: >-
  One-line description of what the skill does and when to use it.
  Include trigger keywords for routing.
---
```

## `name` Field

- Must be **kebab-case** (lowercase, hyphens between words).
- Must match the skill's directory name exactly: a skill at `.github/skills/fastify-pro/` has `name: fastify-pro`.
- This field is used as the skill's identity for routing data and programmatic references.

```yaml
# Before (wrong — name does not match directory)
# Directory: .github/skills/fastify-pro/
---
name: Fastify Pro
---
# After (correct — kebab-case, matches directory)
# Directory: .github/skills/fastify-pro/
---
name: fastify-pro
---
```

**Why:** The `name` field is a machine-readable identifier. Mismatches between the directory name and the `name` field break skill lookup and routing.

## `description` Field

- One or two sentences describing what the skill does.
- Must include **trigger keywords** — words and phrases that help agents or routing systems decide when to load this skill.
- Use the `>-` YAML block scalar for multi-line descriptions that fold into a single line.

```yaml
# Before (too vague, no trigger keywords)
---
name: vue-pro
description: Reviews Vue code.
---
# After (specific, includes trigger keywords)
---
name: vue-pro
description: >-
  Comprehensively reviews Vue.js code for best practices on Composition API,
  TypeScript integration, Pinia state management, performance, and security.
  Use when reading, writing, or reviewing Vue 3 projects with TypeScript.
---
```

**Why:** The description is used for skill matching. An agent scanning available skills reads these descriptions to decide which skill to load. Vague descriptions cause skills to be skipped.

## Trigger Keyword Strategy

Include keywords that cover:

- **Technology names** — the library, framework, or platform name and common abbreviations.
- **Task verbs** — "review", "build", "create", "migrate", "audit", "debug".
- **Domain topics** — specific areas covered (e.g., "Composition API", "plugin architecture", "caching strategies").
- **File types or patterns** — if relevant (e.g., "Caddyfile", "Dockerfile", "SKILL.md").

## Common Frontmatter Mistakes

- **Using Title Case or spaces in `name`** — must be kebab-case. `name: Fastify Pro` → `name: fastify-pro`.
- **Name/directory mismatch** — `name` must equal the directory name. A skill at `skills/my-skill/` must have `name: my-skill`.
- **Missing trigger keywords in description** — a description like "Helps with Docker" won't route correctly. List specific topics.
- **Using `description:` without `>-`** — long descriptions without the block scalar produce invalid YAML or unreadable single-line strings.
- **Adding extra frontmatter fields** — only `name` and `description` are standard for skills. Agent `.md` files may have additional fields (`tools`, `agents`, etc.), but skill `SKILL.md` files use only these two.
