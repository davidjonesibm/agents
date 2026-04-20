# Agent Ecosystem Consolidation Plan

## Status

**Phase 3 complete.** Skills rebuilt (Phase 1), generic agents built (Phase 2), supporting agents updated (Phase 3).

## Goal

Consolidate **22 specific agents → 15 agents** (6 generic engineers + 9 kept as-is). Move domain knowledge from agent bodies into swappable skills. Generic agents detect the project's framework and load the right skill at runtime.

---

## Current Agent Roster (22)

All agents in `.github/agents/`.

## Target Agent Roster (15)

### New Generic Agents (6)

| #   | Agent                       | Replaces                                                                   | Skills Consumed                                                                                    |
| --- | --------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Backend Engineer**        | Fastify Expert, PocketBase Expert, Supabase Expert                         | `fastify-pro`, `supabase-pro`, `pocketbase-pro`, `dotnet-server`, `dotnet-migration`, `golang-api` |
| 2   | **Frontend Engineer (Web)** | Vue.js Expert, PWA Expert                                                  | `vue-pro`, `pwa-pro`                                                                               |
| 3   | **Mobile Engineer**         | SwiftUI Expert, Android Kotlin Expert, Flutter Expert, Mobile UI/UX Expert | `swiftui-pro`, `android-kotlin-pro`, `flutter-pro`, `mobile-uiux-pro`                              |
| 4   | **Architect**               | API Architect                                                              | `api-design-pro`                                                                                   |
| 5   | **Infrastructure Engineer** | Docker Expert, Caddy Expert                                                | `docker-pro`, `caddy-pro`, `monitor-ci`, `link-workspace-packages`                                 |
| 6   | **Full-Stack Engineer**     | _(new — no replacement)_                                                   | Dynamically loads all relevant framework skills                                                    |

### Agents Kept As-Is (9)

- RUG Orchestrator _(meta/utility)_
- Context7-Expert _(MCP wrapper)_
- Foundry _(meta/utility — merged from Custom Agent Foundry + Skill Foundry; loads `agent-builder` and `skill-builder` skills)_
- Handoff _(utility)_
- Software Engineer Agent _(generic fallback)_
- CI Monitor Subagent _(thin MCP helper)_
- App Store Deployment Expert _(distinct domain — code signing, store submission)_
- Code Reviewer → made framework-agnostic _(strip Vue/Fastify specifics, load skills dynamically)_
- Test Writer → made framework-agnostic _(strip Vitest/Vue specifics, load skills dynamically)_

> Code Reviewer and Test Writer count as "kept" but get updated to be framework-agnostic.

### Agents to Delete (12)

- `android-kotlin-expert.agent.md`
- `api-architect.agent.md`
- `caddy-expert.agent.md`
- `docker-expert.agent.md`
- `fastify-expert.agent.md`
- `flutter-expert.agent.md`
- `mobile-uiux-expert.agent.md`
- `pocketbase-expert.agent.md`
- `pwa-expert.agent.md`
- `supabase-expert.agent.md`
- `swiftui-expert.agent.md`
- `vuejs-expert.agent.md`

---

## Phases

### Phase 1: Rebuild Skills with Research — ✅ COMPLETE

All 7 skills rebuilt from scratch using Context7 research:

| Skill                | Files | Lines  |
| -------------------- | ----- | ------ |
| `pocketbase-pro`     | 12    | 1,766  |
| `android-kotlin-pro` | 12    | 2,261  |
| `flutter-pro`        | 12    | ~1,800 |
| `mobile-uiux-pro`    | 10    | 1,753  |
| `docker-pro`         | 7     | 1,760  |
| `caddy-pro`          | 9     | 1,905  |
| `api-design-pro`     | 13    | 2,433  |

### Phase 2: Build Generic Agents

Each generic agent:

- Has a generic body with universal engineering principles for its domain
- Contains a skill-loading directive that detects the framework and loads the right skill
- Has proper `tools:` and `handoffs:` frontmatter
- Does **not** contain framework-specific code examples (those live in skills)

Build order:

- [x] Backend Engineer
- [x] Infrastructure Engineer
- [x] Mobile Engineer
- [x] Frontend Engineer (Web)
- [x] Architect
- [x] Full-Stack Engineer

### Phase 3: Update Supporting Agents

- [x] Make Code Reviewer framework-agnostic — strip project-specific checklists, load framework skills dynamically
- [x] Make Test Writer framework-agnostic — strip Vitest/Vue Test Utils specifics, load framework skills dynamically

### Phase 4: Delete Retired Agents — ✅ COMPLETE

- [x] Delete the 12 retired `.agent.md` files listed above
- [x] Fix stale handoff references in `context7.agent.md` and `app-store-deployment-expert.agent.md` (pointed to deleted agents)

### Phase 5: Update Routing and Handoffs

- [x] Merge Custom Agent Foundry + Skill Foundry → single **Foundry** agent (`foundry.agent.md`), loading `agent-builder` and `skill-builder` skills
- [x] Rebuild `rug-routing/SKILL.md` with new agent roster, updated routing rules (file patterns → agent mapping), updated bug triage table, updated handoff matrix
- [x] Update all remaining agents' `handoffs:` frontmatter to reference new generic agent names
- [x] Update RUG Orchestrator if needed

### Phase 6: Validation

- [ ] Verify all agent files parse correctly (valid YAML frontmatter)
- [ ] Verify all skill references in agents point to existing skill files
- [ ] Verify all handoff references point to existing agents
- [ ] Verify rug-routing references match actual agent names

---

## Handoff Reference Table

When old agent names appear in handoffs, map them to:

| Old Agent Name                  | New Agent Name          |
| ------------------------------- | ----------------------- |
| Fastify Expert                  | Backend Engineer        |
| PocketBase Expert               | Backend Engineer        |
| Supabase Expert                 | Backend Engineer        |
| Expert Vue.js Frontend Engineer | Frontend Engineer       |
| Vue.js Expert                   | Frontend Engineer       |
| PWA Expert                      | Frontend Engineer       |
| SwiftUI Expert                  | Mobile Engineer         |
| Android Kotlin Expert           | Mobile Engineer         |
| Flutter Expert                  | Mobile Engineer         |
| Mobile UI/UX Expert             | Mobile Engineer         |
| Docker Expert                   | Infrastructure Engineer |
| Caddy Expert                    | Infrastructure Engineer |
| API Architect                   | Architect               |

---

## Skills Inventory (20 total)

All skills at `.github/skills/`:

| Skill                     | Consumed By                                   |
| ------------------------- | --------------------------------------------- |
| `fastify-pro`             | Backend Engineer                              |
| `supabase-pro`            | Backend Engineer                              |
| `pocketbase-pro`          | Backend Engineer                              |
| `dotnet-server`           | Backend Engineer                              |
| `dotnet-migration`        | Backend Engineer                              |
| `golang-api`              | Backend Engineer                              |
| `vue-pro`                 | Frontend Engineer                             |
| `pwa-pro`                 | Frontend Engineer                             |
| `swiftui-pro`             | Mobile Engineer                               |
| `android-kotlin-pro`      | Mobile Engineer                               |
| `flutter-pro`             | Mobile Engineer                               |
| `mobile-uiux-pro`         | Mobile Engineer                               |
| `api-design-pro`          | Architect                                     |
| `docker-pro`              | Infrastructure Engineer                       |
| `caddy-pro`               | Infrastructure Engineer                       |
| `monitor-ci`              | CI Monitor Subagent                           |
| `link-workspace-packages` | Infrastructure Engineer / Full-Stack Engineer |
| `rug-routing`             | RUG Orchestrator                              |
| `agent-builder`           | Foundry                                       |
| `skill-builder`           | Foundry                                       |
