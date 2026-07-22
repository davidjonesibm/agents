# Source Repo Fork (Org-Specific Agent Repo)

Create an org-specific fork of the agent-repo that pulls upstream updates **without overwriting** your custom agents and skills, then redistributes everything to its own consumers.

Use this approach when:

- Your org needs private/proprietary agents or skills alongside the shared ones
- You want to curate which upstream content reaches your consumers
- You need org-specific routing rules or agent configurations

---

## Architecture

```
┌─────────────────────────┐          source-repo sync          ┌─────────────────────────┐
│  upstream agent-repo    │  ─────────────────────────────────▶ │  org fork (source)      │
│  (this repo)            │     mirrors agents/, skills/,       │                         │
│                         │     skill-templates/, sync.mjs      │  + org-specific agents  │
│  agents/                │                                     │  + org-specific skills  │
│  skills/                │                                     │  + custom routing       │
└─────────────────────────┘                                     └───────────┬─────────────┘
                                                                            │
                                                                  consumer sync (default)
                                                                            │
                                                                            ▼
                                                                ┌─────────────────────────┐
                                                                │  consumer-repo-1        │
                                                                │  .github/agents/        │
                                                                │  .github/skills/        │
                                                                └─────────────────────────┘
```

---

## How It Works

In source-repo mode (`"type": "source"`), `sync.mjs` pulls upstream content into your fork — adding and updating upstream files while **preserving your custom content**:

| What Gets Synced         | Target in Fork           | Behavior                                                                                            |
| ------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------- |
| `agents/`                | `agents/`                | **Merged** — upstream added/updated, fork-only agents kept                                          |
| `skills/`                | `skills/`                | **Merged** — upstream added/updated, fork-only skills kept                                          |
| `.github/`               | `.github/`               | **Merged** — workflows, CODEOWNERS, etc. (excludes `copilot-instructions.md`, `agents/`, `skills/`) |
| `skill-templates/`       | `skill-templates/`       | Full overwrite — enables scaffolding for the fork's consumers                                       |
| `docs/`                  | `docs/`                  | Full overwrite of reference docs                                                                    |
| `instruction-templates/` | `instruction-templates/` | Full overwrite                                                                                      |
| All other root files     | root                     | Auto-mirrored (excludes `.copilot-deps.json`, `consumers.json`, `CLAUDE.md`)                        |

**Important:** `excludeAgents` and `skills` fields are ignored in source-repo mode.

---

## Setup

### 1. Create `.copilot-deps.json`

```json
{
  "type": "source",
  "source": "upstream-org/agent-repo",
  "ref": "main"
}
```

### 2. Add `sync.sh` and Run Initial Sync

```sh
cp /path/to/upstream-agent-repo/sync.sh ./sync.sh
chmod +x sync.sh
git add sync.sh .copilot-deps.json && git commit -m "chore: configure as forked source repo"
./sync.sh
```

### 3. Add Your Custom Content

After initial sync, add org-specific agents and skills alongside the upstream ones:

```
org-agent-repo/
├── agents/
│   ├── software-engineer.agent.md    ← from upstream
│   ├── foundry.agent.md              ← from upstream
│   └── org-deploy-agent.agent.md     ← org-specific (custom)
├── skills/
│   ├── react-pro/                    ← from upstream
│   ├── docker-pro/                   ← from upstream
│   └── org-terraform/                ← org-specific (custom)
├── skill-templates/
│   └── local-routing/                ← from upstream (fork customizes)
├── .copilot-deps.json                ← type: source
├── consumers.json                    ← fork's own consumer list
├── init-templates.mjs                ← from upstream
├── init-templates.sh                 ← from upstream
├── install.mjs                       ← from upstream
├── install.sh                        ← from upstream
├── sync.mjs                          ← from upstream
└── sync.sh                           ← from upstream
```

### 4. Configure Downstream Distribution

Set up the fork to push to its own consumers:

1. Create `consumers.json` listing your org's repos
2. Add `COPILOT_SYNC_PAT` secret with `repo` scope on consumer repos
3. Copy `.github/workflows/notify-consumers.yml` from upstream (or create your own)

---

## How Custom Content Is Preserved

When you re-sync from upstream:

- **`agents/` and `skills/` are merged** — upstream files are added or updated, but fork-only files (your custom agents/skills) are never deleted
- **`skill-templates/`, `docs/`, `instruction-templates/` are overwritten** — these are reference material from upstream
- **Infrastructure files** (`sync.mjs`, `sync.sh`, etc.) are overwritten to keep tooling current
- **Collision handling**: If upstream adds an agent or skill with the same name as your custom one, the upstream version will overwrite yours. Use org-prefixed names (e.g., `org-terraform`, `org-deploy-agent`) to prevent this.

---

## Keeping the Fork Updated

### Manual

```sh
./sync.sh
git add -A && git commit -m "chore: sync upstream agent-repo"
```

### Automated (GitHub Actions)

Use the same `consumer-workflow.yml` pattern — the upstream agent-repo dispatches events to your fork, which runs sync and opens a PR.

Add your fork to upstream's `consumers.json`:

```json
{
  "repos": ["your-org/org-agent-repo", "your-org/consumer-1"]
}
```

---

## Fork's Consumers

When the fork's own consumers sync (using standard consumer mode), they receive **both** upstream and org-specific agents/skills in `.github/agents/` and `.github/skills/`.

The fork acts as a transparent layer — consumers don't need to know or care that some content originated upstream.

---

## Global Install from the Fork

The fork can also be used with `install.mjs` for global installs, distributing both upstream and custom content:

```sh
cd /path/to/org-agent-repo
node install.mjs --targets copilot,claude
```

---

## Checklist

- [ ] Create `.copilot-deps.json` with `"type": "source"` in fork root
- [ ] Copy `sync.sh`, make executable, commit
- [ ] Run initial sync: `./sync.sh`
- [ ] Add org-specific agents/skills with org-prefixed names
- [ ] Set up `consumers.json` for the fork's downstream repos
- [ ] Add `COPILOT_SYNC_PAT` secret for downstream dispatch
- [ ] (Optional) Add fork to upstream's `consumers.json` for automated sync
