---
name: local-routing
description: >-
  Repo-specific routing overrides for the RUG orchestrator. Customizations here
  take precedence over the canonical rug-routing rules synced from agent-repo.
  Add file-pattern overrides, custom triage rules, and repo-specific routing preferences.
---

# Local Routing Overrides

This file extends the canonical `rug-routing/SKILL.md` with repo-specific routing rules. The base rug-routing skill (synced from agent-repo) covers **core agents** that are always present: RUG, Foundry, Code Reviewer, Software Engineer Agent, Handoff, and Context7-Expert.

When you add **optional specialist agents** to your `.copilot-deps.json` `agents` array, you should add their routing rules here so RUG knows how to use them.

**How it works:**

- RUG reads `rug-routing` FIRST for the core agent roster and default rules
- RUG reads this file (local-routing) SECOND — rules here **override or extend** the defaults
- Core agent routing is already handled; this file is for optional agents and repo-specific customizations

**How to use this file:**

1. Add an optional agent to your `.copilot-deps.json` `agents` array (e.g., `"backend-engineer"`)
2. Run the sync workflow to pull the agent definition into your repo
3. Uncomment the corresponding rows in each section below
4. Adjust file patterns, triage rules, and handoffs to match your repo structure

---

## 1. Optional Agent Roster Extension

The core agent roster lives in `rug-routing`. The table below lists all **optional specialist agents** available from agent-repo. Uncomment agents you've added to your `.copilot-deps.json` `agents` array.

| #    | Agent | Domain                          | When to Route              | Skills Loaded                                                                               |
| ---- | ----- | ------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --- |
| <!-- | 1     | **Architect**                   | System design              | API design, system diagrams, architecture decisions, service decomposition, contract design | api-design-pro                                                                         | --> |
| <!-- | 2     | **Backend Engineer**            | Server-side                | API routes, database queries, server plugins, auth middleware, WebSocket handlers           | fastify-pro, supabase-pro, pocketbase-pro, dotnet-server, dotnet-migration, golang-api | --> |
| <!-- | 3     | **Frontend Engineer**           | Frontend web               | UI components, state management, composables, service workers, web app manifests            | vue-pro, pwa-pro                                                                       | --> |
| <!-- | 4     | **Full-Stack Engineer**         | Cross-layer implementation | End-to-end features spanning frontend + backend + infra in a single coherent task           | All relevant framework skills (loaded dynamically)                                     | --> |
| <!-- | 5     | **Mobile Engineer**             | iOS / Android / Flutter    | Native mobile UI, platform APIs, app lifecycle, mobile UX                                   | swiftui-pro, android-kotlin-pro, flutter-pro, mobile-uiux-pro                          | --> |
| <!-- | 6     | **Infrastructure Engineer**     | DevOps & tooling           | Docker, Caddy, CI/CD pipelines, monorepo tooling, deployment config, build systems          | docker-pro, caddy-pro, monitor-ci, link-workspace-packages                             | --> |
| <!-- | 7     | **Test Writer**                 | Testing                    | Test generation for any language/framework. Writes comprehensive test suites                | Framework skills loaded dynamically per test target                                    | --> |
| <!-- | 8     | **App Store Deployment Expert** | App distribution           | Code signing, store submission, provisioning profiles, app metadata, release workflows      | —                                                                                      | --> |
| <!-- | 9     | **CI Monitor Subagent**         | CI monitoring              | CI pipeline status, build failures, self-healing fixes. Single tool-call per invocation     | monitor-ci                                                                             | --> |

---

## 2. File Pattern Overrides

Add rows to route specific file patterns to the correct specialist agent. Uncomment rows for agents you've enabled, and adjust patterns to match your repo's directory structure.

| File Pattern / Path | Route To | Notes |
| ------------------- | -------- | ----- |

<!-- Uncomment if you have a repo-specific override for an existing core route: -->
<!-- | `apps/admin/**` | **Frontend Engineer** | Admin panel uses Vue, not generic SW Engineer | -->

<!-- Uncomment Backend Engineer patterns when backend-engineer is enabled: -->
<!-- | `apps/backend/**`, `routes/**`, `plugins/**`, `**/server.*`, `**/api/**` | **Backend Engineer** | Server-side code — adjust paths to your repo structure | -->

<!-- Uncomment Frontend Engineer patterns when frontend-engineer is enabled: -->
<!-- | `apps/frontend/**`, `components/**`, `views/**`, `stores/**`, `composables/**` | **Frontend Engineer** | Browser-side code — adjust paths to your repo structure | -->

<!-- Uncomment Mobile Engineer patterns when mobile-engineer is enabled: -->
<!-- | `**/*.swift`, `**/*.swiftui`, `*.xcodeproj/**`, `*.xcworkspace/**`, `**/Info.plist` | **Mobile Engineer** | iOS / SwiftUI files | -->
<!-- | `**/*.kt`, `**/*.kts`, `**/AndroidManifest.xml`, `**/build.gradle*`, `**/res/**` | **Mobile Engineer** | Android / Kotlin files | -->
<!-- | `**/lib/**` (Flutter), `**/pubspec.yaml`, `**/*.dart` | **Mobile Engineer** | Flutter / Dart files | -->

<!-- Uncomment Infrastructure Engineer patterns when infrastructure-engineer is enabled: -->
<!-- | `Dockerfile*`, `docker-compose*`, `Caddyfile*`, `.github/workflows/**`, `*.yml` (CI) | **Infrastructure Engineer** | Container and CI/CD config | -->
<!-- | `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, monorepo config | **Infrastructure Engineer** | Monorepo tooling | -->

<!-- Uncomment Architect patterns when architect is enabled: -->
<!-- | `docs/architecture*`, `docs/ARCHITECTURE.md`, API design docs | **Architect** | Architecture documentation and design | -->

<!-- Uncomment Test Writer patterns when test-writer is enabled: -->
<!-- | `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**` | **Test Writer** | Test files — route here for test generation/updates | -->

<!-- Uncomment Full-Stack Engineer patterns when full-stack-engineer is enabled: -->
<!-- | `libs/shared/**` (shared types used by both frontend + backend) | **Full-Stack Engineer** | Cross-layer shared code | -->
<!-- | Cross-layer changes spanning frontend + backend in one feature | **Full-Stack Engineer** | End-to-end feature work | -->

---

## 3. Task Phase Overrides

Route tasks to the correct agent based on the current phase of work. Uncomment rows for agents you've enabled.

| Phase | Route To | Notes |
| ----- | -------- | ----- |

<!-- Uncomment implementation phase routes for enabled specialists: -->
<!-- | **Implementation** — API routes, DB queries, server plugins, auth, WebSocket | **Backend Engineer** | Server-side production code | -->
<!-- | **Implementation** — UI components, state, composables, service workers, PWA | **Frontend Engineer** | Browser-side production code | -->
<!-- | **Implementation** — iOS, Android, or Flutter native code | **Mobile Engineer** | Native mobile production code | -->
<!-- | **Implementation** — Docker, Caddy, CI/CD, monorepo tooling, deployment | **Infrastructure Engineer** | DevOps and build system work | -->
<!-- | **Implementation** — API design, system architecture, service decomposition | **Architect** | Architecture decisions and design docs | -->
<!-- | **Implementation** — End-to-end feature spanning frontend + backend + infra | **Full-Stack Engineer** | Cross-layer feature implementation | -->

<!-- Uncomment testing phase route when test-writer is enabled: -->
<!-- | **Testing** — writing or updating tests post-implementation | **Test Writer** | Launch AFTER implementation for test coverage | -->

<!-- Uncomment CI monitoring route when ci-monitor-subagent is enabled: -->
<!-- | **CI monitoring** — pipeline status, build failures | **CI Monitor Subagent** | Thin helper, single tool-call per invocation | -->

<!-- Uncomment app store route when app-store-deployment-expert is enabled: -->
<!-- | **App store deployment** — signing, submission, profiles | **App Store Deployment Expert** | Code signing, provisioning, store metadata | -->

---

## 4. Bug Triage Overrides

Add rows to route specific bug symptoms to the correct diagnosis agent. Uncomment rows for agents you've enabled.

| Symptoms | Primary Diagnosis Agent | Notes |
| -------- | ----------------------- | ----- |

<!-- Uncomment for repo-specific overrides: -->
<!-- | Stripe webhook failures | **Backend Engineer** | All payment logic is server-side in this repo | -->

<!-- Uncomment Backend Engineer triage when backend-engineer is enabled: -->
<!-- | API errors, HTTP 4xx/5xx, database query failures, auth failures | **Backend Engineer** | Server-side errors | -->
<!-- | WebSocket disconnects, message relay issues, real-time sync bugs | **Backend Engineer** | Real-time backend issues | -->

<!-- Uncomment Frontend Engineer triage when frontend-engineer is enabled: -->
<!-- | UI rendering bugs, state management issues, routing errors | **Frontend Engineer** | Browser-side rendering | -->
<!-- | Service worker failures, PWA install/cache issues, push notification bugs | **Frontend Engineer** | PWA and offline issues | -->

<!-- Uncomment Mobile Engineer triage when mobile-engineer is enabled: -->
<!-- | iOS crashes, SwiftUI layout issues, Xcode build errors | **Mobile Engineer** | iOS platform issues | -->
<!-- | Android crashes, Kotlin compilation errors, Gradle build failures | **Mobile Engineer** | Android platform issues | -->
<!-- | Flutter widget errors, Dart analysis failures, platform channel issues | **Mobile Engineer** | Flutter/Dart issues | -->

<!-- Uncomment Infrastructure Engineer triage when infrastructure-engineer is enabled: -->
<!-- | Docker build failures, container networking issues | **Infrastructure Engineer** | Container issues | -->
<!-- | CI pipeline failures, deployment errors, Caddy config issues | **Infrastructure Engineer** | CI/CD and reverse proxy | -->
<!-- | Monorepo dependency resolution, workspace linking errors | **Infrastructure Engineer** | Monorepo tooling | -->

<!-- Uncomment Architect triage when architect is enabled: -->
<!-- | API contract mismatches, schema validation errors across services | **Architect** | Cross-service design issues | -->

<!-- Uncomment App Store Deployment Expert triage when app-store-deployment-expert is enabled: -->
<!-- | Code signing errors, provisioning profile issues, store rejection | **App Store Deployment Expert** | Distribution issues | -->

---

## 5. Handoff Matrix Extension

Shows which optional agents can hand off to which. Uncomment the full matrix when you've enabled optional agents. A ✅ means the row agent can initiate a handoff to the column agent.

<!-- Uncomment and adjust this matrix based on which optional agents you've enabled.
     Remove columns/rows for agents you haven't added.

| From ↓ \ To →                   | Context7 | Backend | Frontend | Mobile | Architect | Infra | Full-Stack | Code Reviewer | Test Writer | SW Engineer | Foundry | App Store |
| - - - - - - - - - - - - - - - - | - - - -  | - - - - | - - - -  | - - -  | - - - - - | - - - | - - - - -  | - - - - - - - | - - - - - - | - - - - - - | - - - - | - - - - - |
| **Architect**                   | ✅       | ✅      | ✅       | —      | —         | ✅    | —          | ✅            | —           | —           | —       | —         |
| **Backend Engineer**            | ✅       | —       | ✅       | —      | ✅        | ✅    | —          | ✅            | ✅          | —           | —       | —         |
| **Frontend Engineer**           | ✅       | ✅      | —        | —      | —         | ✅    | —          | ✅            | ✅          | —           | —       | —         |
| **Full-Stack Engineer**         | ✅       | —       | —        | —      | ✅        | ✅    | —          | ✅            | ✅          | —           | —       | —         |
| **Mobile Engineer**             | ✅       | ✅      | —        | —      | ✅        | —     | —          | ✅            | ✅          | —           | —       | ✅        |
| **Infrastructure Engineer**     | ✅       | ✅      | ✅       | —      | —         | —     | —          | ✅            | —           | —           | —       | —         |
| **Test Writer**                 | ✅       | —       | —        | —      | —         | —     | —          | ✅            | —           | —           | —       | —         |
| **App Store Deployment Expert** | ✅       | —       | —        | ✅     | —         | —     | —          | —             | —           | —           | —       | —         |
| **CI Monitor Subagent**         | —        | —       | —        | —      | —         | ✅    | —          | —             | —           | —           | —       | —         |

-->

---

## 6. Custom Routing Rules

Add any repo-specific routing notes or constraints here. These are free-form instructions that RUG will follow.

<!-- Example:
- Always route database migration files (`migrations/**`) to Backend Engineer, never Infra.
- For PRs touching both `apps/api` and `apps/web`, prefer Full-Stack Engineer over splitting.
-->
