# Pre-Computed Codebase Graphs

Stop paying an LLM to re-learn your codebase every session.

## Why this saves credits

When an agent "gets oriented" in an unfamiliar repo, it reads 20–40 files to build a mental
model of the structure. That model is discarded when the session ends, then rebuilt from
scratch next time — at full input-token price, every time.

A graph moves that work **out of the LLM loop**. You extract the structure once,
deterministically, and agents read a small artifact instead of a large pile of source.

This is the same pattern GitHub used to cut one of their workflows by 62%: the biggest win
came from replacing agent turns that were pure data-gathering with pre-computed files.

| Approach                                  | Cost per session       |
| ----------------------------------------- | ---------------------- |
| Agent reads 30 files to orient            | ~40,000 input tokens   |
| Agent reads a graph wiki article          | ~1,500 input tokens    |
| Agent runs `graphify query --budget 1500` | ~1,500 tokens, bounded |

---

## Step 1 — Build the graph (once per repo, ~5–15 min)

From the repo root:

```bash
graphify . --wiki
```

This produces `graphify-out/`:

| Output            | What it is                                      | Who reads it            |
| ----------------- | ----------------------------------------------- | ----------------------- |
| `wiki/`           | `index.md` + one article per detected community | **Agents** — start here |
| `GRAPH_REPORT.md` | Plain-language summary of the whole codebase    | You, and agents         |
| `graph.json`      | GraphRAG-ready nodes and edges                  | `graphify query`        |
| `graph.html`      | Interactive visual                              | You                     |

`--wiki` is the flag that matters for agents. It emits crawlable Markdown, so an agent can
read one article about the module it cares about instead of the whole repo.

For a large or gnarly repo, add `--mode deep` for richer relationship extraction. It is slower
and costs more up front, but you pay it once.

```bash
graphify . --wiki --mode deep
```

---

## Step 2 — Decide: commit it or ignore it

**Commit it** (recommended for team repos):

```gitignore
# .gitignore — keep the artifacts agents read, drop the heavy ones
graphify-out/graph.html
graphify-out/*.svg
```

Everyone on the team — and every agent, in every clone — gets the map for free. The wiki is
Markdown, so it diffs readably in PRs and you can see structural drift.

**Ignore it entirely** (solo repos, or if `graph.json` is large):

```gitignore
graphify-out/
```

Then each developer builds locally. Cheaper in repo size, but agents in fresh clones and CI
get no benefit.

---

## Step 3 — Tell your agents it exists

An artifact nobody reads saves nothing. Wire it in at two places.

**A. Repo instructions** — add to `.github/copilot-instructions.md`:

```markdown
## Codebase Map

Before reading source files to understand structure, read `graphify-out/wiki/index.md`
and the relevant community article. Do not read more than 5 source files to answer a
structural question — query the graph instead:

    graphify query "how does order import handle retries" --budget 1500

Read source only when you need exact implementation detail, not for orientation.
```

**B. RUG cost policy** — in `.github/skills/local-routing/SKILL.md` under `## Cost Policy`:

```yaml
codebaseGraph: graphify-out/wiki/index.md
```

RUG reads the artifact instead of dispatching an ingestion pass.

The `--budget` flag is the important one. It caps the answer at N tokens, which turns an
open-ended "go understand this" into a bounded, predictable cost.

---

## Step 4 — Keep it current

A stale graph is worse than none — agents will confidently act on a map that no longer
matches the code.

**Manual refresh** (incremental, only re-extracts changed files — seconds, not minutes):

```bash
graphify . --update --wiki
```

**Automatic, while you work:**

```bash
graphify . --watch
```

Watch mode rebuilds on file changes and needs no LLM calls, so it is free to leave running.

**Automatic, in CI** — refresh weekly and on merges to main:

```yaml
# .github/workflows/codebase-graph.yml
name: Refresh codebase graph
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1' # Mondays 06:00 UTC
  workflow_dispatch:

jobs:
  graph:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv tool install graphifyy
      - run: graphify . --update --wiki
      - name: Commit refreshed graph
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add graphify-out/
          git diff --staged --quiet || git commit -m "chore: refresh codebase graph"
          git push
```

Pin the graph refresh to merges rather than every push — rebuilding on every branch commit
creates noise without adding accuracy.

---

## Step 5 (optional) — Expose it as an MCP server

Instead of agents shelling out to the CLI, serve the graph as tools:

```bash
graphify . --mcp
```

**Only do this if you will actually use it.** Every registered MCP tool adds its JSON schema
to _every_ request in the session. GitHub found unused MCP tools were the single most common
inefficiency they measured — a server with 40 tools adds 10–15 KB per turn whether you call
it or not. The CLI has no such overhead because it costs nothing until invoked.

Rule of thumb: CLI by default, MCP only when agents query the graph many times per session.

---

## Useful queries

```bash
graphify query "what calls OrderImportService" --budget 1500
graphify path "OrderController" "SqlOrderRepository"   # shortest path between two concepts
graphify explain "GpasClient"                          # plain-language node explanation
graphify query "trace the flow from ingress to persistence" --dfs
```

`query` defaults to BFS (broad context); `--dfs` traces one specific path. Use `--budget` on
anything an agent runs unattended.

---

## Rollout order

Do not graph all 13 repos at once. Start where the pain is:

1. Pick the repo where agents most often flail or over-read.
2. `graphify . --wiki` — inspect `GRAPH_REPORT.md` and sanity-check that it matches reality.
3. Add the copilot-instructions block from Step 3A.
4. Work in that repo for a week. Compare session lengths before and after.
5. If it helps, roll out to the next two repos and add the CI refresh.

Graphs pay off most in large, unfamiliar, or high-churn repos. A small service you know cold
will not benefit much — skip those.
