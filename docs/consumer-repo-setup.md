# Consumer Repo Setup

Sync agents and skills from the agent-repo **into a specific repository**. Updates propagate automatically via GitHub Actions PRs.

Use this approach when:

- You want agents/skills committed into the repo so all contributors get them without a global install
- You need per-repo control over which skills are synced
- You want automated PRs when upstream updates ship

---

## How It Works

```
┌─────────────────────┐       dispatch event        ┌──────────────────────┐
│                     │  ──────────────────────────▶ │  consumer-repo       │
│    agent-repo       │                              │                      │
│  (push to main)     │                              │  runs sync.mjs       │
└─────────────────────┘                              │  opens PR            │
                                                     └──────────────────────┘
```

- **Agents** — All source agents sync to `.github/agents/` by default, except names in `excludeAgents`
- **Skills** — Only skills listed in the `skills` array sync to `.github/skills/`
- **Scaffold skills** — Auto-created from templates when required by an agent (never overwritten)
- **Instructions** — `.github/copilot-instructions.md` is **never** synced (repo-specific)

---

## Quick Start

### 1. Create `.copilot-deps.json`

```json
{
  "source": "your-org/agent-repo",
  "ref": "main",
  "excludeAgents": ["product-owner"],
  "skills": ["docker-pro", "fastify-pro", "vue-pro"]
}
```

| Field           | Required | Description                                                    |
| --------------- | -------- | -------------------------------------------------------------- |
| `source`        | Yes      | GitHub `owner/repo` of the agent-repo                          |
| `ref`           | No       | Branch/tag to sync from (default: `main`)                      |
| `excludeAgents` | No       | Agent names to skip — all others sync by default               |
| `skills`        | No       | Skills to sync — only listed skills are copied (default: none) |

### 2. Copy `sync.sh` into the Repo Root

```sh
# From the agent-repo or download it
cp /path/to/agent-repo/sync.sh ./sync.sh
chmod +x sync.sh
git add sync.sh .copilot-deps.json && git commit -m "chore: add copilot deps sync"
```

### 3. Run Initial Sync

```sh
./sync.sh
```

The script reads `.copilot-deps.json`, clones the agent-repo at the configured ref, runs `sync.mjs`, and cleans up.

### 4. (Optional) Automated Sync via GitHub Actions

For automatic PRs when the agent-repo updates:

1. Copy `consumer-workflow.yml` → `.github/workflows/sync-copilot-deps.yml`
2. Add the repo to `consumers.json` in the agent-repo
3. Ensure a `COPILOT_SYNC_PAT` secret with `repo` scope is accessible

---

## What Gets Synced

| Content               | Destination              | Behavior                                                           |
| --------------------- | ------------------------ | ------------------------------------------------------------------ |
| Agents                | `.github/agents/`        | All except `excludeAgents`; removed agents are cleaned up          |
| Skills                | `.github/skills/<name>/` | Only those in `skills` array                                       |
| Scaffold skills       | `.github/skills/<name>/` | Auto-created once, never overwritten                               |
| Instruction templates | `instruction-templates/` | Synced for reference (optional, see below)                         |
| Docs                  | `docs/`                  | Merged — source files added/updated, consumer-only files preserved |

### Opting Out of Templates and Docs

Instruction templates and docs sync by default in consumer mode. If you don't want them:

- **Templates**: Delete `instruction-templates/` after sync and add it to `.gitignore`. Or copy the ones you need into `.github/instructions/` and customize them — the synced copies in `instruction-templates/` are reference material only.
- **Docs**: The `docs/` merge is additive (never deletes your files). Source docs like `token-optimization.md` are reference material.

See [Instruction Templates](./instruction-templates.md) for how to use these effectively.

---

## Syncing New Agents

When the agent-repo adds new agents, sync will:

1. Print a `🆕 New agents available` message listing them
2. Sync them into `.github/agents/`
3. Note: Add names to `excludeAgents` if you don't want them

---

## Skill Dependencies

Some agents require specific skills. Dependencies declared in `skill-deps.json` are checked during sync:

- **Bundled** deps — Normally satisfied because you list them in `skills`
- **Scaffold** deps — Auto-created from `skill-templates/` if missing (e.g., `local-routing` for `rug-orchestrator`)

---

## Migrating from Opt-In Format

If your `.copilot-deps.json` uses the old `agents` array, `sync.mjs` will refuse to run. Replace it:

**Before (deprecated):**

```json
{
  "source": "your-org/agent-repo",
  "agents": ["architect", "backend-engineer"],
  "skills": ["vue-pro", "fastify-pro"]
}
```

**After:**

```json
{
  "source": "your-org/agent-repo",
  "excludeAgents": [
    "app-store-deployment-expert",
    "ci-monitor-subagent",
    "product-owner"
  ],
  "skills": ["vue-pro", "fastify-pro"]
}
```

---

## Central Repo Setup (One-Time, for Maintainers)

If you maintain the agent-repo and want to push updates to consumers:

1. Create a **GitHub PAT** with `repo` scope on all consuming repos
2. Add it as `COPILOT_SYNC_PAT` in the agent-repo's Settings → Secrets → Actions
3. Register consumers in `consumers.json`:

```json
{
  "repos": ["your-org/consumer-repo-1", "your-org/consumer-repo-2"]
}
```

---

## Checklist

- [ ] Create `.copilot-deps.json` in repo root
- [ ] Copy `sync.sh` into repo root, `chmod +x`, commit
- [ ] Run `./sync.sh` for initial sync
- [ ] (Optional) Add repo to `consumers.json` in agent-repo
- [ ] (Optional) Copy `consumer-workflow.yml` → `.github/workflows/sync-copilot-deps.yml`
- [ ] (Optional) Ensure `COPILOT_SYNC_PAT` secret is accessible
