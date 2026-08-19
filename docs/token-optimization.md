# Token Optimization for Downstream Consumer Repos

This guide helps teams consuming the agent-repo minimize token usage while preserving effective agent context. All estimates use **1 token ≈ 4 characters** as the working rule of thumb.

---

## 1. Token Budget Model

VS Code Copilot builds its context window in layers. Understanding which layers are always present versus conditional is the foundation of any optimization strategy.

### Context Loading Behavior

| Source                                  | When Loaded                                    | Approx. Size              | Strategy                                         |
| --------------------------------------- | ---------------------------------------------- | ------------------------- | ------------------------------------------------ |
| `.github/copilot-instructions.md`       | **Always** — every request                     | Keep ≤ 4 KB (≤ 1K tokens) | Ruthlessly prune; move specifics to scoped files |
| `*.instructions.md` with `applyTo` glob | **Conditional** — only when open files match   | Per-file, loaded on match | Scope tightly; pay cost only when relevant       |
| `*.instructions.md` without `applyTo`   | **Never auto-applied** — manual attach only    | Zero unless referenced    | Use for deep reference content                   |
| Agent `.agent.md` body                  | **Per-session** — loaded when agent selected   | ~2–8 KB typical           | Cost only in that agent's session                |
| Skill `SKILL.md` frontmatter            | **Discovery phase** — all skills scanned       | ~200–400 bytes each       | Cheap; used for routing only                     |
| Skill `SKILL.md` body                   | **On match** — when skill is invoked           | ~4–20 KB typical          | Loaded once per session                          |
| Skill `references/*.md`                 | **Explicit read** — only when read_file called | ~4–40 KB per file         | Lazy; zero cost until needed                     |

### Cumulative Cost Example

For a typical downstream repo using this agent-repo:

```
Always-on:
  copilot-instructions.md         ~2 KB    ~500 tokens
  (well-optimized)

Per-session (agent selected):
  RUG orchestrator body          ~20 KB  ~5,000 tokens
  Routing skill (bundled)        ~12 KB  ~3,000 tokens
  Active specialist agent body   ~8 KB   ~2,000 tokens
  ─────────────────────────────────────────────────────
  Total per session              ~42 KB  ~10,500 tokens

On first skill invocation:
  Skill SKILL.md body            ~8 KB   ~2,000 tokens
  (one reference file read)      ~12 KB  ~3,000 tokens
  ─────────────────────────────────────────────────────
  Peak with one skill            ~62 KB  ~15,500 tokens
```

**Without optimization** (all agents + skills always loaded): ~400K+ tokens per turn — unusable.

---

## 2. Prompt Caching Architecture

Both Anthropic (Claude) and OpenAI (GPT) implement prefix-based prompt caching. Static, stable content at the beginning of prompts receives a **~90% token cost discount** on repeated turns.

### How Caching Works

**Anthropic Claude:**

- Cache key = exact token prefix up to each cache checkpoint
- Minimum cacheable block: **1,024–4,096 tokens** (model-dependent)
- Cache TTL: **5 minutes**, refreshed on use
- 90% cost reduction on cache hits
- Cache invalidates when system prompt, tool list, or preceding messages change

**OpenAI GPT:**

- Automatic prefix caching — no configuration required
- Minimum cacheable prefix: **1,024 tokens**
- Cache hits: up to **90% cost reduction**, **80% latency reduction**
- Invalidates when prefix changes

### What Enables Cache Hits

```
Turn 1:  [system prompt][tools][user message 1]
Turn 2:  [system prompt][tools][user message 1][assistant 1][user message 2]
                ↑               ↑
         cached prefix    cached prefix (extended)
```

The system prompt and tools list must be **identical** across turns for the prefix to cache. Any change — even adding a space — invalidates the cache.

### What Breaks Caching

| Change                                             | Effect                        |
| -------------------------------------------------- | ----------------------------- |
| Editing `copilot-instructions.md` during a session | Full cache invalidation       |
| Dynamic content in instructions (dates, usernames) | Never caches                  |
| Changing active agent mid-session                  | New system prompt = new cache |
| Adding/removing `applyTo` files during session     | Potential invalidation        |
| Reordering tools list                              | Full invalidation             |

### Sizing for Cache Breakpoints

To guarantee a cache hit, your stable prefix must exceed the minimum block size:

```
Anthropic minimum: ~4,096 tokens = ~16,384 characters ≈ 16 KB
OpenAI minimum:    ~1,024 tokens =  ~4,096 characters ≈  4 KB
```

**Practical targets:**

- Keep `copilot-instructions.md` stable and under 4 KB
- Agent body + system prompt should comfortably exceed 4 KB to hit the cache breakpoint
- Never embed dynamic data (timestamps, branch names) in instructions files

---

## 3. Downstream Configuration Patterns

### 3.1 Structure `copilot-instructions.md` for Cache Efficiency

The golden rule: **stable content first, dynamic content last (or nowhere)**.

```markdown
<!-- .github/copilot-instructions.md — optimized template -->

# Project: MyApp

## Stack

- Backend: Node.js 22, Fastify 5, PostgreSQL 16
- Frontend: React 19, TypeScript 5.5, Vite 6
- Testing: Vitest, Playwright
- Deploy: Docker, Railway

## Conventions

- Use named exports only (no default exports)
- Prefer `async/await` over `.then()` chains
- All DB queries go through the repository layer in `src/db/`
- Environment variables accessed only through `src/config.ts`

## File Structure

src/
api/ # Fastify route handlers
db/ # Repository layer + migrations
services/ # Business logic (no HTTP, no DB)
config.ts # Environment + config

## Code Style

- 2-space indent, single quotes, no semicolons
- Max line length: 100 characters
- Errors: throw typed errors, catch at route handler boundary
```

**What to omit from `copilot-instructions.md`:**

- Testing conventions → put in `tests/**/*.instructions.md` with `applyTo`
- Framework-specific rules → let agents/skills handle this
- Documentation requirements → scope to relevant globs
- Anything that changes per-PR or per-branch

### 3.2 Use `applyTo`-Scoped Files for Conditional Context

Instead of packing everything into the always-on file, split by concern:

```markdown
## <!-- .github/instructions/testing.instructions.md -->

## applyTo: "**/\*.test.ts,**/\*.spec.ts,tests/\*\*"

## Testing Standards

- Use `describe`/`it` blocks, not `test()`
- Every public function needs a unit test
- Integration tests go in `tests/integration/`
- Mock external services with `vi.mock()`
- Database tests use the `testDb` fixture from `tests/helpers/db.ts`
```

```markdown
## <!-- .github/instructions/api-routes.instructions.md -->

## applyTo: "src/api/\*\*"

## API Route Conventions

- Validate all inputs with Zod schemas defined in `src/schemas/`
- Return errors as `{ error: string, code: string }`
- Log at entry and exit of each handler
- Authentication via `fastify.authenticate` preHandler
```

```markdown
## <!-- .github/instructions/database.instructions.md -->

## applyTo: "src/db/**,**/migrations/\*\*"

## Database Conventions

- Migrations use sequential timestamps: `YYYYMMDD_HHMMSS_description.sql`
- Never modify existing migrations — create new ones
- Use parameterized queries only — no string interpolation
- Repository methods return domain objects, not raw DB rows
```

**Token savings from scoping:**

| Approach                                | Tokens Always Loaded                 |
| --------------------------------------- | ------------------------------------ |
| Everything in `copilot-instructions.md` | ~3,000 tokens constant               |
| Split with `applyTo` globs              | ~500 tokens constant + ~500 on match |
| Savings when outside test files         | ~2,500 tokens per turn               |

### 3.3 Sizing Instructions Files

Use these thresholds as guidelines:

| File                           | Target Size | Max      | Notes                             |
| ------------------------------ | ----------- | -------- | --------------------------------- |
| `copilot-instructions.md`      | ≤ 2 KB      | 4 KB     | Every token here costs every turn |
| Per-domain `*.instructions.md` | ≤ 4 KB      | 8 KB     | Loaded only on file match         |
| Agent body                     | 2–6 KB      | 10 KB    | Loaded per session, not per turn  |
| Skill `SKILL.md` (body)        | 4–16 KB     | 24 KB    | Loaded once per skill invocation  |
| Skill reference files          | 4–40 KB     | uncapped | Lazy-loaded on explicit read      |

### 3.4 Reduce Footprint with `excludeAgents` / `excludeSkills`

The agent-repo syncs **all** agents and skills by default. Exclude what your project doesn't use in `.copilot-deps.json`:

```json
{
  "source": "github:your-org/agent-repo",
  "excludeAgents": [
    "app-store-deployment-expert",
    "ci-monitor-subagent",
    "product-owner"
  ],
  "excludeSkills": [
    "android-kotlin-pro",
    "swiftui-pro",
    "flutter-pro",
    "pocketbase-pro"
  ]
}
```

**Why this matters for tokens:**

- Excluded agents never appear on disk → cannot be loaded
- Excluded skills eliminate their frontmatter from the discovery scan
- For a pure web project, excluding 8–10 mobile/embedded skills saves ~3,200 tokens of scan overhead per session

**Discovery scan cost (kept skills):**

```
32 skills × ~300 bytes frontmatter = ~9,600 bytes = ~2,400 tokens
20 skills × ~300 bytes frontmatter = ~6,000 bytes = ~1,500 tokens
                                      Savings: ~900 tokens per session
```

---

## 4. Agent Design Patterns for Token Efficiency

### 4.1 Body Size Budgets

| Agent Role         | Recommended Body | Max Body | Rationale                                  |
| ------------------ | ---------------- | -------- | ------------------------------------------ |
| Orchestrator (RUG) | 8–12 KB          | 16 KB    | Routing logic is complex; justify the cost |
| Domain specialist  | 3–6 KB           | 8 KB     | Role + constraints + output format         |
| Reviewer / auditor | 4–8 KB           | 12 KB    | Checklist-style agents need coverage       |
| Simple utility     | 1–3 KB           | 4 KB     | Single-purpose agents stay lean            |

### 4.2 Skill Progressive Loading as the Preferred Pattern

This repo's skill system implements three-stage loading by design. Use it — don't fight it.

**Stage 1: Frontmatter only (discovery)**

```yaml
---
name: postgres-pro
description: >-
  Comprehensively reviews PostgreSQL code for best practices on schema design,
  query optimization, indexing, partitioning, RLS, and PL/pgSQL. USE WHEN
  reading, writing, or reviewing SQL schemas, migrations, or queries.
  DO NOT USE FOR: Supabase-specific patterns, ORM-specific code.
---
```

Cost: ~75 tokens. Loaded for every session to enable routing.

**Stage 2: SKILL.md body (on invocation)**
The review process, core rules, and quick-reference tables. Cost: ~2,000–4,000 tokens. Loaded once when the skill is triggered.

**Stage 3: Reference files (explicit read)**
Deep topic files like `references/query-optimization.md`, `references/security.md`. Cost: ~1,000–8,000 tokens each. Loaded only when the agent reads them.

**Agent instruction pattern to enable this:**

```markdown
## Skills

When working on PostgreSQL, schema migrations, or SQL queries, load the
`postgres-pro` skill and follow its review process. Read reference files
from `.github/skills/postgres-pro/references/` only when needed for the
specific topic at hand.
```

### 4.3 Inline vs. Reference — Decision Table

| Content Type                        | Inline in Agent Body | Move to Skill/Reference |
| ----------------------------------- | -------------------- | ----------------------- |
| Role definition                     | ✅ Always            | —                       |
| Output format                       | ✅ 3–5 lines         | —                       |
| Decision tree (≤ 10 nodes)          | ✅ Justified         | —                       |
| Comprehensive checklist (20+ items) | ❌ Too heavy         | ✅ Skill body           |
| Framework-specific rules            | ❌ Stale fast        | ✅ Skill reference      |
| Code examples (3+)                  | ❌ Token heavy       | ✅ Skill reference      |
| Error taxonomy                      | ❌ Grows over time   | ✅ Skill reference      |
| Quick routing table                 | ✅ If ≤ 15 rows      | ❌ If growing           |

### 4.4 Deduplication Strategies

**Problem:** Multiple agents repeating the same conventions.

**Solution: Shared skill reference**

Instead of each agent including output format instructions:

```markdown
<!-- In each agent body — BAD: duplicated -->

## Output Format

- Use bullet points for lists
- Wrap code in fenced blocks with language tags
- Lead with the most important finding
- Maximum 3 recommendations per section
```

Create a shared reference:

```markdown
<!-- .github/skills/shared/references/output-format.md -->

# Standard Output Format

...
```

And reference it from each skill:

```markdown
<!-- In SKILL.md body -->

See `references/output-format.md` for the standard output format.
```

**Problem:** `copilot-instructions.md` and agent bodies overlap.

**Rule:** If a convention appears in `copilot-instructions.md`, agents must not repeat it. Agents should state: _"Follow the project conventions in `.github/copilot-instructions.md`"_ — not re-list them.

---

## 5. Testing Documentation Pattern

Test-related context is often the heaviest per-domain investment. It's also the most frequently wasted — loaded even when editing UI components.

### 5.1 Scope Testing Docs to Test Files

```markdown
## <!-- .github/instructions/unit-tests.instructions.md -->

## applyTo: "**/\*.test.ts,**/\*.spec.ts"

## Unit Test Standards

- One `describe` block per module
- Test file mirrors source path: `src/services/auth.ts` → `tests/unit/services/auth.test.ts`
- Use `vi.mock()` for all external dependencies
- Assert on behavior, not implementation details
- Prefer `toEqual` over `toBe` for object comparisons
```

```markdown
## <!-- .github/instructions/e2e-tests.instructions.md -->

## applyTo: "tests/e2e/**,playwright/**"

## E2E Test Standards

- Page Object Model — one file per page in `tests/e2e/pages/`
- Use `data-testid` attributes, never CSS selectors or text
- Each test must be independent — no shared state between tests
- Seed DB via API, not direct DB access
- Run with: `npx playwright test`
```

**Token savings:** Testing instructions (~1,500 tokens) only load when a test file is open. Zero cost when editing source files.

### 5.2 Layered Documentation Strategy

```
Layer 1: copilot-instructions.md       ← Always on, ~500 tokens
         "Tests live in tests/, run with npm test"

Layer 2: tests/**/*.instructions.md    ← On test file open, ~1,000 tokens
         "Vitest conventions, mock patterns, fixture usage"

Layer 3: Skill body (xunit-v3-pro)     ← On skill invoke, ~3,000 tokens
         "Full xUnit v3 API reference, fixture patterns"

Layer 4: Skill references/*.md         ← On explicit read, ~2,000 tokens each
         "Migration guide v2→v3, parameterized tests deep-dive"
```

Each layer adds cost only when its trigger is met. Layer 1 cost is constant; Layers 3–4 are near-zero for most sessions.

### 5.3 Architecture & Design Docs

Architecture decision records and design docs are high-value but rarely needed mid-task.

```markdown
## <!-- .github/instructions/adr.instructions.md -->

## applyTo: "docs/adr/**,docs/architecture/**"

## Architecture Decision Records

- ADRs use MADR format (see docs/adr/README.md)
- Status: Proposed → Accepted → Deprecated → Superseded
- Every significant technical decision needs an ADR
- Reference ADRs from code with: `// See: docs/adr/0012-use-repository-pattern.md`
```

This pattern ensures architecture context is available exactly when editing architectural documents — and nowhere else.

---

## 6. Measurement & Monitoring

### 6.0 Run the token audit

VS Code does not record token counts, so `token-audit.mjs` reconstructs an estimate from the
local session store using GitHub's Effective Tokens model:

$$ET = m \times (1.0 \times I + 0.1 \times C + 4.0 \times O)$$

where $m$ is the model multiplier (Haiku 0.25, Sonnet 1.0, Opus 5.0), $I$ is fresh input,
$C$ is cached input, and $O$ is output. Output carries 4× weight because it is the most
expensive token type; cache reads carry 0.1× because they are billed at roughly a tenth of
fresh input.

```sh
node token-audit.mjs                 # last 30 days, Sonnet pricing
node token-audit.mjs --days 7
node token-audit.mjs --model opus    # what the same workload costs at Opus rates
node token-audit.mjs --base 20000    # tune the fixed per-session overhead estimate
```

It reports the most expensive sessions, a per-repository breakdown, and two findings that
drive most waste: cost concentrated in long threads, and cost concentrated in output volume.

**Requires** `github.copilot.chat.localIndex.enabled` in VS Code settings.

**Read it correctly — the `--base` value dominates short sessions.** `--base` is the fixed
per-session overhead: system prompt + agent body + skill discovery block + tool schemas. It is
charged as fresh input on turn one, then as a cache read on every later turn. If most of your
sessions are 1–3 turns, this fixed cost is the majority of your spend, and the highest-value
optimizations are **trimming agent bodies and pruning skills** — not managing conversation
length. If most of your sessions are long, the reverse is true and thread hygiene matters more.

Check which regime you are in before optimizing:

```sh
node token-audit.mjs --base 5000     # compare the totals
node token-audit.mjs --base 20000    # a big gap means fixed overhead dominates
```

### 6.0.1 Ground truth

The audit script is an estimate for spotting trends and outliers. For actual billed usage:

- **<https://github.com/settings/billing>** → "AI usage" — real credits, by feature and model
- **`/chronicle cost-tips`** in Copilot CLI — built-in analysis of your own session history

Full per-request instrumentation (what GitHub built internally) requires an API proxy in front
of the model calls. That is practical in CI, not on a desktop IDE — so treat the billing
dashboard as truth and the audit script as your early-warning signal.

### 6.1 Estimating Your Token Budget

Quick estimation from file sizes:

```bash
# Estimate tokens for all always-on files
wc -c .github/copilot-instructions.md | awk '{print $1/4 " tokens"}'

# Estimate a specific agent's session cost
wc -c .github/agents/my-agent.agent.md | awk '{print $1/4 " tokens"}'

# Estimate total skill discovery overhead (frontmatter only ≈ 15% of file)
find .github/skills -name "SKILL.md" -exec wc -c {} + | \
  tail -1 | awk '{print $1 * 0.15 / 4 " tokens (approx)"}'

# Total footprint of synced skills
du -sh .github/skills/
```

### 6.2 Budget Targets by Repo Type

| Repo Type             | `copilot-instructions.md` | Per-Session Agent Budget | Total Target    |
| --------------------- | ------------------------- | ------------------------ | --------------- |
| Solo project          | ≤ 500 tokens              | ≤ 5,000 tokens           | ≤ 8,000 tokens  |
| Small team (2–5)      | ≤ 1,000 tokens            | ≤ 8,000 tokens           | ≤ 15,000 tokens |
| Mid-size team (5–20)  | ≤ 2,000 tokens            | ≤ 12,000 tokens          | ≤ 25,000 tokens |
| Enterprise / monorepo | ≤ 4,000 tokens            | ≤ 20,000 tokens          | ≤ 40,000 tokens |

### 6.3 Warning Signs

Watch for these patterns that indicate token bloat:

- `copilot-instructions.md` exceeds 8 KB — move domain content to scoped files
- A single `*.instructions.md` file without `applyTo` — it never auto-loads; was this intentional?
- Agent body exceeds 16 KB — decompose into agent + skill
- Skill `SKILL.md` body embeds multiple code examples — move to `references/`
- Same convention repeated in 3+ files — create a single source of truth
- Dynamic content (today's date, current user) anywhere in instructions — cache killer

### 6.4 Cache Efficiency Check

To verify your instructions are cache-eligible:

1. Count characters in your stable prefix (system prompt + tools + first user turn)
2. Divide by 4 for token estimate
3. Check against breakpoints: Anthropic needs ≥ 4,096 tokens; OpenAI needs ≥ 1,024 tokens
4. Verify no dynamic content is inserted before the cacheable boundary

---

## 7. Recommended Downstream Template

A complete, cache-optimized `copilot-instructions.md` for a typical web API + frontend project:

```markdown
# Project: [Your Project Name]

## Tech Stack

- Backend: [runtime, framework, version]
- Frontend: [framework, version]
- Database: [engine, version]
- Testing: [test runner, e2e tool]
- CI/CD: [platform]

## Key Conventions

### Code Style

- [indent, quotes, semicolons — 1 line each]
- [naming convention — 1 line]
- [import order — 1 line]

### Project Structure

[Short tree of top-level src/ dirs with 1-line purpose each]

### Error Handling

- [Where errors are caught — 1 line]
- [Error format returned to clients — 1 line]

### Environment & Config

- [How env vars are accessed — 1 line]
- [Config file location — 1 line]

## What Lives Where

| Concern        | Location      |
| -------------- | ------------- |
| Route handlers | src/api/      |
| Business logic | src/services/ |
| DB queries     | src/db/       |
| Shared types   | src/types/    |
| Tests          | tests/        |

## Running the Project

- Dev: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
```

**Companion scoped files** to create alongside this template:

```
.github/instructions/
  testing.instructions.md        applyTo: "**/*.test.*,tests/**"
  database.instructions.md       applyTo: "src/db/**,**/migrations/**"
  api.instructions.md            applyTo: "src/api/**,src/routes/**"
  frontend.instructions.md       applyTo: "src/components/**,src/pages/**"
```

**Companion `.copilot-deps.json`** (exclude irrelevant skills):

```json
{
  "source": "github:your-org/agent-repo",
  "excludeAgents": [],
  "excludeSkills": [
    "android-kotlin-pro",
    "swiftui-pro",
    "flutter-pro",
    "mobile-uiux-pro"
  ]
}
```

This configuration delivers:

| What                               | Token Cost               |
| ---------------------------------- | ------------------------ |
| `copilot-instructions.md` (always) | ~400 tokens              |
| Active agent session               | ~5,000–10,000 tokens     |
| Scoped instructions (when matched) | ~500–1,000 tokens        |
| Skill body (when invoked)          | ~2,000–4,000 tokens      |
| **Typical turn total**             | **~6,000–15,000 tokens** |

Compared to an unoptimized setup loading all context always: **75–95% reduction in token spend**.

---

## Appendix: How This Repo Already Implements Best Practices

The agent-repo's own architecture demonstrates these patterns:

| Pattern                      | Implementation                                                          |
| ---------------------------- | ----------------------------------------------------------------------- |
| Progressive skill loading    | 3-stage: frontmatter → SKILL.md body → references/\*.md                 |
| Domain isolation             | Each skill is a directory; references are topic files                   |
| Exclude-by-default mindset   | `sync.mjs` supports `excludeAgents`/`excludeSkills`                     |
| Lean agent bodies            | Agents reference skills rather than duplicating domain knowledge        |
| Stable instruction structure | Frontmatter is static YAML; no dynamic content                          |
| Separation of concerns       | `copilot-instructions.md` stays minimal; agents handle domain specifics |

When building your own skills and agents in a consuming repo, follow the same patterns your agents already teach.
