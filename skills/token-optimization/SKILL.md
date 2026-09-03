---
name: token-optimization
description: >-
  Token budget management, model selection strategy, prompt caching architecture,
  and cost-efficiency patterns for AI agent orchestration. Guides orchestrators on
  when to use expensive vs. cheap models, how to size prompts for cache efficiency,
  and how to minimize per-turn token spend. USE WHEN orchestrating multi-agent
  workflows, selecting models for subagents, designing instruction files, or
  optimizing agent/skill file sizes. DO NOT USE FOR: application code optimization,
  runtime performance tuning, or non-AI cost concerns.
---

# Token Optimization

Minimize token spend while preserving agent effectiveness. This skill provides decision frameworks for model selection, prompt sizing, caching, and progressive context loading.

## Core Principles

1. **Expensive models for ambiguity; cheap models for execution.** When the plan is clear and acceptance criteria are concrete, use the cheapest model that can follow structured instructions.
2. **Context is cost.** Every byte loaded into a prompt costs tokens. Load lazily — frontmatter first, body on match, references on demand.
3. **Stable prefixes enable caching.** Keep system prompts static and identical across turns for 90% cost reduction on repeated content.
4. **Scope aggressively.** Use `applyTo` globs so instructions load only when relevant files are open.
5. **Deduplication saves compounding cost.** A rule repeated in 5 agents costs 5× per session. Centralize in a skill, reference from agents.

## Model Selection Framework

Use this decision table when an orchestrator selects which model to assign to a subagent task:

### Model Tiers

| Tier                   | Model Class         | Cost | When to Use                                                                                                     |
| ---------------------- | ------------------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| **Tier 1 — Reasoning** | Opus / o1 / o3      | $$$  | Ambiguous requirements, novel architecture, complex debugging with no clear root cause                          |
| **Tier 2 — Balanced**  | Sonnet / GPT-4o     | $$   | Multi-file implementation with design decisions, code review, refactoring with judgment calls                   |
| **Tier 3 — Execution** | Haiku / GPT-4o-mini | $    | Well-specified single-file tasks, mechanical edits, test writing from clear specs, file creation from templates |

> **Tiers are model classes, not agent names.** An agent's model is fixed in its frontmatter, so
> a tier that has no dedicated agent is reached by passing a `model` override on the `runSubagent`
> call — e.g. dispatch the Tier 2 agent with an Opus model to get Tier 1 behaviour. Do not invent
> agent names like `"Agent (Opus)"`; the dispatch will fail.

### Decision Criteria for Tier 3 (Cheap Model) Eligibility

A task qualifies for Tier 3 when **ALL** of these are true:

- [ ] **Scope is explicit** — exact files, functions, or locations are specified
- [ ] **Pattern exists** — similar code already in the codebase to follow
- [ ] **No design decisions** — implementation path is prescribed, not open-ended
- [ ] **Acceptance criteria are concrete** — verifiable without judgment (tests pass, type-checks, matches spec)
- [ ] **Single concern** — task does ONE thing (one file, one function, one test suite)

If ANY criterion is unmet, escalate to Tier 2.

### Decision Criteria for Tier 1 (Expensive Model) Eligibility

Escalate to Tier 1 when ANY of these are true:

- Requirement is ambiguous — multiple valid interpretations exist
- No existing pattern to follow — novel architecture or design
- Cross-system debugging — root cause spans multiple layers
- Trade-off analysis required — choosing between competing approaches
- Safety-critical — security, auth, data integrity implications

### Orchestrator Model Selection Protocol

When decomposing tasks, the orchestrator should:

1. **Plan with Tier 2** — Use balanced model for planning/decomposition subagents
2. **Tag each task with a tier** — Based on the decision criteria above
3. **Dispatch at the tagged tier** — Use the `model` parameter in subagent prompts when available
4. **Validate with Tier 3** — Simple pass/fail validation (file exists, tests pass) can use cheap models
5. **Escalate on failure** — If a Tier 3 subagent fails validation, retry with Tier 2

## Token Budget Model

### Context Loading Layers

| Source                             | When Loaded                  | Approx. Cost              | Optimization             |
| ---------------------------------- | ---------------------------- | ------------------------- | ------------------------ |
| `copilot-instructions.md`          | Always — every request       | ≤ 1K tokens               | Ruthlessly prune; ≤ 4 KB |
| `*.instructions.md` with `applyTo` | Conditional — file match     | ~250–500 tokens each      | Scope tightly            |
| Agent `.agent.md` body             | Per-session — agent selected | ~500–2,000 tokens         | Keep ≤ 8 KB              |
| Skill `SKILL.md` frontmatter       | Discovery — all scanned      | ~50–100 tokens each       | Cheap; description only  |
| Skill `SKILL.md` body              | On invocation                | ~1,000–5,000 tokens       | Load once per session    |
| Skill `references/*.md`            | Explicit read only           | ~1,000–10,000 tokens each | Zero cost until needed   |

### Budget Targets

| Repo Type    | Always-On    | Per-Session | Peak (with skill) |
| ------------ | ------------ | ----------- | ----------------- |
| Solo project | ≤ 500 tokens | ≤ 5,000     | ≤ 8,000           |
| Small team   | ≤ 1,000      | ≤ 8,000     | ≤ 15,000          |
| Enterprise   | ≤ 4,000      | ≤ 20,000    | ≤ 40,000          |

## Prompt Caching Rules

### What Enables Cache Hits (90% cost reduction)

- System prompt identical across turns
- Tools list unchanged
- No dynamic content (dates, usernames, branch names) in instructions
- Agent body static within a session

### What Breaks Caching

- Editing `copilot-instructions.md` during a session
- Embedding timestamps or branch names in instructions
- Changing active agent mid-session
- Reordering tools list

### Sizing for Cache Breakpoints

- **Anthropic Claude**: Minimum cacheable block ~4,096 tokens (~16 KB)
- **OpenAI GPT**: Minimum cacheable prefix ~1,024 tokens (~4 KB)
- **Practical rule**: Agent body + system prompt should exceed 4 KB for guaranteed cache hits

## Subagent Prompt Efficiency

### Prompt Size Targets

| Subagent Purpose              | Target Prompt Size | Max   |
| ----------------------------- | ------------------ | ----- |
| Simple file creation          | ≤ 500 tokens       | 800   |
| Single-concern implementation | ≤ 1,000 tokens     | 1,500 |
| Multi-file implementation     | ≤ 2,000 tokens     | 3,000 |
| Planning / architecture       | ≤ 1,500 tokens     | 2,500 |
| Validation                    | ≤ 500 tokens       | 800   |

### Prompt Compression Techniques

1. **Reference, don't repeat** — Point subagents to files instead of pasting content
2. **Scope narrowly** — Name exact files and functions; don't describe the whole codebase
3. **Use acceptance criteria as spec** — Concrete criteria replace verbose explanations
4. **Skip context the subagent won't use** — Omit background if the task is mechanical
5. **Batch related edits** — One subagent touching 3 related functions beats 3 subagents with duplicated context

### Anti-Patterns

| Pattern                                    | Cost Impact               | Fix                                       |
| ------------------------------------------ | ------------------------- | ----------------------------------------- |
| Pasting full file contents in prompt       | +2,000–10,000 tokens      | Reference file path; let subagent read it |
| Repeating project conventions per subagent | +500 tokens × N subagents | Point to `copilot-instructions.md`        |
| Verbose "context" sections                 | +500–1,000 tokens         | State the task; omit history              |
| Redundant skill content in agent body      | Compounding per session   | Keep in skill; reference from agent       |
| Loading all reference files preemptively   | +5,000–40,000 tokens      | Load on demand per topic                  |

## File Sizing Guidelines

| File Type                    | Target  | Max      | Action if Exceeded                  |
| ---------------------------- | ------- | -------- | ----------------------------------- |
| `copilot-instructions.md`    | ≤ 2 KB  | 4 KB     | Move domain content to scoped files |
| `*.instructions.md` (scoped) | ≤ 4 KB  | 8 KB     | Split by narrower glob              |
| Agent `.agent.md` body       | 2–6 KB  | 10 KB    | Extract to skill references         |
| Skill `SKILL.md` body        | 4–16 KB | 24 KB    | Move examples to references         |
| Skill reference files        | 4–40 KB | uncapped | Split by sub-topic if > 40 KB       |

## Exclude Unused Skills

Consumers should exclude irrelevant skills in `.copilot-deps.json`:

```json
{
  "excludeSkills": ["android-kotlin-pro", "swiftui-pro", "flutter-pro"]
}
```

Each excluded skill saves ~50–100 tokens of discovery scan overhead. For 10 excluded skills: ~500–1,000 tokens saved per session.

## Measurement

```bash
# Always-on cost
wc -c .github/copilot-instructions.md | awk '{print $1/4 " tokens"}'

# Agent session cost
wc -c .github/agents/my-agent.agent.md | awk '{print $1/4 " tokens"}'

# Total skill discovery overhead
find .github/skills -name "SKILL.md" -exec wc -c {} + | \
  tail -1 | awk '{print $1 * 0.15 / 4 " tokens (frontmatter approx)"}'
```
