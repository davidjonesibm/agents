---
applyTo: '**'
---

# Agent-Repo Codebase Instructions

This is the **agent-repo** — a centralized distribution system for VS Code Copilot agent definitions and skill packages. It is NOT a web application. Consuming repos declare which skills they need in `.copilot-deps.json`, and updates propagate automatically via GitHub Actions PRs.

## File Structure

| Path                                     | Purpose                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `.github/agents/*.agent.md`              | Agent definitions — core + consumer-requested agents are synced              |
| `.github/skills/<name>/SKILL.md`         | Skill entry points — synced only if a consumer requests them                 |
| `.github/skills/<name>/references/`      | Reference files supporting a skill (synced with the skill)                   |
| `skill-templates/<name>/`                | Templates for scaffold skills (auto-created in consumers, never overwritten) |
| `sync.mjs`                               | Node.js script that copies agents and skills into a consuming repo           |
| `core-agents.json`                       | Array of agent names always synced to every consumer                         |
| `consumers.json`                         | List of consuming repos that receive dispatch events on push to `main`       |
| `skill-deps.json`                        | Declares which skills each agent depends on (bundled or scaffold)            |
| `consumer-workflow.yml`                  | GitHub Actions workflow template consumers copy to their repo                |
| `.github/workflows/notify-consumers.yml` | Dispatches `copilot-deps-update` events to consumers on push                 |
| `.github/copilot-instructions.md`        | This file — **never synced** (each repo has its own)                         |

## Agent File Conventions

Agent files live in `.github/agents/` with kebab-case filenames (e.g., `code-reviewer.agent.md`).

**Required YAML frontmatter:**

```yaml
---
name: Human-Readable Name
description: One-line description shown in VS Code chat input
tools: [tool-category-or-id, ...]
---
```

**Optional frontmatter fields:** `argument-hint`, `agents` (sub-agents), `handoffs` (with `label`, `agent`, `prompt`, `send`).

**Conventions:**

- Use tool category wildcards (e.g., `search`, `edit`, `read`) over individual tool IDs when possible.
- Every agent must have a clear, specific `description:` — it appears in the VS Code UI.
- Write imperative, unambiguous instructions in the body — "Always do X", "Never do Y".
- If an agent requires a skill, add the dependency to `skill-deps.json`.

## Skill File Conventions

Each skill is a directory under `.github/skills/<skill-name>/` containing at minimum a `SKILL.md`.

**Required YAML frontmatter in SKILL.md:**

```yaml
---
name: skill-name
description: >-
  Multi-line description. This is used for skill discovery and matching.
  Include trigger keywords and file patterns.
---
```

**Skill structure:**

- `SKILL.md` — entry point with frontmatter, review process, core instructions, and output format.
- `references/` — optional directory of focused topic files (e.g., `patterns.md`, `security.md`, `performance.md`). Cross-reference between files rather than duplicating rules.

**Conventions:**

- Skill directory name must match the `name:` in frontmatter.
- The `description:` field drives skill discovery — include relevant trigger keywords.
- Prefer density over length — actionable rules with code examples beat verbose prose.
- Every rule should have a before/after example when applicable.

## Sync System

**`sync.mjs`** runs in a consuming repo's root directory. It reads `.copilot-deps.json` from the consumer and:

1. **Agents** — syncs core agents (listed in `core-agents.json`) plus any additional agents the consumer lists in their `agents` array. Agents in the requested set that no longer exist in the source are removed; agents not in the requested set are left alone.
2. **Skills** — copies only skills listed in the consumer's `skills` array. Does a clean replace (deletes and re-copies the skill directory).
3. **Skill dependencies** — reads `skill-deps.json` and checks:
   - `bundled` deps: warns if the skill is missing from the consumer's `skills` array.
   - `scaffold` deps: auto-creates from `skill-templates/` if not already present. Never overwrites existing scaffold skills.

**`consumers.json`** lists repos that receive `repository_dispatch` events when agent-repo pushes to `main`.

**`skill-deps.json`** maps agent names (without `.agent.md`) to their skill requirements:

```json
{
  "agent-name": {
    "skills": [{ "name": "skill-name", "type": "bundled" }]
  }
}
```

## Adding a New Agent

1. Create `.github/agents/<name>.agent.md` with proper frontmatter (`name`, `description`, `tools`).
2. Write the agent body with clear role, instructions, and output format.
3. If the agent requires specific skills, add an entry to `skill-deps.json`.
4. Update `README.md` if the agent introduces new concepts or workflows.

## Adding a New Skill

1. Create `.github/skills/<skill-name>/SKILL.md` with frontmatter (`name`, `description`).
2. Add `references/` directory with focused topic files if the skill has substantial content.
3. Add the skill to the **Available Skills** table in `README.md`.
4. If any agent depends on this skill, add it to `skill-deps.json` under that agent.

## Testing Changes

Run `sync.mjs` locally against a consuming repo to verify changes:

```sh
# From the consuming repo's root:
node /path/to/agent-repo/sync.mjs
```

The script prints a summary of added, updated, and removed files. Check that:

- New agents appear in the "Added" list.
- Updated skills show as synced.
- No unexpected removals occur.
- Skill dependency warnings are resolved.

## Do NOT

- Put application-framework conventions in this file — it is not a web app repo.
- Sync `copilot-instructions.md` — each consuming repo maintains its own.
- Overwrite scaffold skills in consumers — they are customized per-repo and must be preserved.
- Invent conventions that don't exist in the codebase — base everything on observed patterns.
- Modify `sync.mjs` without testing against at least one consumer repo.
