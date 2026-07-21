# Global Install

Install agents and skills **once** into your home directory so they apply across every workspace — no per-repo sync needed.

This is the recommended approach for individual developers and small teams.

---

## How It Works

Skills use the open [Agent Skills](https://agentskills.io) standard, making them portable across GitHub Copilot (VS Code + Copilot CLI) and Claude Code. Agents are authored in Copilot `.agent.md` format (YAML-array `tools`, `handoffs`, subagent lists, VS Code tool names) which doesn't map to Claude's sub-agent format — so agents install to the `copilot` target only.

### Install Locations

| Type   | `copilot` target               | `claude` target            |
| ------ | ------------------------------ | -------------------------- |
| Agents | `~/.copilot/agents/*.agent.md` | — (Copilot format only)    |
| Skills | `~/.copilot/skills/<name>/`    | `~/.claude/skills/<name>/` |

### Why Global?

- **No drift** — one update point; no per-repo sync PRs to chase.
- **Progressive loading** — all skills are installed, but only `name` + `description` frontmatter is scanned for discovery. The agent loads a skill's body only when it matches the task, so installing everything is cheap.
- **Portable skills** — the same `~/.copilot` tree serves VS Code and Copilot CLI; add the `claude` target to also install into `~/.claude`.

---

## Prerequisites

- Node.js 18+
- A clone of the agent-repo (or access to `install.sh` which clones it for you)

---

## Install

### Option A: From a Local Clone

```sh
cd /path/to/agent-repo
node install.mjs                          # copilot target (VS Code + CLI)
node install.mjs --targets copilot,claude # both targets
node install.mjs --dry-run                # preview changes, write nothing
node install.mjs --skills-only            # skip agents
node install.mjs --agents-only            # skip skills
```

### Option B: One-Liner (No Clone Needed)

`install.sh` clones the source repo fresh and runs the installer:

```sh
chmod +x install.sh
./install.sh                              # copilot target only
./install.sh --targets copilot,claude     # both targets
```

Share this script with teammates — when an update ships, everyone re-runs it.

---

## Updates

Re-run `install.mjs` (or `install.sh`) whenever you want the latest agents and skills. The installer records what it wrote in a `.agent-repo-manifest.json` at each target root, so re-running it **prunes** agents/skills that were removed upstream without ever touching your own personal agents/skills.

```sh
node install.mjs              # updates + prunes stale items
node install.mjs --no-prune   # updates only, keeps stale items
```

---

## What Stays Per-Repo

Global install covers agents and skills only. These remain project-specific by design:

| File                               | Purpose                                       |
| ---------------------------------- | --------------------------------------------- |
| `.github/copilot-instructions.md`  | Project stack and conventions (always loaded) |
| `*.instructions.md` with `applyTo` | Path-scoped rules for that codebase           |
| `local-routing` scaffold skill     | RUG routing customized per repo               |

Use [`init-templates.sh`](./instruction-templates.md#quick-start) to scaffold these into a new repo:

```sh
# From any repo root:
/path/to/agent-repo/init-templates.sh

# Or with a local clone path:
COPILOT_AGENTS_DIR=/path/to/agent-repo ./init-templates.sh
```

See [Instruction Templates](./instruction-templates.md) for details.

---

## Duplicate Skill Warning

If you install skills to both `copilot` and `claude` targets, VS Code reads both trees and may show duplicate skills. Disable one set via the `chat.agentSkillsLocations` setting if this occurs.

---

## CLI Flags Reference

| Flag                       | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `--targets copilot`        | Install to `~/.copilot` only (default)          |
| `--targets copilot,claude` | Install to both `~/.copilot` and `~/.claude`    |
| `--dry-run`                | Preview what would be written/removed           |
| `--skills-only`            | Install skills, skip agents                     |
| `--agents-only`            | Install agents, skip skills                     |
| `--no-prune`               | Don't remove stale items from previous installs |
