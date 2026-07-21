---
name: insomnia-pro
description: >-
  Comprehensively reviews and guides Insomnia API client workflows for best practices on
  collections, environments, pre-request scripts, after-response scripts, automated testing,
  Inso CLI, plugin development, GraphQL, gRPC, WebSocket, SOAP, design-first OpenAPI workflows,
  Git Sync, Cloud Sync, and collaboration. Use when reading, writing, or reviewing Insomnia
  collections, environment configs, scripts, plugins, or CI pipelines using the Kong Insomnia
  desktop client or inso CLI. Trigger keywords: Insomnia, inso, Kong API client, API collection,
  API testing, pre-request script, after-response script, environment variables, mock server,
  Collection Runner, design document, OpenAPI Insomnia, gRPC Insomnia, WebSocket Insomnia.
---

Review and guide Insomnia 12.5+ workflows for correctness, security, and adherence to best practices across collections, scripts, environments, protocols, CLI automation, and collaboration. Report genuine problems — do not nitpick style preferences.

Review process:

1. Check environment design, variable scoping, and secret handling using `references/environments.md`.
2. Validate pre-request and after-response scripts using `references/scripting.md`.
3. Check CLI configuration and CI/CD integration using `references/cli.md`.
4. Validate plugin code correctness using `references/plugins.md`.
5. Check protocol-specific request configuration using `references/protocols.md`.
6. Review design-first OpenAPI workflow using `references/design-first.md`.
7. Validate collaboration and storage-backend choices using `references/collaboration.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target Insomnia 12.5+ by Kong.
- Unit test suites (Collection Tests tab) are **deprecated** — always guide users toward after-response scripts.
- Never store secrets in base environments that are synced; use private sub-environments or external vaults.
- All script examples use the `insomnia.*` API — never suggest Postman's `pm.*` API.
- Variable references in request URLs, headers, and bodies use `{{ variable_name }}` syntax.
- Prefer the design-first workflow (Design Document → Collection) for new API projects.

## Output Format

Organize findings by file or collection component. For each issue:

1. State the component (collection name, request name, script type, environment name).
2. Name the rule being violated.
3. Show a before/after code fix or configuration example.

Skip components with no issues. End with a prioritized summary.

Example output:

### Auth Collection — Pre-Request Script

**Critical: Extract tokens in after-response scripts, not by duplicating logic.**

```javascript
// Before — duplicating token fetch logic in every pre-request script
const resp = await new Promise((resolve, reject) => {
  insomnia.sendRequest({ url: '...', method: 'POST' }, (err, r) => {
    err ? reject(err) : resolve(r);
  });
});
insomnia.environment.set('token', resp.json().access_token);

// After — run token fetch once in a dedicated "Get Token" request's after-response script
// and store in environment; subsequent requests reference {{ token }}
insomnia.environment.set('token', insomnia.response.json().access_token);
```

### Environment: Production

**Critical: Secret found in base environment — move to private sub-environment.**

```json
// Before (base environment — exported/synced)
{ "api_key": "sk-live-abc123" }

// After (private sub-environment — never exported or synced)
{ "api_key": "sk-live-abc123" }
// Base environment holds only the key name as a placeholder, never the value
{ "api_key": "" }
```

### Summary

1. **Security (critical):** Secret in synced base environment.
2. **Maintainability (high):** Duplicate token-fetch logic across scripts.

End of example.

## References

- `references/environments.md` — Environment scopes, resolution order, private sub-environments, vault access, variable syntax.
- `references/scripting.md` — Pre-request and after-response script API, libraries, testing assertions, migration from unit tests.
- `references/cli.md` — Inso CLI commands, `.insorc` config, CI/CD integration, Docker, GitHub Actions.
- `references/plugins.md` — Plugin extension points, context API, template tags, hooks, publishing.
- `references/protocols.md` — GraphQL, gRPC, WebSocket, SOAP request configuration and best practices.
- `references/design-first.md` — OpenAPI authoring, Spectral linting, collection generation, CLI lint.
- `references/collaboration.md` — Git Sync, Cloud Sync, Local Vault, Scratch Pad, import/export formats.
