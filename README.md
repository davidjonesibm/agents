# Copilot Agents & Skills

Centralized distribution system for VS Code Copilot agent definitions and skills. Install globally for personal use, sync into repos for team use, or fork for org-specific customization.

---

## Choose Your Setup

| Use Case                 | Guide                                                  | Description                                                                   |
| ------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **Individual developer** | [Global Install](docs/global-install.md)               | Install once to `~/.copilot` — works across all workspaces, no per-repo files |
| **Team repo**            | [Consumer Repo Setup](docs/consumer-repo-setup.md)     | Sync agents/skills into a repo; automated PRs on updates                      |
| **Org fork**             | [Source Repo Fork](docs/source-repo-fork.md)           | Fork this repo, add org-specific agents/skills, redistribute to consumers     |
| **Project instructions** | [Instruction Templates](docs/instruction-templates.md) | Token-optimized templates for repo-specific `.instructions.md` files          |

> **Most common:** [Global Install](docs/global-install.md) is recommended for individuals and small teams. No per-repo maintenance required.

---

## Quick Start (Global Install)

```sh
node install.mjs                          # copilot only
node install.mjs --targets copilot,claude # both targets
```

See [docs/global-install.md](docs/global-install.md) for full details.

---

## Repository Structure

```
agent-repo/
├── agents/                ← Agent definitions (source of truth)
├── skills/                ← Skill packages with reference docs
├── skill-templates/       ← Templates for scaffold skills (auto-created in consumers)
├── instruction-templates/ ← Token-optimized .instructions.md templates (repo-specific)
├── docs/                  ← Setup guides and token optimization theory
├── install.mjs            ← Global installer (→ ~/.copilot, ~/.claude)
├── init-templates.sh      ← Scaffold instruction templates into any repo
├── sync.mjs               ← Repo sync script (for consumer/source-fork modes)
├── sync.sh                ← Shell wrapper that clones + runs sync.mjs
├── skill-deps.json        ← Agent → skill dependency declarations
└── consumers.json         ← Repos receiving dispatch events on push
```

> **Why `agents/` and `skills/` at root (not `.github/`)?**
> Copilot auto-discovers from `.github/agents/` and `.github/skills/`. Since this repo installs globally via `install.mjs`, keeping sources outside `.github/` avoids loading duplicates — only the global `~/.copilot` copies are active.

---

## Available Agents

| Agent                         | Description                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `software-engineer`           | Full-stack engineer — implementation, testing, code review, architecture; dynamically loads domain skills |
| `foundry`                     | Design, create, and maintain VS Code agent and skill infrastructure                                       |
| `rug-orchestrator`            | Decomposes requests, delegates to subagents, validates outcomes                                           |
| `context7`                    | Expert in latest library versions using up-to-date documentation                                          |
| `product-owner`               | User stories, backlog decomposition, story mapping, acceptance criteria                                   |
| `app-store-deployment-expert` | Mobile app deployment — App Store Connect, Google Play Console, code signing, CI/CD                       |
| `ci-monitor-subagent`         | CI helper — fetches status, retrieves fix details, updates self-healing fixes                             |

---

## Available Skills

| Skill                       | Description                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `agent-builder`             | Builds, edits, and reviews VS Code agent customization files                               |
| `android-kotlin-pro`        | Android Kotlin — Jetpack Compose, MVVM/MVI, Hilt, Coroutines/Flow, Room, Material Design 3 |
| `api-design-pro`            | API architecture — 3-layer design, RESTful conventions, resilience, error handling         |
| `appium-wdio-pro`           | Appium + WebDriverIO mobile testing — capabilities, selectors, gestures, CI/CD             |
| `caddy-pro`                 | Caddy v2 — reverse proxy, TLS, static files, security headers, SPA/PWA deployment          |
| `coverlet-pro`              | Coverlet .NET code coverage — all drivers, filters, thresholds, CI/CD patterns             |
| `dapper-pro`                | Dapper — parameterized queries, transactions, SQL injection prevention, performance        |
| `docker-pro`                | Docker — Dockerfiles, multi-stage builds, Compose, security hardening                      |
| `dotnet-migration`          | .NET Framework → modern .NET (8+) — assessment, ASP.NET Core, EF Core, WCF → gRPC          |
| `dotnet-server`             | ASP.NET Core — minimal APIs, middleware, DI, EF Core, authentication, .NET 8+ patterns     |
| `fastify-pro`               | Fastify — plugin architecture, TypeScript integration, performance                         |
| `flutter-pro`               | Flutter/Dart — state management, navigation, performance, accessibility, testing           |
| `golang-api`                | Go APIs — HTTP routing, middleware, error handling, database access, testing               |
| `insomnia-pro`              | Insomnia API client — collections, environments, scripts, Inso CLI, GraphQL, gRPC          |
| `link-workspace-packages`   | Monorepo package linking (npm, yarn, pnpm, bun)                                            |
| `mediatr-pro`               | MediatR — CQRS, handlers, pipeline behaviors, notifications                                |
| `mobile-uiux-pro`           | Mobile UI/UX — Apple HIG, Material Design 3, WCAG 2.2, responsive layouts                  |
| `monitor-ci`                | Nx Cloud CI pipeline monitoring and self-healing fixes                                     |
| `pocketbase-pro`            | PocketBase — collection design, API rules, hooks, auth, real-time subscriptions            |
| `postgres-pro`              | PostgreSQL — schema design, query optimization, indexing, RLS, PL/pgSQL                    |
| `pwa-pro`                   | PWA — service workers, caching strategies, offline support, push notifications             |
| `react-pro`                 | React 19+ — hooks, components, state/effects, performance, security, TypeScript, testing   |
| `recoil-pro`                | Recoil — atoms/selectors, async state, snapshots, atom effects, TypeScript                 |
| `respawn-pro`               | Respawn — database cleanup for .NET integration tests                                      |
| `rug-routing`               | RUG orchestrator routing table — agent roster, routing rules, handoff matrix               |
| `skill-builder`             | Builds and maintains SKILL.md skill packages                                               |
| `supabase-pro`              | Supabase — RLS policies, auth, storage, migrations, TypeScript integration                 |
| `swiftui-pro`               | SwiftUI — modern APIs, maintainability, performance                                        |
| `tanstack-query-pro`        | TanStack Query v5 — useQuery/useMutation, caching, invalidation, SSR hydration             |
| `testcontainers-dotnet-pro` | Testcontainers for .NET — container lifecycle, modules, wait strategies                    |
| `vue-pro`                   | Vue 3 — Composition API, TypeScript, Pinia state management, performance                   |
| `workmaker-pro`             | User story generation — epics, features, INVEST criteria, story splitting                  |
| `xunit-v3-pro`              | xUnit.net v3 — Fact/Theory/fixtures, IAsyncLifetime, Assert API, migration from v2         |
| `zustand-pro`               | Zustand v5 — store patterns, selectors, middleware, subscriptions, TypeScript              |

---

## Documentation

| Doc                                                    | Purpose                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [Global Install](docs/global-install.md)               | Install agents/skills to `~/.copilot` (recommended for individuals) |
| [Consumer Repo Setup](docs/consumer-repo-setup.md)     | Sync into a specific repo with automated PR updates                 |
| [Source Repo Fork](docs/source-repo-fork.md)           | Create an org-specific fork with custom agents/skills               |
| [Instruction Templates](docs/instruction-templates.md) | Token-optimized templates for project-specific instructions         |
| [Token Optimization](docs/token-optimization.md)       | Theory — context loading, prompt caching, measurement               |

---

## References

- [Custom Instructions (GitHub Docs)](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions)
- [Agent Skills (GitHub Docs)](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
