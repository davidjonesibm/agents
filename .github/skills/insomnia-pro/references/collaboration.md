# Collaboration

Storage backends, sync strategies, secret management, and import/export formats in Insomnia 12.5+.

## Storage Backends

Every Insomnia project uses one storage backend. Choose at project creation — you cannot change it later without migration.

| Backend         | Where data lives        | Sync                  | Secrets               | Best for                                   |
| --------------- | ----------------------- | --------------------- | --------------------- | ------------------------------------------ |
| **Local Vault** | Local filesystem only   | None                  | Local only            | Solo, offline, or sensitive projects       |
| **Scratch Pad** | Local, single workspace | None                  | Local only            | Quick ad-hoc testing, no project structure |
| **Cloud Sync**  | Kong-hosted, E2EE       | Real-time             | Not protected by E2EE | Teams without Git, real-time collaboration |
| **Git Sync**    | Third-party Git repo    | On demand (push/pull) | Not synced            | Teams with repo governance, CI/CD          |

**Critical:** Scratch Pad is not designed for team sharing. Do not treat it as a shared workspace.

## Git Sync

### Setup

1. **New Project → Git Sync**.
2. Connect to a GitHub, GitLab, or Bitbucket repository (OAuth or Personal Access Token).
3. Insomnia stores the collection as YAML files in the repo.

### Workflow

```
// Branch from main for feature work
Insomnia Git pane → Branch → New Branch → feature/add-auth-endpoint

// Make changes in the collection, then commit
Insomnia Git pane → Stage changes → Commit → "Add auth endpoint"

// Push to remote
Insomnia Git pane → Push

// Pull latest from a teammate
Insomnia Git pane → Pull (3-way merge if conflicts)
```

### What Gets Stored

Git Sync stores the collection as YAML. This includes:

- Request definitions (URL, method, headers, body)
- Folder structure
- Base environments
- Scripts
- Design Documents (OpenAPI specs)

**Critical: Private sub-environments and Vault secrets are NOT included in Git Sync.** Each developer must configure their own private sub-environment locally.

```json
// Before — team member expects secrets in the repo
// Base environment in repo:
{ "base_url": "https://api.example.com", "api_key": "sk-live-abc123" }
// Problem: api_key is now in Git history

// After — base environment has placeholder only
{ "base_url": "https://api.example.com", "api_key": "" }
// Each developer adds a private sub-environment locally with the real api_key
```

### 3-Way Merge

When two developers edit different requests in the same collection, Insomnia performs a 3-way merge automatically. Conflicts (same request edited by both) require manual resolution in the Git pane.

## Cloud Sync

- Stores data on Kong-hosted servers with end-to-end encryption (E2EE).
- Real-time sync — changes appear on collaborators' machines immediately.
- Supports **branches** (object-level, distinct from Git branches).
- Share with teammates by inviting them to the organization in Insomnia.

**When to choose Cloud Sync over Git Sync:**

- Team does not use or want a Git repository for API collections.
- Real-time collaboration is preferred over commit-based workflow.
- No CI/CD pipeline needs the collection files as YAML.

**When NOT to use Cloud Sync:**

- Repo governance is required (PR reviews, audit history, CI triggers).
- The collection must be linted or tested via Inso CLI in CI — use Git Sync to expose files.

## Secret Management

| Method                      | Security                 | Synced?             | Best for                  |
| --------------------------- | ------------------------ | ------------------- | ------------------------- |
| **Private sub-environment** | Local only, not exported | No                  | Per-developer secrets     |
| **Insomnia Vault**          | Encrypted locally        | No                  | Shared secret templates   |
| **Base environment**        | Plaintext in export      | Yes (both backends) | Non-sensitive config only |
| **External vault (script)** | Depends on vault         | No                  | Enterprise secrets        |

See `references/environments.md` for the canonical before/after example of secrets in base environments and vault access patterns.

## Import Formats

Insomnia can import from:

| Format                    | Notes                                    |
| ------------------------- | ---------------------------------------- |
| **Insomnia JSON v4 / v5** | Native format — full fidelity            |
| **Postman v2.0 / v2.1**   | Migrating from Postman                   |
| **OpenAPI 3.0 / 3.1**     | Import spec to create a collection       |
| **Swagger 2.0**           | Legacy support                           |
| **HAR**                   | Browser DevTools exports                 |
| **cURL**                  | Paste a cURL command to create a request |
| **WSDL**                  | SOAP service definitions                 |

```bash
# Import from URL via drag-and-drop or File → Import
# Or use the CLI:
inso export spec "My API" --output openapi.yaml   # export only; import is UI-only
```

**Note:** Import from Postman maps `pm.*` environment calls to Insomnia equivalents where possible, but script logic using `pm.*` APIs must be manually migrated to the `insomnia.*` API.

## Export Formats

| Format                | Use case                                          |
| --------------------- | ------------------------------------------------- |
| **Insomnia JSON v4**  | Backup, CI input for Inso CLI                     |
| **Insomnia JSON v5**  | Newer format, preferred for new exports           |
| **HAR**               | Share request/response logs with other tools      |
| **OpenAPI (via CLI)** | `inso export spec` — exports design document spec |

Commit the Insomnia JSON export to your repository to enable `inso run collection` and `inso lint spec` in CI pipelines (see `references/cli.md`).

## Anti-Patterns

- **Secrets in base environments** — they appear in exports and in Git history. Use private sub-environments or Vault.
- **Using Scratch Pad for team collaboration** — it has no sync mechanism. Use Git Sync or Cloud Sync.
- **Choosing Cloud Sync for CI/CD pipelines** — Cloud Sync does not expose files to the filesystem. Use Git Sync so Inso CLI can read the YAML files.
- **Not committing `.spectral.yaml`** — custom lint rules belong in source control alongside the spec (see `references/design-first.md`).

See also `references/environments.md` for private sub-environment setup. See also `references/design-first.md` for Git Sync in the design-first workflow.
