---
# CUSTOMIZE: Adjust globs to match where your architecture docs live.
# This loads ONLY when editing documentation files — never during coding.
# Architecture context is high-value but should never load during routine
# code editing where it's irrelevant.
#
# Token budget: target ≤ 1,000 tokens (≈ 4 KB) for this file.
# Estimate: wc -c .github/instructions/architecture.instructions.md | awk '{print $1/4 " tokens"}'
applyTo: '**/docs/**,**/architecture/**,**/adr/**,**/*.md'
---

# Architecture Overview

<!-- CUSTOMIZE: Replace this entire section with your actual architecture.
     Keep it brief — this is a high-level map, not a deep-dive. Detailed
     content belongs in docs/ where it can be read lazily as needed. -->

## System Overview

[2–4 sentences describing what this system does and its primary users.]

## Service Topology

<!-- CUSTOMIZE: A brief diagram or list of the major services/components
     and how they relate. For a monolith, list the major layers instead. -->

```
[e.g.
  Browser / Mobile App
       ↓
  API Gateway (authenticate, rate-limit)
       ↓
  App Server (business logic)
    ├── PostgreSQL (primary store)
    ├── Redis (cache + sessions)
    └── S3 (file storage)
       ↓
  Worker (async jobs via queue)
]
```

## Layer Responsibilities

<!-- CUSTOMIZE: What each architectural layer owns. -->

| Layer               | Owns                                         | Does NOT own                        |
| ------------------- | -------------------------------------------- | ----------------------------------- |
| [e.g. API / Routes] | [e.g. HTTP contract, input validation, auth] | [e.g. business logic, DB access]    |
| [e.g. Services]     | [e.g. business rules, orchestration]         | [e.g. HTTP, raw SQL]                |
| [e.g. Repositories] | [e.g. data access, query construction]       | [e.g. business rules, HTTP]         |
| [e.g. Workers]      | [e.g. async/background processing]           | [e.g. synchronous request handling] |

## Key Data Flows

<!-- CUSTOMIZE: Describe 1–2 most important request flows through the system.
     These anchor architectural understanding for doc authors. -->

### [Flow 1: e.g. User Authentication]

```
[e.g. POST /auth/login → validate credentials → issue JWT → return token]
```

### [Flow 2: e.g. Primary Data Write]

```
[e.g. POST /resource → validate → service → repository → DB → emit event]
```

## Architecture Decision Records

<!-- CUSTOMIZE: Link to your ADR directory and describe the format used. -->

- ADRs live in: [e.g. `docs/adr/`]
- Format: [e.g. "MADR (Markdown Architectural Decision Records)"]
- Status lifecycle: [e.g. "Proposed → Accepted → Deprecated → Superseded"]
- Referencing from code: [e.g. "// See: docs/adr/0012-repository-pattern.md"]

## Constraints & Non-Negotiables

<!-- CUSTOMIZE: Hard architectural rules that must not be violated. -->

- [e.g. "No direct DB access from the API layer — always go through services"]
- [e.g. "No synchronous calls to external services in the request path — use queues"]
- [e.g. "All inter-service communication via typed contracts in `src/contracts/`"]
