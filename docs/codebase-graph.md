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

## Step 0 — Install graphify and make it reachable

graphify is a **standalone CLI**, not a project dependency. Install it with an isolated tool
installer so it is not coupled to any single project's interpreter:

```bash
uv tool install graphifyy       # preferred
pipx install graphifyy          # alternative
pip install --user graphifyy    # last resort
```

The package is `graphifyy`; the command is `graphify`. Confirm:

```bash
graphify --version
```

If that works, skip to Step 1.

### Troubleshooting `command not found`

Three causes, in the order worth checking.

#### 1. It is not installed, or went into an environment you are not in

Locate the binary:

```bash
# macOS / Linux
find "$HOME" -name 'graphify' -type f -perm -u+x 2>/dev/null | head
```

```powershell
# Windows PowerShell
Get-ChildItem $HOME -Filter graphify* -Recurse -ErrorAction SilentlyContinue |
  Select-Object -First 5 FullName
```

Nothing found → install it. Found → cause 2 or 3.

#### 2. It is installed, but its directory is not on your PATH

| Installer    | Typical bin directory                                                                      |
| ------------ | ------------------------------------------------------------------------------------------ |
| `uv tool`    | `~/.local/bin` · Windows: `%APPDATA%\uv\tools`                                             |
| `pipx`       | `~/.local/bin` · Windows: `%USERPROFILE%\.local\bin`                                       |
| `pip --user` | `~/.local/bin` · macOS: `~/Library/Python/<X.Y>/bin` · Windows: `%APPDATA%\Python\Scripts` |
| virtualenv   | `<venv>/bin` (`<venv>\Scripts` on Windows) — only while activated                          |

Easiest fix is to let the installer do it:

```bash
uv tool update-shell     # uv
pipx ensurepath          # pipx
```

Or add it yourself, matching your shell:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc   # bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc    # zsh
fish_add_path ~/.local/bin                                 # fish
```

```powershell
[Environment]::SetEnvironmentVariable(
  'Path', "$env:APPDATA\Python\Scripts;$env:Path", 'User')
```

Open a new terminal afterwards — PATH changes do not apply to running shells.

#### 3. A version-manager shim is shadowing it

This is the confusing one, because it looks intermittent — it fails in some directories and
works in others. Version managers (pyenv, asdf, conda, mise) insert shim directories early in
PATH. If graphify was installed under one interpreter version but a different version is
active, the shim intercepts the call and fails:

```
pyenv: graphify: command not found
The `graphify' command exists in these Python versions:
  3.13.2
```

Usefully, the error names the version that actually has it. The active version differs because
of a global setting, a directory-local pin (`.python-version`, `.tool-versions`), or an
activated environment.

Confirm a shim is winning — lower line number wins:

```bash
echo "$PATH" | tr ':' '\n' | grep -n -E 'shims|local/bin'
```

Three fixes, least invasive first:

| Fix                       | How                                                                      | Scope            |
| ------------------------- | ------------------------------------------------------------------------ | ---------------- |
| Alias the real binary     | below                                                                    | Zero risk        |
| Switch the active version | `pyenv shell <ver>` · `asdf shell python <ver>` · `conda activate <env>` | Current terminal |
| Change the default        | `pyenv global <ver>` · `asdf global python <ver>`                        | Whole machine    |

**Aliasing is recommended.** graphify has no reason to be bound to whichever interpreter your
current project uses, and an alias cannot break anything else on the machine:

```bash
# 1. Find the real path (pyenv shown; adapt for your manager)
ls "$(pyenv root)"/versions/*/bin/graphify

# 2. Alias it in your shell rc (~/.zshrc, ~/.bashrc, ~/.config/fish/config.fish)
echo "alias graphify='/full/path/from/step/1'" >> ~/.zshrc
source ~/.zshrc
```

Changing the global default is the most fragile option — anything relying on the previous
default interpreter silently starts using a different one. Prefer it only if the old default
is genuinely unused.

### Confirm before continuing

```bash
graphify --version
```

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

    graphify query "how does <subsystem> handle <behaviour>" --budget 1500

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
graphify query "what calls <ClassOrFunction>" --budget 1500
graphify path "<EntryPoint>" "<Dependency>"      # shortest path between two concepts
graphify explain "<SymbolName>"                  # plain-language node explanation
graphify query "trace the flow from <entry> to <store>" --dfs
```

`query` defaults to BFS (broad context); `--dfs` traces one specific path. Use `--budget` on
anything an agent runs unattended.

---

## Rollout order

Do not graph every repository at once. Start where the pain is:

1. Pick the repo where agents most often flail or over-read.
2. `graphify . --wiki` — inspect `GRAPH_REPORT.md` and sanity-check that it matches reality.
3. Add the copilot-instructions block from Step 3A.
4. Work in that repo for a week. Compare session lengths before and after.
5. If it helps, roll out to the next couple of repos and add the CI refresh.

Graphs pay off most in large, unfamiliar, or high-churn repos. A small service you know cold
will not benefit much — skip those.
