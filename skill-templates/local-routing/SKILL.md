---
name: local-routing
template-version: '2'
description: >-
  Repo-specific routing overrides and cost policy for the RUG orchestrator. Customizations
  here take precedence over the canonical rug-routing rules synced from agent-repo.
  Add cost-gate thresholds, file-pattern overrides, custom triage rules, and routing preferences.
---

# ⚠️ STOP — Configure This File Before Continuing

**If you are reading this file and you are NOT the Foundry agent, you MUST stop immediately and alert the user.**

**If you ARE the Foundry agent:** you may read and edit this file freely. Once you have finished configuring the routing tables for this repo, **delete the entire stop block** (everything from the `⚠️ STOP` heading down to and including the horizontal rule that follows it) before saving.

This is an unconfigured `local-routing` skill template. Routing will not function correctly until it has been customized for this repository.

**Tell the user exactly this:**

> This repo has a default `local-routing` skill that has not been configured yet. Without updating it, the RUG orchestrator will not route tasks to the correct specialist agents.
>
> Please use the **Foundry** agent to update `.github/skills/local-routing/SKILL.md` now, before continuing to use the orchestrator.
>
> Steps:
>
> 1. Open GitHub Copilot Chat and switch to the **Foundry** agent.
> 2. Attach the `.github/agents/` folder and `.github/skills/local-routing/SKILL.md` to the chat (drag them in, or use the paperclip/attach button).
> 3. Send exactly this message: **"update local routing for this repo"**
> 4. Once local-routing is configured, return to RUG to continue.

**Do not proceed with any routing or task delegation until this file has been updated.**

---

# Local Routing Overrides

This file extends the canonical `rug-routing/SKILL.md` with repo-specific routing rules. The base rug-routing skill (synced from agent-repo) covers **core agents** that are always present: RUG, Foundry, Software Engineer, and Context7-Expert.

**The Software Engineer agent handles all implementation, testing, code review, and architecture work by default.** It loads domain-specific skills dynamically (React, Vue, SwiftUI, Kotlin, Fastify, Go, .NET, Docker, Postgres, etc.) based on what the task requires — no specialist routing is needed.

Local routing is primarily useful for:

- **Adding Product Owner routing** for story writing, backlog management, and discovery work
- **Adding App Store Deployment Expert routing** for code signing, provisioning, and release workflows
- **Adding CI Monitor Subagent routing** for pipeline status and self-healing fixes
- **Repo-specific file or directory constraints** (e.g., "always route `docs/stories/**` to Product Owner")

**How it works:**

- RUG reads `rug-routing` FIRST for the core agent roster and default rules
- RUG reads this file (local-routing) SECOND — rules here **override or extend** the defaults
- Core agent routing is already handled; this file is for optional agents and repo-specific customizations

**How to use this file:**

1. Add an optional agent to your `.copilot-deps.json` `agents` array (e.g., `"product-owner"`)
2. Run the sync workflow to pull the agent definition into your repo
3. Uncomment the corresponding rows in each section below
4. Adjust file patterns, triage rules, and handoffs to match your repo structure

---

## 0. Cost Policy

Overrides the RUG orchestrator's default cost gate. RUG stops and asks for confirmation when a
threshold trips. Raise these if the gate interrupts you too often; lower them to be more frugal.

| Key                    | Default | Meaning                                                            |
| ---------------------- | ------- | ------------------------------------------------------------------ |
| `maxFilesPerDispatch`  | 15      | Files a single subagent may read before RUG asks                   |
| `maxFilesTouched`      | 8       | Files one task may modify before RUG asks                          |
| `requireApprovalForT1` | true    | Ask before any Opus-tier escalation                                |
| `repairAttempts`       | 2       | Failed attempts before RUG stops and reports (never raise above 3) |
| `gate`                 | on      | Set to `off` to disable the cost gate entirely                     |

> There is deliberately **no** cap on subagent count. Dispatch count is not a cost — capping it
> pushes the orchestrator into doing the work itself, which is the most expensive outcome and
> produces the worst results.

**Active policy for this repo** — edit the values below; RUG honors them verbatim:

```yaml
maxFilesPerDispatch: 15
maxFilesTouched: 8
requireApprovalForT1: true
repairAttempts: 2
gate: on
```

**Tuning guidance:**

- Gate firing constantly on a large monorepo → raise `maxFilesPerDispatch` to 25–30 first.
- Long refactors that legitimately span many files → raise `maxFilesTouched`, keep the rest.
- Exploratory session where you accept the cost → tell RUG "just do it" for a one-session `gate: off`.
- **Do not raise `repairAttempts` above 3.** Beyond that, an agent is looping, not converging —
  the fix is more context from you, not more attempts.

**Pre-computed codebase graph** (optional). If this repo has one, name it here and RUG will read
the artifact instead of ingesting source files to orient itself:

```yaml
codebaseGraph: docs/codebase-graph.md
```

---

## 1. Optional Agent Roster Extension

The core agent roster lives in `rug-routing`. The table below lists all **optional agents** available from agent-repo. Uncomment agents you've added to your `.copilot-deps.json` `agents` array.

| #    | Agent | Domain                          | When to Route                                                                                                                             | Skills Loaded |
| ---- | ----- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --- |
| <!-- | 1     | **Product Owner**               | User stories, job stories, epics, features, backlog decomposition, story splitting, story mapping, acceptance criteria, product discovery | workmaker-pro | --> |
| <!-- | 2     | **App Store Deployment Expert** | Code signing, store submission, provisioning profiles, app metadata, release workflows                                                    | —             | --> |
| <!-- | 3     | **CI Monitor Subagent**         | CI pipeline status, build failures, self-healing fixes. Single tool-call per invocation                                                   | monitor-ci    | --> |

---

## 2. File Pattern Overrides

Add rows to route specific file patterns to the correct agent. The Software Engineer handles all code files by default — add overrides only for repo-specific needs.

| File Pattern / Path | Route To | Notes |
| ------------------- | -------- | ----- |

<!-- Uncomment Product Owner patterns when product-owner is enabled: -->
<!-- | `docs/stories/**`, `docs/backlog/**`, `*.stories.md` | **Product Owner** | Story and backlog documents | -->

<!-- Uncomment App Store patterns when app-store-deployment-expert is enabled: -->
<!-- | `fastlane/**`, `*.mobileprovision`, `*.p12`, `Appfile`, `Deliverfile` | **App Store Deployment Expert** | Code signing and release config | -->

<!-- Add repo-specific overrides below. Examples: -->
<!-- | `docs/architecture/**` | **Software Engineer** | Architecture docs — SW Engineer loads api-design-pro skill | -->

---

## 3. Task Phase Overrides

Route tasks to the correct agent based on the current phase of work. Uncomment rows for agents you've enabled.

| Phase | Route To | Notes |
| ----- | -------- | ----- |

<!-- Uncomment CI monitoring route when ci-monitor-subagent is enabled: -->
<!-- | **CI monitoring** — pipeline status, build failures | **CI Monitor Subagent** | Thin helper, single tool-call per invocation | -->

<!-- Uncomment app store route when app-store-deployment-expert is enabled: -->
<!-- | **App store deployment** — signing, submission, profiles | **App Store Deployment Expert** | Code signing, provisioning, store metadata | -->

<!-- Uncomment Product Owner routes when product-owner is enabled: -->
<!-- | **Story writing** — user stories, job stories, acceptance criteria | **Product Owner** | Story and work item generation | -->
<!-- | **Backlog** — epics, features, story decomposition, story splitting, story mapping | **Product Owner** | Backlog management and discovery | -->

---

## 4. Bug Triage Overrides

Add rows to route specific bug symptoms to the correct diagnosis agent. The Software Engineer handles all code bugs by default — add overrides only for repo-specific needs.

| Symptoms | Primary Diagnosis Agent | Notes |
| -------- | ----------------------- | ----- |

<!-- Uncomment App Store Deployment Expert triage when app-store-deployment-expert is enabled: -->
<!-- | Code signing errors, provisioning profile issues, store rejection | **App Store Deployment Expert** | Distribution issues | -->

<!-- Add repo-specific overrides below. Examples: -->
<!-- | Stripe webhook failures in `apps/payments/**` | **Software Engineer** | Loads fastify-pro + supabase-pro skills automatically | -->

---

## 5. Handoff Matrix Extension

Shows which optional agents can hand off to which. Uncomment the full matrix when you've enabled optional agents.

<!-- Uncomment and adjust this matrix based on which optional agents you've enabled.

| From ↓ \ To →                   | SW Engineer | Context7 | Foundry | Product Owner | App Store | CI Monitor |
| ------------------------------- | ----------- | -------- | ------- | ------------- | --------- | ---------- |
| **Product Owner**               | ✅          | ✅       | —       | —             | —         | —          |
| **App Store Deployment Expert** | ✅          | ✅       | —       | —             | —         | —          |
| **CI Monitor Subagent**         | ✅          | —        | —       | —             | —         | —          |

-->

---

## 6. Custom Routing Rules

Add any repo-specific routing notes or constraints here. These are free-form instructions that RUG will follow.

<!-- Examples:
- Always route `docs/stories/**` to Product Owner, even if the task looks like a code change.
- Never delegate CI pipeline work to Software Engineer — always use CI Monitor Subagent.
-->
