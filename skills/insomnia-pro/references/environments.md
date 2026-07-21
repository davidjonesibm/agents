# Environments

Environment system in Insomnia 12.5+: scopes, resolution order, base vs sub-environments, private sub-environments, vault access, and variable best practices.

## Scopes and Resolution Order

Insomnia resolves variables from **most specific to least specific**:

```
Folder sub-environment
  → Collection sub-environment (active)
    → Collection base environment
      → Global sub-environment (active)
        → Global base environment
```

The **active** sub-environment overrides the base of the same scope. Folder environments override collection-level values for requests inside that folder.

```json
// Collection base environment — defaults for everyone
{ "base_url": "https://api.example.com", "timeout": 5000 }

// Collection sub-environment "Staging" — overrides base_url only
{ "base_url": "https://staging.api.example.com" }

// Resolution result when "Staging" is active:
// base_url = "https://staging.api.example.com"  (from sub-env)
// timeout  = 5000                                (from base env)
```

## Variable Syntax

Reference variables in URLs, headers, bodies, and script values:

```
{{ variable_name }}
```

```
// In request URL:
{{ base_url }}/users/{{ user_id }}

// In header value:
Authorization: Bearer {{ access_token }}

// In JSON body:
{ "tenantId": "{{ tenant_id }}" }
```

Use **Ctrl+Space** inside any value field to trigger autocomplete for available variables.

## Base Environments vs Sub-Environments

| Concept                     | Use For                                      |
| --------------------------- | -------------------------------------------- |
| **Base environment**        | Shared defaults (URLs, non-secret config)    |
| **Sub-environment**         | Stage-specific or persona-specific overrides |
| **Private sub-environment** | Secrets — never exported, never synced       |

```json
// Before — secrets in base environment (WRONG — synced and exported)
{
  "base_url": "https://api.example.com",
  "api_key": "sk-live-abc123"
}

// After — base environment holds only non-sensitive defaults
{
  "base_url": "https://api.example.com",
  "api_key": ""
}

// Private sub-environment "Live Secrets" holds the actual key
// (marked with lock icon, never exported or synced)
{
  "api_key": "sk-live-abc123"
}
```

**Critical:** A private sub-environment must be **activated** alongside the base environment. It is not a fallback — it replaces the base values it overrides.

## Folder-Level Environments

Add a folder environment to scope variables to a subset of requests:

```json
// Folder "Admin Endpoints" has its own environment
{
  "role": "admin",
  "endpoint_prefix": "/admin"
}
// Requests in this folder see role=admin; requests outside see role from collection env
```

Folder environments also support auth and header inheritance — set a Bearer token at folder level and all requests inside inherit it without repeating it per request.

## Vault Access from Scripts

Access Vault-stored secrets in scripts (requires **Settings → Enable Vault** toggle):

```javascript
// Pre-request script — read a Vault secret by exact display name
const secret = await insomnia.vault.get('MY_SECRET_KEY');
insomnia.environment.set('dynamic_token', secret);
```

**Critical:** `insomnia.vault.get()` takes the **display name** of the vault entry, not the variable name. This feature requires the preference toggle to be enabled.

## Iteration Data

When using the Collection Runner with a CSV or JSON data file, access row values in scripts:

```javascript
// After-response script — read current iteration row
const username = insomnia.iterationData.get('username');
const password = insomnia.iterationData.get('password');
insomnia.environment.set('current_user', username);
```

`insomnia.iterationData` is read-only — it reflects the data file row for the current iteration.

## Best Practices

- **Keep base environments non-secret.** Only put URLs, timeouts, and non-sensitive config there.

```json
// Before — secret leaks into Git history and exports
{ "base_url": "https://api.example.com", "api_key": "sk-live-abc123" }

// After — base env holds only non-sensitive defaults
{ "base_url": "https://api.example.com", "api_key": "" }
// Real api_key lives in a private sub-environment (lock icon)
```

- **One sub-environment per stage** (Dev, Staging, Production). Never create per-developer environments for shared secrets — use private sub-environments or Vault.

```json
// Sub-environment "Dev"
{ "base_url": "https://dev.api.example.com" }

// Sub-environment "Staging"
{ "base_url": "https://staging.api.example.com" }

// Sub-environment "Production"
{ "base_url": "https://api.example.com" }

// Each developer's personal secrets go in their own private sub-environment (not shared)
// Anti-pattern: sub-environment "Alice's secrets" shared with the team
```

- **Never hard-code secrets in request bodies or URLs.** Always reference `{{ variable }}`.
- **Use descriptive variable names.** `{{ auth_token }}` beats `{{ token }}` in multi-auth collections.
- **Document environment variables** with comments in the JSON editor (Insomnia allows `//` style comments in its JSON parser for the environment editor).

```json
// Before — undocumented, purpose unclear
{ "timeout": 5000, "retry": 3 }

// After — commented for teammates
{
  // Maximum request timeout in ms; increase to 30000 for batch endpoints
  "timeout": 5000,
  // Number of retries on 5xx responses (set to 0 to disable)
  "retry": 3
}
```

See also `references/scripting.md` for how scripts read and write environment variables at runtime. See also `references/collaboration.md` for how private sub-environments behave under Git Sync and Cloud Sync.
