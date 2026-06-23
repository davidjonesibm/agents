# Instruction Templates

Token-efficient templates for `.github/copilot-instructions.md` and scoped `.instructions.md` files. These templates are designed to work alongside agents and skills synced from agent-repo.

---

## Quick Start

1. Copy the files you need into your repo:

   ```sh
   # Always-on global instructions
   cp instruction-templates/copilot-instructions.md .github/copilot-instructions.md

   # Scoped instructions (copy only what applies to your project)
   mkdir -p .github/instructions
   cp instruction-templates/testing.instructions.md .github/instructions/testing.instructions.md
   cp instruction-templates/api.instructions.md .github/instructions/api.instructions.md
   cp instruction-templates/architecture.instructions.md .github/instructions/architecture.instructions.md
   ```

2. Open each file and replace all `[bracketed placeholders]` with your actual project details.

3. Delete comment blocks (lines starting with `<!--`) once you've read them — they add tokens.

4. Measure your baseline (see [Measuring Token Impact](#measuring-token-impact)).

---

## Files in This Directory

| Template                       | Destination                                         | When It Loads        | Token Target |
| ------------------------------ | --------------------------------------------------- | -------------------- | ------------ |
| `copilot-instructions.md`      | `.github/copilot-instructions.md`                   | **Every request**    | ≤ 2,000      |
| `testing.instructions.md`      | `.github/instructions/testing.instructions.md`      | Test files open      | ≤ 1,500      |
| `api.instructions.md`          | `.github/instructions/api.instructions.md`          | API/route files open | ≤ 1,500      |
| `architecture.instructions.md` | `.github/instructions/architecture.instructions.md` | Doc files open       | ≤ 1,000      |

---

## How `applyTo` Scoping Works

Without scoping, every instruction file loads on every request. With `applyTo`, a file only loads when the currently open file matches the glob pattern:

```yaml
---
applyTo: '**/*.test.ts,**/*.spec.ts'
---
```

**Token savings example:**

| Approach                                     | Always-on tokens | When editing a component  |
| -------------------------------------------- | ---------------- | ------------------------- |
| All conventions in `copilot-instructions.md` | 3,000 tokens     | 3,000 tokens              |
| Split with `applyTo`                         | 500 tokens       | 500 tokens                |
| **Savings**                                  |                  | **2,500 tokens per turn** |

Testing conventions are irrelevant when you're editing a UI component. Scoping prevents paying for context you don't need.

### Customizing `applyTo` Patterns

The templates include common glob patterns. Adjust them to match your actual file layout:

```yaml
# If your tests live in a tests/ directory at root
applyTo: "tests/**,**/*.test.ts,**/*.spec.ts"

# If you use a monorepo with packages
applyTo: "packages/*/src/**/*.test.ts,packages/*/tests/**"

# If your API lives in a specific package
applyTo: "packages/api/src/**,apps/server/src/**"
```

---

## How These Interact with Synced Agents & Skills

These instruction files **complement** the agents and skills synced from agent-repo — they don't replace them.

```
copilot-instructions.md     ← Project identity: stack, structure, conventions
        +
*.instructions.md           ← Domain context: testing rules, API patterns
        +
Agent (.agent.md)           ← Role: what the agent does and how to behave
        +
Skill (SKILL.md)            ← Expertise: framework-specific deep knowledge
```

**Division of responsibility:**

| Content Type                 | Where It Lives                                  |
| ---------------------------- | ----------------------------------------------- |
| Your tech stack and versions | `copilot-instructions.md`                       |
| Your file structure          | `copilot-instructions.md`                       |
| Your naming conventions      | `copilot-instructions.md`                       |
| Your testing conventions     | `testing.instructions.md` (scoped)              |
| Your API patterns            | `api.instructions.md` (scoped)                  |
| Framework best practices     | Synced skills (e.g. `fastify-pro`, `react-pro`) |
| Agent behavior and role      | Synced agents (e.g. `software-engineer`)        |

**Key rule:** If a convention is in `copilot-instructions.md`, don't repeat it in agent bodies or skills. Agents should say "follow the project conventions in `.github/copilot-instructions.md`" — not re-list them.

---

## Cache-Friendly Ordering

Both Claude (Anthropic) and GPT (OpenAI) use prefix-based prompt caching. Static content at the start of a prompt gets a ~90% token cost discount on repeated turns.

**The rule:** Put stable, rarely-changing content FIRST. Put volatile content LAST (or move it out entirely).

```
STABLE (cache-eligible)          VOLATILE (cache-busting)
─────────────────────────────    ──────────────────────────────
Project name                     Current PR description
Tech stack (changes rarely)      Today's date
File structure                   Branch name
Naming conventions               Current sprint goal
Error handling patterns          Dynamic feature flags
```

**What breaks caching:**

- Dynamic content (dates, usernames, branch names) anywhere in instructions
- Editing `copilot-instructions.md` during an active session
- Changing the active agent mid-session

Keep `copilot-instructions.md` identical across turns. The more stable the file, the more cache hits you get.

---

## Measuring Token Impact

### Estimate file sizes

```bash
# Always-on cost (tokens every request)
wc -c .github/copilot-instructions.md | awk '{printf "%.0f tokens\n", $1/4}'

# Scoped file costs (tokens only on match)
wc -c .github/instructions/testing.instructions.md | awk '{printf "%.0f tokens\n", $1/4}'
wc -c .github/instructions/api.instructions.md | awk '{printf "%.0f tokens\n", $1/4}'

# Total instructions footprint
find .github -name "*.md" -exec wc -c {} + | tail -1 | awk '{printf "%.0f tokens total\n", $1/4}'
```

### Token budget targets

| Project size          | `copilot-instructions.md` | Goal per session |
| --------------------- | ------------------------- | ---------------- |
| Solo / small          | ≤ 500 tokens              | ≤ 8,000 tokens   |
| Small team (2–5)      | ≤ 1,000 tokens            | ≤ 15,000 tokens  |
| Mid-size team (5–20)  | ≤ 2,000 tokens            | ≤ 25,000 tokens  |
| Enterprise / monorepo | ≤ 4,000 tokens            | ≤ 40,000 tokens  |

### Warning signs

- `copilot-instructions.md` over 8 KB → move domain content to scoped files
- An `*.instructions.md` file without `applyTo` → it never auto-loads; delete or add `applyTo`
- Same convention in 3+ places → consolidate to one source of truth
- Any dynamic content (dates, usernames) → remove immediately; it kills caching

---

## Reducing the Synced Agent/Skill Footprint

Every synced skill contributes ~300 bytes (~75 tokens) of frontmatter to the discovery scan even when not invoked. Exclude skills your project doesn't use in `.copilot-deps.json`:

```json
{
  "source": "github:your-org/agent-repo",
  "excludeSkills": ["android-kotlin-pro", "swiftui-pro", "flutter-pro"],
  "excludeAgents": ["app-store-deployment-expert"]
}
```

A pure web project that excludes mobile skills saves ~600–750 tokens of scan overhead per session.

See `docs/token-optimization.md` for the full optimization guide.
