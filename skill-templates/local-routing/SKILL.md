---
name: local-routing
description: >-
  Repo-specific routing overrides for the RUG orchestrator. Customizations here
  take precedence over the canonical rug-routing rules synced from agent-repo.
  Add file-pattern overrides, custom triage rules, and repo-specific routing preferences.
---

# Local Routing Overrides

This file customizes routing on top of the defaults from `rug-routing/SKILL.md`. RUG reads rug-routing first, then applies any rules here on top.

- **Add** new file-pattern routes or triage rules that don't exist in the base
- **Override** specific base defaults when a more repo-specific route exists
- Base rug-routing rules apply for anything not explicitly overridden

---

## File Pattern Overrides

Add rows to reroute specific file patterns to a different agent than the rug-routing default.

| File Pattern / Path | Route To        | Notes                 |
| ------------------- | --------------- | --------------------- | --------------------------------------------- | --- |
| <!--                | `apps/admin/**` | **Frontend Engineer** | Admin panel uses Vue, not generic SW Engineer | --> |

---

## Bug Triage Overrides

Add rows to reroute specific bug symptoms to a different agent than the rug-routing default.

| Symptoms | Primary Diagnosis Agent | Notes                |
| -------- | ----------------------- | -------------------- | --------------------------------------------- | --- |
| <!--     | Stripe webhook failures | **Backend Engineer** | All payment logic is server-side in this repo | --> |

---

## Custom Routing Rules

Add any repo-specific routing notes or constraints here. These are free-form instructions that RUG will follow.

<!-- Example:
- Always route database migration files (`migrations/**`) to Backend Engineer, never Infra.
- For PRs touching both `apps/api` and `apps/web`, prefer Full-Stack Engineer over splitting.
-->
