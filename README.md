# Copilot Deps Sync

Centralized distribution system for VS Code Copilot agent definitions and skills. The agent-repo is the single source of truth — consuming repos get everything by default and exclude what they do not need, with updates propagating automatically via GitHub Actions PRs.

## Architecture

```
┌─────────────────────┐       dispatch event        ┌──────────────────────┐
│                     │  ──────────────────────────▶ │  consumer-repo-1     │
│    agent-repo       │  ──────────────────────────▶ │  consumer-repo-2     │
│  (push to main)     │         ...                  │  consumer-repo-N     │
└─────────────────────┘                              └──────────┬───────────┘
                                                                │
                                                     runs sync.mjs, opens PR
                                                                │
                                                                ▼
                                                     ┌──────────────────────┐
                                                     │  PR: sync copilot    │
                                                     │  agents & skills     │
                                                     └──────────────────────┘
```

**What gets synced:**

- **Agents** — All source agents (from `agents/`) sync to `.github/agents/` in the consumer by default, except names listed in `excludeAgents`
- **Skills** — Only skills listed in the `skills` array sync; they are placed into `.github/skills/` in the consumer for Copilot discovery
- **Scaffold skills** — Auto-created from templates when required by an agent (never overwritten once they exist)
- **Instruction Templates** — Token-efficient `.instructions.md` templates synced to `instruction-templates/` (for reference/customization)
- **Instructions** — `.github/copilot-instructions.md` is **never** synced (repo-specific)
- **Docs** — `docs/` is **not** synced to consumers (your repo has its own docs); only mirrored in source-repo mode

> **Why are source files at root (`agents/`, `skills/`) instead of `.github/`?**
> Copilot auto-discovers agents from `.github/agents/` and skills from `.github/skills/`.
> Since this repo installs globally via `install.mjs`, keeping sources outside `.github/`
> avoids loading duplicates when working in this repo — only the global `~/.copilot` copies
> are active.

## Setup: Central Repo (one-time)

1. Create a **GitHub PAT** (classic or fine-grained) with `repo` scope on all consuming repos.
2. Add it as a repository secret named **`COPILOT_SYNC_PAT`** in this repo's Settings → Secrets → Actions.
3. Register consuming repos in `consumers.json`:

```json
{
  "repos": ["your-org/consumer-repo-1", "your-org/consumer-repo-2"]
}
```

## Global Install (recommended)

Instead of syncing agents and skills into every repo, install them **once** into
your home directory. They then apply across every workspace, with no per-repo
files to keep updated.

**Skills** use the open Agent Skills standard (agentskills.io), so they are
portable across GitHub Copilot (VS Code + Copilot CLI) and Claude Code.
**Agents** are authored in Copilot `.agent.md` format (YAML-array `tools`,
`handoffs`, subagent lists, VS Code tool names) which does not map to Claude's
sub-agent format, so agents install to the copilot target only.

### Why global?

- **No drift** — one update point; no per-repo sync PRs to chase.
- **Progressive loading** — all skills are installed, but only their `name` +
  `description` frontmatter is scanned for discovery. The agent loads a skill's
  body only when it matches the task, so installing everything is cheap.
- **Portable skills** — the same `~/.copilot` tree serves VS Code and Copilot
  CLI; add the `claude` target to also install skills into `~/.claude`.

### Install locations

| Type   | copilot target                 | claude target              |
| ------ | ------------------------------ | -------------------------- |
| Agents | `~/.copilot/agents/*.agent.md` | — (Copilot format only)    |
| Skills | `~/.copilot/skills/<name>/`    | `~/.claude/skills/<name>/` |

### Run it

From a clone of this repo:

```sh
node install.mjs                        # copilot target (VS Code + CLI)
node install.mjs --targets copilot,claude
node install.mjs --dry-run              # preview, write nothing
node install.mjs --skills-only          # or --agents-only
```

For team members, `install.sh` clones the source repo fresh and runs the
installer — announce an update and have everyone re-run it:

```sh
chmod +x install.sh
./install.sh --targets copilot,claude
```

The installer records what it wrote in a `.agent-repo-manifest.json` at each
target root, so re-running it **prunes** agents/skills that were removed upstream
without ever touching your own personal agents/skills. Pass `--no-prune` to keep
stale items.

### What stays per-repo

Global install covers agents and skills only. These remain in each repo by
design, because they are project-specific:

- `.github/copilot-instructions.md` — project stack and conventions
- `*.instructions.md` with `applyTo` — path-scoped rules for that codebase
- the `local-routing` scaffold skill — customized per repo

> **Note:** If you install skills to both `copilot` and `claude` targets, VS Code
> reads both trees and may show duplicate skills. Disable one set via the
> `chat.agentSkillsLocations` setting.

## Setup: Consuming Repo

### 1. Create `.copilot-deps.json`

```json
{
  "source": "your-org/agent-repo",
  "ref": "main",
  "excludeAgents": ["product-owner"],
  "skills": ["agent-builder", "docker-pro", "fastify-pro", "vue-pro"]
}
```

| Field           | Required | Description                                                    |
| --------------- | -------- | -------------------------------------------------------------- |
| `source`        | Yes      | GitHub `owner/repo` of the agent-repo                          |
| `ref`           | No       | Branch/tag to sync from (default: `main`)                      |
| `excludeAgents` | No       | Agent names to skip — all others sync by default               |
| `skills`        | No       | Skills to sync — only listed skills are copied (default: none) |

### 2. Copy `sync.sh` into the repo root

Copy `sync.sh` from this repo into the root of the consuming repo, make it executable, and commit it:

```sh
chmod +x sync.sh
git add sync.sh && git commit -m "chore: add copilot deps sync script"
```

### 3. Run initial sync

```sh
./sync.sh
```

The script reads `.copilot-deps.json`, clones the agent-repo at the configured ref, runs `sync.mjs`, then cleans up. No arguments needed — run it from the repo root.

### 4. (Optional) Add the GitHub Actions workflow

For automatic sync-on-push, copy `consumer-workflow.yml` to `.github/workflows/sync-copilot-deps.yml` in the consuming repo. See [How Updates Work](#how-updates-work) for details.

## Available Agents

All agents sync by default unless excluded in `.copilot-deps.json`.

### Core Agents

| Agent               | Description                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `context7`          | Expert in latest library versions and best practices using up-to-date documentation                                           |
| `foundry`           | Design, create, and maintain VS Code agent and skill infrastructure                                                           |
| `rug-orchestrator`  | Orchestration agent that decomposes requests, delegates to subagents, and validates outcomes                                  |
| `software-engineer` | Unified full-stack engineer covering implementation, testing, code review, and architecture — dynamically loads domain skills |

### Optional Agents

| Agent                         | Description                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `app-store-deployment-expert` | Mobile app deployment — App Store Connect, Google Play Console, code signing, CI/CD                    |
| `ci-monitor-subagent`         | CI helper that fetches CI status, retrieves fix details, and updates self-healing fixes                |
| `product-owner`               | Product ownership specialist — user stories, backlog decomposition, story mapping, acceptance criteria |

## Available Skills

| Skill                       | Source    | Description                                                                                                                       |
| --------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `agent-builder`             | `skills/` | Builds, edits, and reviews VS Code agent customization files (.agent.md, .instructions.md, .prompt.md, copilot-instructions.md)   |
| `android-kotlin-pro`        | `skills/` | Android Kotlin code review — Jetpack Compose, MVVM/MVI, Hilt, Coroutines/Flow, Room, Material Design 3                            |
| `appium-wdio-pro`           | `skills/` | Appium + WebDriverIO mobile testing — scaffolding, capabilities, selectors, gestures, WebView, debugging, Appium Inspector, CI/CD |
| `api-design-pro`            | `skills/` | API architecture — 3-layer design pattern, RESTful conventions, resilience, DTO design, error handling (framework-agnostic)       |
| `caddy-pro`                 | `skills/` | Caddy v2 configuration — reverse proxy, TLS, static files, security headers, SPA/PWA deployment                                   |
| `coverlet-pro`              | `skills/` | Coverlet .NET code coverage tooling — all integration drivers, filters, thresholds, CI/CD patterns                                |
| `dapper-pro`                | `skills/` | Dapper code review — parameterized queries, transactions, SQL injection prevention, performance                                   |
| `docker-pro`                | `skills/` | Docker code review — Dockerfiles, multi-stage builds, Docker Compose, security hardening                                          |
| `dotnet-migration`          | `skills/` | .NET Framework to modern .NET (.NET 8+) migration — assessment, ASP.NET Core, EF Core, WCF → gRPC                                 |
| `dotnet-server`             | `skills/` | ASP.NET Core code review — minimal APIs, middleware, DI, EF Core, authentication, .NET 8+ patterns                                |
| `fastify-pro`               | `skills/` | Fastify code review — plugin architecture, TypeScript integration, performance                                                    |
| `flutter-pro`               | `skills/` | Flutter/Dart code review — state management (Riverpod/Bloc), navigation, performance, accessibility, testing                      |
| `golang-api`                | `skills/` | Go API code review — HTTP routing, middleware, error handling, database access, testing                                           |
| `insomnia-pro`              | `skills/` | Insomnia API client workflows — collections, environments, pre-request/after-response scripts, Inso CLI, GraphQL, gRPC, WebSocket |
| `link-workspace-packages`   | `skills/` | Monorepo package linking (npm, yarn, pnpm, bun)                                                                                   |
| `mediatr-pro`               | `skills/` | MediatR code review — CQRS, handlers, pipeline behaviors, notifications                                                           |
| `mobile-uiux-pro`           | `skills/` | Mobile UI/UX review — Apple HIG, Material Design 3, WCAG 2.2, responsive layouts, gestures                                        |
| `monitor-ci`                | `skills/` | Nx Cloud CI pipeline monitoring and self-healing fixes                                                                            |
| `pocketbase-pro`            | `skills/` | PocketBase code review — collection design, API rules, hooks, auth, real-time subscriptions                                       |
| `postgres-pro`              | `skills/` | PostgreSQL code review — schema design, query optimization, indexing, RLS, PL/pgSQL, performance                                  |
| `pwa-pro`                   | `skills/` | PWA code review — service workers, caching strategies, offline support, push notifications                                        |
| `react-pro`                 | `skills/` | React 19+ code review — hooks, components, JSX, state/effects, performance, security, TypeScript, testing                         |
| `recoil-pro`                | `skills/` | Recoil code review — atoms/selectors, async state, snapshots, atom effects, performance, TypeScript                               |
| `respawn-pro`               | `skills/` | Respawn database cleanup for .NET integration tests — Respawner setup, RespawnerOptions, database provider support                |
| `rug-routing`               | `skills/` | RUG orchestrator routing table — agent roster, routing rules, handoff matrix (scaffold skill)                                     |
| `skill-builder`             | `skills/` | Builds and maintains SKILL.md skill packages (reference files, frontmatter, research methodology)                                 |
| `supabase-pro`              | `skills/` | Supabase code review — RLS policies, auth, storage, migrations, TypeScript integration                                            |
| `swiftui-pro`               | `skills/` | SwiftUI code review — modern APIs, maintainability, performance                                                                   |
| `tanstack-query-pro`        | `skills/` | TanStack Query v5 review — useQuery/useMutation, caching, invalidation, optimistic updates, SSR hydration, TypeScript             |
| `testcontainers-dotnet-pro` | `skills/` | Testcontainers for .NET — container lifecycle, built-in modules, wait strategies, xUnit/NUnit/MSTest integration                  |
| `vue-pro`                   | `skills/` | Vue 3 code review — Composition API, TypeScript, Pinia state management, performance                                              |
| `workmaker-pro`             | `skills/` | User story generation — epics, features, stories, job stories, INVEST criteria, story splitting, acceptance criteria              |
| `xunit-v3-pro`              | `skills/` | xUnit.net v3 test code — Fact/Theory/fixtures, IAsyncLifetime, Assert API, TestContext, parallelization, migration from v2        |
| `zustand-pro`               | `skills/` | Zustand v5 code review — store patterns, selectors, middleware, subscriptions, re-render optimization, TypeScript                 |

## Skill Dependencies

Some agents require specific skills to function. Dependencies are declared in `skill-deps.json` and checked automatically during sync.

Two dependency types:

- **Bundled** — A skill from the agent-repo that syncs automatically by default. In the exclude-based model these dependencies are normally satisfied without extra manifest entries.
- **Scaffold** — A skill auto-created from a template in `skill-templates/`. These define repo-specific configuration (e.g., routing rules) and are **never overwritten** once they exist — edit them freely.

Currently the only scaffold skill is `rug-routing`, required by the `rug-orchestrator` agent. It defines the specialist agent roster and routing rules for your repo.

## Migrating from the Opt-In Format

If your `.copilot-deps.json` uses the old `agents` array, `sync.mjs` will refuse to run and print a migration error. The `skills` array is unchanged — only the agent model has flipped.

### 1. Identify what you currently have

```json
{
  "source": "your-org/agent-repo",
  "ref": "main",
  "agents": ["architect", "backend-engineer"],
  "skills": ["vue-pro", "fastify-pro", "monitor-ci"]
}
```

### 2. Replace `agents` with `excludeAgents`

Agents now sync by default. Replace the opt-in `agents` array with an opt-out `excludeAgents` array listing the agents you do _not_ want. The `skills` array stays exactly as-is.

```json
{
  "source": "your-org/agent-repo",
  "ref": "main",
  "excludeAgents": [
    "app-store-deployment-expert",
    "ci-monitor-subagent",
    "mobile-engineer",
    "product-owner"
  ],
  "skills": ["vue-pro", "fastify-pro", "monitor-ci"]
}
```

> **Tip:** Copy `.copilot-deps.example.json` from the agent-repo as a starting point — it lists all available skills so you can delete the ones you don’t need.

### 3. Run sync

```sh
./sync.sh
```

Review the diff in the resulting PR and add any unwanted agents to `excludeAgents` before merging.

## How Updates Work

1. A push to `main` in the agent-repo triggers the **Notify consumers** workflow (if agents, skills, or `sync.mjs` changed).
2. The workflow reads `consumers.json` and sends a `repository_dispatch` event (`copilot-deps-update`) to each listed repo.
3. Each consumer's **Sync copilot deps** workflow:
   - Clones the agent-repo at the configured ref

- Runs `sync.mjs` to copy all source agents and skills except those explicitly excluded
- Opens (or updates) a PR on the `sync/copilot-deps` branch

Merging the PR is manual — review the diff before accepting.

## Forked Source Repos (Org-Specific Agent Repos)

Teams that need their own private agent repo can fork this repo and layer on org-specific agents, skills, and routing rules. Use `"type": "source"` to enable full-mirror mode — syncing the upstream source structure into the fork so it can redistribute to its own consumers.

### Architecture

```
┌─────────────────────────┐          source-repo sync          ┌─────────────────────────┐
│  upstream agent-repo    │  ─────────────────────────────────▶ │  org fork (source)      │
│  (this repo)            │     mirrors agents/, skills/,       │                         │
│                         │     skill-templates/, sync.mjs      │  + org-specific agents  │
│  agents/                │                                     │  + org-specific skills  │
│  skills/                │                                     │  + custom routing       │
└─────────────────────────┘                                     └───────────┬─────────────┘
                                                                            │
                                                                  consumer sync (default)
                                                                            │
                                                                            ▼
                                                                ┌─────────────────────────┐
                                                                │  consumer-repo-1        │
                                                                │  .github/agents/        │
                                                                │  .github/skills/        │
                                                                └─────────────────────────┘
```

### How it works

In source-repo mode `sync.mjs` performs a complete mirror — no filtering, no opt-in lists:

| What gets synced               | Target in fork           | Notes                                                                      |
| ------------------------------ | ------------------------ | -------------------------------------------------------------------------- |
| `agents/`                      | `agents/`                | Mirrored verbatim — preserves non-discovery layout for the fork            |
| `skills/`                      | `skills/`                | Mirrored verbatim — same rationale                                         |
| All agents → `.github/agents/` | `.github/agents/`        | Also synced for Copilot discovery if the fork uses agents locally          |
| `skill-templates/`             | `skill-templates/`       | Full overwrite — enables the fork to scaffold skills for its own consumers |
| `skill-deps.json`              | `skill-deps.json`        | So the fork can declare its own dependency graph                           |
| `core-agents.json`             | `core-agents.json`       | Kept in sync for reference / compatibility                                 |
| `consumer-workflow.yml`        | `consumer-workflow.yml`  | The fork can offer this template to its own consumers                      |
| `sync.mjs` + `sync.sh`         | root                     | The fork ships the same sync tooling to its consumers                      |
| `.copilot-deps.example.json`   | root                     | Updated example for the fork's consumers to copy                           |
| `docs/`                        | `docs/`                  | Token optimization guides synced for reference                             |
| `instruction-templates/`       | `instruction-templates/` | Instruction file templates for consumer customization                      |

`excludeAgents` and `skills` are ignored in source-repo mode and do not need to be present.

The fork keeps skills and agents at root (same as upstream) so it can also use `install.mjs` for global installs without Copilot loading duplicates. When the fork's own consumers sync normally, agents/skills land in `.github/agents/` and `.github/skills/` for proper Copilot discovery.

### Setup

1. Create `.copilot-deps.json` in the fork's root:

```json
{
  "type": "source",
  "source": "davidjonesibm/agents",
  "ref": "main"
}
```

2. Copy `sync.sh` into the fork, make it executable, and commit:

```sh
chmod +x sync.sh
git add sync.sh .copilot-deps.json && git commit -m "chore: configure as forked source repo"
```

3. Run initial sync:

```sh
./sync.sh
```

4. After syncing, add your own agents, skills, and routing rules on top. Customizations are safe — `sync.mjs` never removes files that don't exist in the upstream source.

5. Register your fork's consumers in its own `consumers.json` and set up `COPILOT_SYNC_PAT` so it can dispatch sync events downstream.

### Fork adds org-specific content

After the initial sync, the fork can add its own agents and skills alongside the upstream ones:

```
org-agent-repo/
├── agents/
│   ├── software-engineer.agent.md    ← from upstream
│   ├── foundry.agent.md              ← from upstream
│   └── org-deploy-agent.agent.md     ← org-specific
├── skills/
│   ├── react-pro/                    ← from upstream
│   ├── docker-pro/                   ← from upstream
│   └── org-terraform/                ← org-specific
├── skill-templates/
│   └── local-routing/                ← from upstream (fork customizes)
├── .copilot-deps.json                ← type: source
├── consumers.json                    ← fork's own consumer list
├── install.mjs                       ← from upstream
└── sync.mjs                          ← from upstream
```

When the fork's consumers sync, they receive both upstream and org-specific agents/skills in `.github/agents/` and `.github/skills/`.

---

## Adding a New Consuming Repo

Checklist:

- [ ] Create `.copilot-deps.json` in the consuming repo root (see format above)
- [ ] Copy `sync.sh` into the consuming repo root, run `chmod +x sync.sh`, and commit it
- [ ] Run initial sync: `./sync.sh`
- [ ] (Optional) Add the repo to `consumers.json` in agent-repo (`"your-org/repo-name"`) and push to `main`
- [ ] (Optional) Copy `consumer-workflow.yml` → `.github/workflows/sync-copilot-deps.yml` for automatic sync-on-push
- [ ] (Optional) Ensure `COPILOT_SYNC_PAT` secret is accessible if using the GitHub Actions workflow

## References

[Custom Instructions](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions)
[Agent Skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
