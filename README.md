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

## Quick Start (Global Install agents and skills)

1. clone/download [install.sh](./install.sh)
1. run
   ```sh
   chmod +x install.sh
   ./install.sh                              # copilot target only
   ./install.sh --targets copilot,claude     # both targets
   ```

To add instruction templates to a repo

1. add [init-templates.sh](./init-templates.sh) to the repo root
1. run
   ```sh
   chmod +x init-templates.sh
   ./init-templates.sh
   ```

See [docs/global-install.md](docs/global-install.md) for full details.

---

## Global Instructions

Files in `global-instructions/` install to the VS Code user prompts folder and apply in
**every workspace on the machine** — no per-repo setup. `install.mjs` handles this
automatically; skip it with `--no-instructions`.

| Folder                   | Scope                   | Installed by        |
| ------------------------ | ----------------------- | ------------------- |
| `global-instructions/`   | Machine-wide, all repos | `install.mjs`       |
| `instruction-templates/` | Per-repo scaffolding    | `init-templates.sh` |

Currently ships [cost-control.instructions.md](global-instructions/cost-control.instructions.md) —
failure budgets (stop after two attempts instead of looping), cost pushback on expensive
requests, and output-padding prohibitions.

Detected locations: `Code`, `Code - Insiders`, and `VSCodium` on macOS, Linux, and Windows.
All detected flavours get the files. Override with `VSCODE_USER_DIR`.

---

## Trimming What Gets Installed

Every installed skill contributes its `description` to the skill-discovery block, which is sent
as **fresh input on the first turn of every session**. If most of your sessions are short, that
fixed overhead is the largest single component of your token spend — so installing 36 skills
when you only work in one stack is a real, recurring cost.

Install only what you use:

```sh
node install.mjs --include-skills dotnet-server,xunit-v3-pro,dapper-pro
```

Or make it permanent with a config file:

```sh
cp install.config.example.json install.config.json   # local clone
# or, if you install via install.sh:
cp install.config.example.json ~/.copilot/install.config.json
```

The example ships with ready-made `dotnet`, `web`, and `mobile` profiles — copy one into
`includeSkills`.

**Selection rules:**

| Config                        | Result                                          |
| ----------------------------- | ----------------------------------------------- |
| `includeSkills: []` (default) | Install **everything** — nothing changes        |
| `includeSkills: [...]`        | Allowlist — only those install                  |
| `excludeSkills: [...]`        | Applied **after** include — a profile minus one |

Anything not selected is **pruned** from `~/.copilot` on the next install, so switching stacks
is just: swap the array, re-run. Unknown names are reported as warnings rather than silently
ignored, so a typo in an allowlist won't quietly drop a skill.

Profiles are allowlists rather than denylists on purpose: with a denylist, every new skill added
upstream leaks into every profile until someone remembers to exclude it in each one.

| Location                         | Use when                                                  |
| -------------------------------- | --------------------------------------------------------- |
| `<repo>/install.config.json`     | You work from a local clone (gitignored)                  |
| `~/.copilot/install.config.json` | You use `install.sh` — it clones to `/tmp` and deletes it |

CLI flags override the config file. Run `node install.mjs --help` for all options.

To measure the effect, see [token-audit.mjs](./token-audit.mjs) and
[docs/token-optimization.md](docs/token-optimization.md).

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
├── install.sh             ← Shell wrapper that clones + runs install.mjs
├── init-templates.mjs     ← Instruction template scaffolding logic
├── init-templates.sh      ← Shell wrapper that clones + runs init-templates.mjs
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
