---
name: rug-routing
description: >-
  Defines the specialist agent roster and routing rules for the RUG orchestrator in this repository.
  Customize this file per-repo to register domain-specific agents and their routing triggers.
  RUG reads this skill at the start of every session to determine which agents to use.
---

<!-- This file was scaffolded by copilot-sync. Customize it for your repository. -->

# RUG Routing — Repo-Specific Agent Roster

This skill is read by the RUG orchestrator at the start of every task. It defines which specialist agents are available in this repository and how to route work to them.

**Override rule**: Any agent listed here takes precedence over the generic "Software Engineer Agent" fallback defined in the core RUG protocol.

---

## Specialist Agent Roster

<!-- TODO: Add rows for your repo-specific specialist agents (e.g., Fastify Expert, Vue Expert).
     Keep the 6 default utility agents below — they come from agent-repo and work in any repo.
     See "How to Customize This File" at the bottom for step-by-step instructions. -->

| Agent                       | Domain              | When to use                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Context7-Expert**         | Research            | Any question involving a specific library, framework, or package. Library best practices, version upgrades, correct API syntax, migration guidance. Use BEFORE implementation whenever tech choices or library usage is in scope.                                  |
| **Code Reviewer**           | Review              | Post-implementation review of any code. Security audit, correctness checks, style consistency, performance review. Launch AFTER implementation to validate quality.                                                                                                |
| **Test Writer**             | Testing             | Test generation for any language or framework. Launch AFTER implementation when tests are needed.                                                                                                                                                                  |
| **Custom Agent Foundry**    | Agent customization | ALL work on VS Code agent customization files: `.agent.md`, `.instructions.md`, `.prompt.md`, `SKILL.md`, `copilot-instructions.md`. Initial creation, edits after validation FAIL, updates, debugging. NEVER route agent file editing to Software Engineer Agent. |
| **Skill Foundry**           | Skill creation      | Building new agent skills from documentation or best-practice research. SKILL.md + reference files for a library, framework, or platform.                                                                                                                          |
| **Software Engineer Agent** | General (fallback)  | FALLBACK ONLY. General implementation, scripts, configuration. Use when no other specialist matches.                                                                                                                                                               |

<!-- TODO: Add your repo-specific agents here. Example:
| **Fastify Expert** | Backend | ALL Fastify backend work: route handlers, plugins, hooks, schemas, serialization, authentication, error handling. ANY task touching the apps/backend/ Fastify server code. |
| **Vue Expert** | Frontend | ALL Vue 3 frontend work: components, composables, Pinia stores, routing. ANY task touching the apps/frontend/ code. |
-->

---

## Routing Rules

<!-- TODO: Add routing rules for your repo-specific agents in step 3 below.
     The numbered phases are fixed — insert domain-specific rules within phase 3. -->

```
1. Research phase → Context7-Expert for library/framework concerns

2. Bug diagnosis phase → Follow the Bug Diagnosis Protocol in the core RUG instructions.
   Triage to the most specific specialist below; escalate to Software Engineer Agent if unresolved.

3. Implementation phase → Match to the most specific specialist:
   - Agent customization files (.agent.md, .instructions.md, .prompt.md, SKILL.md, copilot-instructions.md) → Custom Agent Foundry
   - New agent skills (SKILL.md + reference files) → Skill Foundry
   # TODO: Add repo-specific routing rules here. Examples:
   # - Fastify routes/plugins/hooks (apps/backend/) → Fastify Expert
   # - Vue components/composables/stores (apps/frontend/) → Vue Expert
   - General implementation, scripts, config → Software Engineer Agent (fallback)

4. Review phase → Code Reviewer after any implementation

5. Testing phase → Test Writer for test generation

6. Validation phase → Same specialist as implementation, or Context7-Expert for library verification
```

---

## Bug Triage Table

<!-- TODO: Add rows for your repo-specific agents that handle diagnosable domains. -->

| Symptoms                             | Primary Diagnosis Agent |
| ------------------------------------ | ----------------------- |
| Agent customization file misbehaving | Custom Agent Foundry    |
| Skill output wrong or incomplete     | Skill Foundry           |
| Cross-cutting or unclear origin      | Software Engineer Agent |
| Build, config, tooling issue         | Software Engineer Agent |
| Cannot be classified above           | Software Engineer Agent |

<!-- TODO: Add repo-specific triage rows. Example:
| Backend route/plugin/API error | Fastify Expert |
| Frontend component/store bug | Vue Expert |
-->

---

## Handoff Matrix

Domain-specific agents can hand off to: Context7, Code Reviewer, Test Writer, and Software Engineer Agent.

<!-- TODO: When you add repo-specific agents, add a row AND column for each one.
     Mark ✅ where handoff is allowed, leave blank or — where it is not. -->

| From → To             | Context7 | Software Engineer | Code Reviewer | Test Writer | Agent Foundry | Skill Foundry |
| --------------------- | -------- | ----------------- | ------------- | ----------- | ------------- | ------------- |
| **Context7-Expert**   | —        | ✅                | ✅            | ✅          | ✅            | ✅            |
| **Software Engineer** | ✅       | —                 | ✅            | ✅          | ✅            | —             |
| **Code Reviewer**     | ✅       | —                 | —             | ✅          | —             | —             |
| **Test Writer**       | ✅       | —                 | ✅            | —           | —             | —             |
| **Agent Foundry**     | ✅       | ✅                | —             | —           | —             | —             |
| **Skill Foundry**     | ✅       | —                 | —             | —           | —             | —             |

---

## How to Customize This File

To add a new specialist agent to this repo:

1. Add the agent's `.agent.md` file to `.github/agents/`
2. Add the agent's display name to the `agents:` frontmatter array in `rug-orchestrator.agent.md`
3. Add a row to the **Specialist Agent Roster** table above with precise routing triggers
4. Add a row to the **Bug Triage Table** if the agent handles a diagnosable domain
5. Add a row and column to the **Handoff Matrix** for the new agent
6. Add a routing rule in phase 3 of the **Routing Rules** block

**Example**: Adding a `Fastify Expert` for a Node.js backend repo:

```markdown
| **Fastify Expert** | Backend | ALL Fastify backend work: route handlers, plugins, hooks, schemas, serialization, authentication, error handling. ANY task touching the apps/backend/ Fastify server code. |
```

Routing rule addition:

```
- Fastify routes/plugins/hooks (apps/backend/) → Fastify Expert
```
