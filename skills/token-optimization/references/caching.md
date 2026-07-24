# Prompt Caching Architecture

Deep-dive on prefix-based caching for Anthropic Claude and OpenAI GPT, plus design patterns to maximize cache hit rates.

## How Prefix Caching Works

Both providers cache the **exact token prefix** of prompts. If two consecutive requests share an identical beginning, the shared portion is served from cache at dramatically reduced cost.

```
Turn 1:  [system prompt][tools][user message 1]
Turn 2:  [system prompt][tools][user message 1][assistant 1][user message 2]
                ↑               ↑
         cached prefix    cached prefix (extended)
```

### Anthropic Claude Specifics

- Cache key = exact token prefix up to each checkpoint
- Minimum cacheable block: **1,024–4,096 tokens** (model-dependent)
- Cache TTL: **5 minutes**, refreshed on each use
- **90% cost reduction** on cache hits
- Invalidates when system prompt, tool list, or preceding messages change

### OpenAI GPT Specifics

- Automatic prefix caching — no configuration required
- Minimum cacheable prefix: **1,024 tokens**
- Cache hits: up to **90% cost reduction**, **80% latency reduction**
- Invalidates when any part of the prefix changes

## Design Rules for Cache Efficiency

### Rule 1: Stable Content First

Structure instructions so the most stable content appears earliest in the prompt:

```
GOOD (cache-friendly):
  [static system prompt]     ← cached after first turn
  [static tools list]        ← cached
  [static agent instructions]← cached
  [conversation history]     ← cached incrementally
  [new user message]         ← only uncached part

BAD (cache-hostile):
  [dynamic date/time]        ← invalidates everything after it
  [system prompt]            ← never cached (preceded by dynamic content)
  ...
```

### Rule 2: Never Embed Dynamic Content in Instructions

These break caching completely:

- Current date/time stamps
- Current branch name
- Current user's name
- PR number or ticket ID
- Any value that changes between sessions

If this context is needed, the user provides it in their message (which is at the END of the prefix, not embedded in the static system prompt).

### Rule 3: Size Thresholds for Cache Eligibility

Content must exceed the minimum cacheable block size:

| Provider | Minimum       | In Characters | Practical Rule                                      |
| -------- | ------------- | ------------- | --------------------------------------------------- |
| Claude   | ~4,096 tokens | ~16,384 chars | Agent body should be ≥ 16 KB for guaranteed caching |
| GPT      | ~1,024 tokens | ~4,096 chars  | Agent body should be ≥ 4 KB for guaranteed caching  |

**Implication for small agents**: An agent with a 1 KB body won't cache independently on Claude. The system prompt + tools list + agent body combined need to exceed 16 KB. This is usually met by the system prompt alone, but be aware.

### Rule 4: Tool Lists Must Be Stable

The tools array is part of the cached prefix. Any reordering or modification invalidates the entire cache.

- **Don't** dynamically add/remove tools mid-session
- **Don't** reorder tools between requests
- **Do** define a complete, stable tools list in the agent frontmatter

### Rule 5: Agent Switching Invalidates Cache

When a user switches from one agent to another, the system prompt changes entirely — no cache hit possible. This is acceptable but has cost implications:

- Encourage users to stay within one agent for a session
- RUG orchestration (with subagents) maintains its own stable prefix across the session
- Each subagent invocation starts a fresh cache anyway

## Agent Body Sizing Strategy

Given the caching architecture, agent body size has two competing pressures:

| Pressure            | Direction                    | Reason                            |
| ------------------- | ---------------------------- | --------------------------------- |
| Token cost per turn | Smaller is cheaper           | Less context = fewer tokens       |
| Cache efficiency    | Larger hits cache breakpoint | Must exceed minimum block         |
| Comprehensiveness   | Larger covers more           | More instructions = better output |

**Sweet spot**: 4–8 KB for specialist agents (guaranteed to cache on both providers), 8–16 KB for orchestrators (justified by routing complexity).

## Instruction File Impact on Caching

| File Type                     | Cache Impact                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `copilot-instructions.md`     | Part of system prompt — always in cached prefix                                |
| `applyTo` scoped instructions | Only loaded when file matches — may alter prefix if file is opened mid-session |
| Agent body                    | Loaded once when agent selected — stable for session duration                  |
| Skill content                 | Loaded dynamically — NOT in the cached prefix; appears in conversation context |

**Key insight**: Skills loaded via `read_file` appear in the conversation, not the system prompt. They extend the cache prefix incrementally (good) but are not part of the initial stable prefix.

## Cost Optimization Hierarchy

Ranked by impact (highest first):

1. **Keep always-on instructions minimal** — ≤ 4 KB; saves tokens EVERY turn
2. **Use model tiering** — Tier 3 for execution tasks; 10–30× cheaper per task
3. **Scope instructions with `applyTo`** — Pay only when relevant files are open
4. **Exclude unused skills** — Reduces discovery scan overhead
5. **Compress subagent prompts** — Reference files instead of pasting content
6. **Avoid agent switching** — Maintains cache hits within a session
7. **Batch related tasks** — One 2,000-token prompt beats three 1,000-token prompts (less overhead)
