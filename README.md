# Copilot Deps Sync

Centralized distribution system for VS Code Copilot agent definitions and skills. The agent-repo is the single source of truth — consuming repos declare which skills they need, and updates propagate automatically via GitHub Actions PRs.

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

- **Agents** — ALL `.agent.md` files from `.github/agents/` (always, not configurable)
- **Skills** — Only those listed in the consumer's `.copilot-deps.json`
- **Scaffold skills** — Auto-created from templates when required by an agent (never overwritten once they exist)
- **Instructions** — `.github/copilot-instructions.md` is **never** synced (repo-specific)

## Setup: Central Repo (one-time)

1. Create a **GitHub PAT** (classic or fine-grained) with `repo` scope on all consuming repos.
2. Add it as a repository secret named **`COPILOT_SYNC_PAT`** in this repo's Settings → Secrets → Actions.
3. Register consuming repos in `consumers.json`:

```json
{
  "repos": ["your-org/consumer-repo-1", "your-org/consumer-repo-2"]
}
```

## Setup: Consuming Repo

### 1. Create `.copilot-deps.json`

```json
{
  "source": "your-org/agent-repo",
  "ref": "main",
  "skills": ["vue-pro", "fastify-pro", "monitor-ci"]
}
```

| Field    | Required | Description                                    |
| -------- | -------- | ---------------------------------------------- |
| `source` | Yes      | GitHub `owner/repo` of the agent-repo          |
| `ref`    | No       | Branch/tag to sync from (default: `main`)      |
| `skills` | Yes      | Array of skill names to sync (see table below) |

### 2. Add the workflow

Copy `consumer-workflow.yml` from this repo to `.github/workflows/sync-copilot-deps.yml` in the consuming repo.

### 3. Run initial sync

Either trigger the workflow manually (Actions → Sync copilot deps → Run workflow) or run locally:

```sh
git clone --depth 1 https://github.com/your-org/agents.git /tmp/agent-repo
node /tmp/agent-repo/sync.mjs
```

## Available Skills

| Skill                     | Location          | Description                                                                                                                     |
| ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `agent-builder`           | `.github/skills/` | Builds, edits, and reviews VS Code agent customization files (.agent.md, .instructions.md, .prompt.md, copilot-instructions.md) |
| `android-kotlin-pro`      | `.github/skills/` | Android Kotlin code review — Jetpack Compose, MVVM/MVI, Hilt, Coroutines/Flow, Room, Material Design 3                          |
| `api-design-pro`          | `.github/skills/` | API architecture — 3-layer design pattern, RESTful conventions, resilience, DTO design, error handling (framework-agnostic)     |
| `caddy-pro`               | `.github/skills/` | Caddy v2 configuration — reverse proxy, TLS, static files, security headers, SPA/PWA deployment                                 |
| `dapper-pro`              | `.github/skills/` | Dapper code review — parameterized queries, transactions, SQL injection prevention, performance                                 |
| `docker-pro`              | `.github/skills/` | Docker code review — Dockerfiles, multi-stage builds, Docker Compose, security hardening                                        |
| `dotnet-migration`        | `.github/skills/` | .NET Framework to modern .NET (.NET 8+) migration — assessment, ASP.NET Core, EF Core, WCF → gRPC                               |
| `dotnet-server`           | `.github/skills/` | ASP.NET Core code review — minimal APIs, middleware, DI, EF Core, authentication, .NET 8+ patterns                              |
| `fastify-pro`             | `.github/skills/` | Fastify code review — plugin architecture, TypeScript integration, performance                                                  |
| `flutter-pro`             | `.github/skills/` | Flutter/Dart code review — state management (Riverpod/Bloc), navigation, performance, accessibility, testing                    |
| `golang-api`              | `.github/skills/` | Go API code review — HTTP routing, middleware, error handling, database access, testing                                         |
| `link-workspace-packages` | `.github/skills/` | Monorepo package linking (npm, yarn, pnpm, bun)                                                                                 |
| `mediatr-pro`             | `.github/skills/` | MediatR code review — CQRS, handlers, pipeline behaviors, notifications                                                         |
| `mobile-uiux-pro`         | `.github/skills/` | Mobile UI/UX review — Apple HIG, Material Design 3, WCAG 2.2, responsive layouts, gestures                                      |
| `monitor-ci`              | `.github/skills/` | Nx Cloud CI pipeline monitoring and self-healing fixes                                                                          |
| `pocketbase-pro`          | `.github/skills/` | PocketBase code review — collection design, API rules, hooks, auth, real-time subscriptions                                     |
| `postgres-pro`            | `.github/skills/` | PostgreSQL code review — schema design, query optimization, indexing, RLS, PL/pgSQL, performance                                |
| `pwa-pro`                 | `.github/skills/` | PWA code review — service workers, caching strategies, offline support, push notifications                                      |
| `rug-routing`             | `.github/skills/` | RUG orchestrator routing table — agent roster, routing rules, handoff matrix (scaffold skill)                                   |
| `skill-builder`           | `.github/skills/` | Builds and maintains SKILL.md skill packages (reference files, frontmatter, research methodology)                               |
| `supabase-pro`            | `.github/skills/` | Supabase code review — RLS policies, auth, storage, migrations, TypeScript integration                                          |
| `swiftui-pro`             | `.github/skills/` | SwiftUI code review — modern APIs, maintainability, performance                                                                 |
| `vue-pro`                 | `.github/skills/` | Vue 3 code review — Composition API, TypeScript, Pinia state management, performance                                            |

## Skill Dependencies

Some agents require specific skills to function. Dependencies are declared in `skill-deps.json` and checked automatically during sync.

Two dependency types:

- **Bundled** — A skill from the agent-repo that the consumer should add to their `skills` array. The sync script warns if it's missing.
- **Scaffold** — A skill auto-created from a template in `skill-templates/`. These define repo-specific configuration (e.g., routing rules) and are **never overwritten** once they exist — edit them freely.

Currently the only scaffold skill is `rug-routing`, required by the `rug-orchestrator` agent. It defines the specialist agent roster and routing rules for your repo.

## How Updates Work

1. A push to `main` in the agent-repo triggers the **Notify consumers** workflow (if agents, skills, or `sync.mjs` changed).
2. The workflow reads `consumers.json` and sends a `repository_dispatch` event (`copilot-deps-update`) to each listed repo.
3. Each consumer's **Sync copilot deps** workflow:
   - Clones the agent-repo at the configured ref
   - Runs `sync.mjs` to copy agents and requested skills
   - Opens (or updates) a PR on the `sync/copilot-deps` branch

Merging the PR is manual — review the diff before accepting.

## Manual Sync

Run from the root of your consuming repo:

```sh
# Clone agent-repo to a temp directory
git clone --depth 1 https://github.com/your-org/agents.git /tmp/agent-repo

# Run sync (reads .copilot-deps.json from CWD)
node /tmp/agent-repo/sync.mjs

# Clean up
rm -rf /tmp/agent-repo
```

The script prints a summary of added, updated, and removed files.

## Adding a New Consuming Repo

Checklist:

- [ ] Create `.copilot-deps.json` in the consuming repo root (see format above)
- [ ] Copy `consumer-workflow.yml` → `.github/workflows/sync-copilot-deps.yml`
- [ ] Ensure `COPILOT_SYNC_PAT` secret is accessible (org-level or add to the repo)
- [ ] Add the repo to `consumers.json` in agent-repo (`"your-org/repo-name"`)
- [ ] Push consumers.json change to `main`
- [ ] Run initial sync manually or trigger the workflow via `workflow_dispatch`
