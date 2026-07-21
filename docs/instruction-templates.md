# Instruction Templates & Token Optimization

Templates for `.github/copilot-instructions.md` and scoped `.instructions.md` files. These are **repo-specific** — they ship as reference material you copy and customize for your project.

---

## Overview

Instruction files tell Copilot about your project's stack, conventions, and constraints. Unlike agents and skills (which are reusable across projects), instructions are inherently project-specific.

This repo provides token-optimized templates as a starting point. You should:

1. Copy the templates you need into your repo
2. Replace placeholders with your actual project details
3. Delete comment blocks (they add tokens)
4. Never sync them back — they're yours to customize

---

## Available Templates

| Template                       | Destination                                         | When It Loads        | Token Target |
| ------------------------------ | --------------------------------------------------- | -------------------- | ------------ |
| `copilot-instructions.md`      | `.github/copilot-instructions.md`                   | **Every request**    | ≤ 2,000      |
| `testing.instructions.md`      | `.github/instructions/testing.instructions.md`      | Test files open      | ≤ 1,500      |
| `api.instructions.md`          | `.github/instructions/api.instructions.md`          | API/route files open | ≤ 1,500      |
| `architecture.instructions.md` | `.github/instructions/architecture.instructions.md` | Doc files open       | ≤ 1,000      |

---

## Quick Start

### Option A: Standalone Script (Recommended)

Run `init-templates.sh` from any repo root — no sync or global install required:

```sh
# If you have a local clone of the agent-repo:
/path/to/agent-repo/init-templates.sh

# Or point to it via env var:
COPILOT_AGENTS_DIR=/path/to/agent-repo init-templates.sh

# Or let it clone from GitHub automatically:
./init-templates.sh

# Preview first:
./init-templates.sh --dry-run

# See available templates:
./init-templates.sh --list
```

Existing files are never overwritten — safe to run on repos that already have some instruction files.

### Option B: Manual Copy

```sh
# Always-on global instructions
cp instruction-templates/copilot-instructions.md .github/copilot-instructions.md

# Scoped instructions (copy only what applies)
mkdir -p .github/instructions
cp instruction-templates/testing.instructions.md .github/instructions/testing.instructions.md
cp instruction-templates/api.instructions.md .github/instructions/api.instructions.md
cp instruction-templates/architecture.instructions.md .github/instructions/architecture.instructions.md
```

Then open each file and replace `[bracketed placeholders]` with your actual project details.

---

## How `applyTo` Scoping Works

Without scoping, every instruction file loads on every request — wasting tokens. With `applyTo`, a file only loads when the open file matches the glob:

```yaml
---
applyTo: '**/*.test.ts,**/*.spec.ts'
---
```

**Token savings example:**

| Approach                    | Always-on tokens | When editing a component  |
| --------------------------- | ---------------- | ------------------------- |
| All conventions in one file | 3,000 tokens     | 3,000 tokens              |
| Split with `applyTo`        | 500 tokens       | 500 tokens                |
| **Savings**                 |                  | **2,500 tokens per turn** |

---

## Token Budget Rules

Your `.github/copilot-instructions.md` loads on **every single request**. Every token there multiplies across the lifetime of the project.

| Guideline                           | Rationale                                         |
| ----------------------------------- | ------------------------------------------------- |
| Target ≤ 2,000 tokens (≈ 8 KB)      | Leaves room for agents, skills, file context      |
| Stable content first, volatile last | Maximizes prompt cache hits (~90% discount)       |
| No framework rules                  | Let skills handle those — they load conditionally |
| No dates/usernames                  | Dynamic content breaks cache                      |
| No per-PR context                   | Use comments or chat for ephemeral context        |

Estimate tokens: `wc -c .github/copilot-instructions.md` ÷ 4

---

## Sync Behavior

### Consumer Repos

By default, `sync.mjs` copies `instruction-templates/` into the consumer for reference. These are **not** auto-applied — you must manually copy them into `.github/` or `.github/instructions/`.

If you don't want the reference copies synced:

- Add `instruction-templates/` to `.gitignore` after first sync
- Or just ignore the directory — it has zero runtime cost

### Global Install

`install.mjs` does **not** install instruction templates globally (they're project-specific by nature). Use `init-templates.sh` from a clone of the agent-repo, or copy templates manually.

### Source Repo Forks

In source-repo mode, `instruction-templates/` is mirrored in full so the fork can redistribute templates to its own consumers.

---

## Further Reading

See [Token Optimization](./token-optimization.md) for the full theory:

- Context loading behavior (what loads when)
- Prompt caching architecture (Anthropic + OpenAI)
- Cumulative cost examples
- Measurement techniques
