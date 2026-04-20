---
name: rug-routing
description: >-
  Authoritative routing table for the RUG orchestrator. Contains the full agent roster,
  file-pattern routing rules, task-phase routing, bug triage table, handoff matrix,
  and critical routing overrides. Read by RUG at the start of every session to decide
  which specialist agent handles each task.
---

# RUG Routing — Consolidated Agent Roster & Routing Rules

This skill is read by the **RUG orchestrator** at the start of every session. It is the authoritative source for:

1. Which specialist agents exist in this repository
2. How to route tasks, file patterns, and bug reports to the correct agent
3. Which handoffs are available between agents

**Override rule**: Any agent listed here takes precedence over the generic "Software Engineer Agent" fallback.

---

## 1. Agent Roster

| #   | Agent                           | Domain                       | When to Route                                                                                                                                                                                              | Skills Loaded                                                                                                         |
| --- | ------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | **Backend Engineer**            | Server-side                  | API routes, database queries, server plugins, auth middleware, WebSocket handlers. Any server-side code.                                                                                                   | fastify-pro, supabase-pro, pocketbase-pro, dotnet-server, dotnet-migration, golang-api (loaded dynamically per stack) |
| 2   | **Frontend Engineer**           | Frontend web                 | UI components, state management, composables, service workers, web app manifests. Any browser-side code.                                                                                                   | vue-pro, pwa-pro (loaded dynamically)                                                                                 |
| 3   | **Mobile Engineer**             | iOS / Android / Flutter      | Native mobile UI, platform APIs, app lifecycle, mobile UX. Any mobile codebase.                                                                                                                            | swiftui-pro, android-kotlin-pro, flutter-pro, mobile-uiux-pro (loaded dynamically)                                    |
| 4   | **Architect**                   | System design                | API design, system diagrams, architecture decisions, service decomposition, contract design.                                                                                                               | api-design-pro                                                                                                        |
| 5   | **Infrastructure Engineer**     | DevOps & tooling             | Docker, Caddy, CI/CD pipelines, monorepo tooling, deployment config, build systems.                                                                                                                        | docker-pro, caddy-pro, monitor-ci, link-workspace-packages                                                            |
| 6   | **Full-Stack Engineer**         | Cross-layer implementation   | End-to-end features that span frontend + backend + infra in a single coherent task.                                                                                                                        | All relevant framework skills (loaded dynamically)                                                                    |
| 7   | **Context7-Expert**             | Research                     | Library/framework documentation lookup via Context7 MCP. Researching APIs, checking latest syntax, finding best practices. Read-only.                                                                      | — (MCP-based)                                                                                                         |
| 8   | **Code Reviewer**               | Review                       | Post-implementation code review. Correctness, security, performance, style. Launch AFTER implementation.                                                                                                   | Framework skills loaded dynamically per review target                                                                 |
| 9   | **Test Writer**                 | Testing                      | Test generation for any language/framework. Writes comprehensive test suites. Launch AFTER implementation.                                                                                                 | Framework skills loaded dynamically per test target                                                                   |
| 10  | **Software Engineer Agent**     | General (fallback)           | FALLBACK ONLY. Use when no specialist matches, or for cross-cutting concerns that don't fit any specialist.                                                                                                | —                                                                                                                     |
| 11  | **Foundry**                     | Agent & skill infrastructure | ALL work on agent files (`.agent.md`, `.instructions.md`, `.prompt.md`, `copilot-instructions.md`, `AGENTS.md`) AND skill packages (`SKILL.md` + `references/`). Creation, editing, rebuilding, debugging. | agent-builder, skill-builder (loaded dynamically)                                                                     |
| 12  | **App Store Deployment Expert** | App distribution             | Code signing, store submission, provisioning profiles, app metadata, release workflows.                                                                                                                    | —                                                                                                                     |
| 13  | **RUG**                         | Orchestration                | The orchestrator itself. Pure delegation — never does implementation work.                                                                                                                                 | rug-routing (this file)                                                                                               |
| 14  | **Handoff**                     | Session continuity           | Generates context-carrying handoff documents for session resumption.                                                                                                                                       | —                                                                                                                     |
| 15  | **CI Monitor Subagent**         | CI monitoring                | Thin MCP helper for monitoring CI pipelines. Single tool-call per invocation.                                                                                                                              | monitor-ci                                                                                                            |

---

## 2. File Pattern → Agent Routing Rules

When a task references specific files, use this table to select the specialist agent.

| File Pattern / Path                                                                                  | Route To                               |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `*.agent.md`, `*.instructions.md`, `*.prompt.md`, `SKILL.md`, `copilot-instructions.md`, `AGENTS.md` | **Foundry**                            |
| `apps/backend/**`, `routes/**`, `plugins/**`, `**/server.*`, `**/api/**`                             | **Backend Engineer**                   |
| `apps/frontend/**`, `components/**`, `views/**`, `stores/**`, `composables/**`, `**/src/App.vue`     | **Frontend Engineer**                  |
| `**/*.swift`, `**/*.swiftui`, `*.xcodeproj/**`, `*.xcworkspace/**`, `**/Info.plist`                  | **Mobile Engineer**                    |
| `**/*.kt`, `**/*.kts`, `**/AndroidManifest.xml`, `**/build.gradle*`, `**/res/**` (Android)           | **Mobile Engineer**                    |
| `**/lib/**` (Flutter), `**/pubspec.yaml`, `**/*.dart`                                                | **Mobile Engineer**                    |
| `Dockerfile*`, `docker-compose*`, `Caddyfile*`, `.github/workflows/**`, `*.yml` (CI)                 | **Infrastructure Engineer**            |
| `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, monorepo config                                      | **Infrastructure Engineer**            |
| `docs/architecture*`, `docs/ARCHITECTURE.md`, API design docs                                        | **Architect**                          |
| `libs/shared/**` (shared types used by both frontend + backend)                                      | **Full-Stack Engineer**                |
| Cross-layer changes spanning frontend + backend in one feature                                       | **Full-Stack Engineer**                |
| `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`                                                      | **Test Writer**                        |
| Everything else (no pattern match)                                                                   | **Software Engineer Agent** (fallback) |

**Precedence**: When multiple patterns match, pick the most specific agent. Foundry overrides ALL other agents for agent/skill files (see Section 6).

---

## 3. Task Phase Routing

| Phase                                                          | Route To                          | Notes                                                                                |
| -------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| **Research** — library docs, API lookup, best practices        | **Context7-Expert**               | Always route here BEFORE implementation when library/framework knowledge is needed   |
| **Implementation** — writing production code                   | Domain specialist (see below)     | Match to most specific: Backend / Frontend / Mobile / Infra / Architect / Full-Stack |
| **Review** — post-implementation quality check                 | **Code Reviewer**                 | Launch AFTER implementation to validate correctness, security, performance           |
| **Testing** — writing or updating tests                        | **Test Writer**                   | Launch AFTER implementation when test coverage is needed                             |
| **Agent/skill infrastructure** — `.agent.md`, `SKILL.md`, etc. | **Foundry**                       | Overrides all other routing for these file types                                     |
| **CI monitoring** — pipeline status, build failures            | **CI Monitor Subagent**           | Thin helper, single tool-call per invocation                                         |
| **App store deployment** — signing, submission, profiles       | **App Store Deployment Expert**   | Code signing, provisioning, store metadata                                           |
| **Session handoff** — resumption context for next session      | **Handoff**                       | Generates handoff documents when session ends                                        |
| **Validation** — type-check, lint, build verification          | Same specialist as implementation | Or Context7-Expert for library verification                                          |

### Implementation Phase — Domain Matching

| Task Domain                                             | Route To                               |
| ------------------------------------------------------- | -------------------------------------- |
| API routes, DB queries, server plugins, auth, WebSocket | **Backend Engineer**                   |
| UI components, state, composables, service workers, PWA | **Frontend Engineer**                  |
| iOS, Android, or Flutter native code                    | **Mobile Engineer**                    |
| API design, system architecture, service decomposition  | **Architect**                          |
| Docker, Caddy, CI/CD, monorepo tooling, deployment      | **Infrastructure Engineer**            |
| End-to-end feature spanning frontend + backend + infra  | **Full-Stack Engineer**                |
| Cross-cutting / none of the above                       | **Software Engineer Agent** (fallback) |

---

## 4. Bug Triage Table

When diagnosing a bug, triage to the most specific agent based on symptoms.

| Symptoms                                                                  | Primary Diagnosis Agent                |
| ------------------------------------------------------------------------- | -------------------------------------- |
| API errors, HTTP 4xx/5xx, database query failures, auth failures          | **Backend Engineer**                   |
| WebSocket disconnects, message relay issues, real-time sync bugs          | **Backend Engineer**                   |
| UI rendering bugs, state management issues, routing errors                | **Frontend Engineer**                  |
| Service worker failures, PWA install/cache issues, push notification bugs | **Frontend Engineer**                  |
| iOS crashes, SwiftUI layout issues, Xcode build errors                    | **Mobile Engineer**                    |
| Android crashes, Kotlin compilation errors, Gradle build failures         | **Mobile Engineer**                    |
| Flutter widget errors, Dart analysis failures, platform channel issues    | **Mobile Engineer**                    |
| Docker build failures, container networking issues                        | **Infrastructure Engineer**            |
| CI pipeline failures, deployment errors, Caddy config issues              | **Infrastructure Engineer**            |
| Monorepo dependency resolution, workspace linking errors                  | **Infrastructure Engineer**            |
| API contract mismatches, schema validation errors across services         | **Architect**                          |
| Agent customization file misbehaving, skill output wrong or incomplete    | **Foundry**                            |
| Code signing errors, provisioning profile issues, store rejection         | **App Store Deployment Expert**        |
| Cross-layer bugs spanning multiple domains, unclear origin                | **Software Engineer Agent** (fallback) |
| Cannot be classified by any of the above                                  | **Software Engineer Agent** (fallback) |

---

## 5. Handoff Matrix

Shows which agents can hand off to which. A ✅ means the agent in the row can initiate a handoff to the agent in the column.

| From ↓ \ To →                   | Context7 | Backend | Frontend | Mobile | Architect | Infra | Full-Stack | Code Reviewer | Test Writer | SW Engineer | Foundry | App Store |
| ------------------------------- | -------- | ------- | -------- | ------ | --------- | ----- | ---------- | ------------- | ----------- | ----------- | ------- | --------- |
| **Backend Engineer**            | ✅       | —       | ✅       | —      | ✅        | ✅    | —          | ✅            | ✅          | —           | —       | —         |
| **Frontend Engineer**           | ✅       | ✅      | —        | —      | —         | ✅    | —          | ✅            | ✅          | —           | —       | —         |
| **Mobile Engineer**             | ✅       | ✅      | —        | —      | ✅        | —     | —          | ✅            | ✅          | —           | —       | —         |
| **Architect**                   | ✅       | ✅      | ✅       | —      | —         | ✅    | —          | ✅            | —           | —           | —       | —         |
| **Infrastructure Engineer**     | ✅       | ✅      | ✅       | —      | —         | —     | —          | ✅            | —           | —           | —       | —         |
| **Full-Stack Engineer**         | ✅       | —       | —        | —      | ✅        | ✅    | —          | ✅            | ✅          | —           | —       | —         |
| **Context7-Expert**             | —        | ✅      | ✅       | —      | —         | —     | —          | —             | —           | ✅          | —       | —         |
| **Code Reviewer**               | ✅       | —       | —        | —      | —         | —     | —          | —             | ✅          | —           | —       | —         |
| **Test Writer**                 | ✅       | —       | —        | —      | —         | —     | —          | ✅            | —           | —           | —       | —         |
| **Software Engineer Agent**     | ✅       | —       | —        | —      | —         | —     | —          | ✅            | ✅          | —           | —       | —         |
| **Foundry**                     | ✅       | —       | —        | —      | —         | —     | —          | ✅            | —           | —           | —       | —         |
| **App Store Deployment Expert** | ✅       | —       | —        | ✅     | —         | —     | —          | —             | —           | —           | —       | —         |

---

## 6. Critical Routing Overrides

These rules are **hard constraints** that override all other routing logic.

### Override 1: Agent/Skill Files → Foundry (MANDATORY)

Any task that involves creating, editing, or debugging these file types **MUST** route to **Foundry**:

- `*.agent.md`
- `*.instructions.md`
- `*.prompt.md`
- `SKILL.md`
- `copilot-instructions.md`
- `AGENTS.md`

**NEVER** route agent/skill file work to Software Engineer Agent, Backend Engineer, Frontend Engineer, or any other specialist. Foundry is the only agent with the knowledge to correctly author these files.

### Override 2: Agent File Fix-Back Rule

If any agent (e.g., Code Reviewer, Test Writer) discovers an issue with an agent or skill file during its work, the fix must be routed **back to Foundry** — not handled by the agent that found the issue.

### Override 3: Research Before Implementation

When a task involves unfamiliar library/framework APIs, route to **Context7-Expert** for research BEFORE routing to the implementation specialist. Do not skip the research phase.
