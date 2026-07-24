# Lift-and-Shift Playbook

Step-by-step pipeline for migrating a legacy system to a modern stack using the three-phase model.

## Overview

Lift-and-shift is the canonical use case for the three-phase pipeline. The legacy system is the input; the modern system is the output. Sonnet makes the translation decisions once; Haiku executes them many times.

## Pipeline

```
Phase 1: INGEST legacy system (T3 — Haiku × N)
  ├── Inventory all interfaces, types, and public APIs
  ├── Map call graph per entry point
  ├── Document data models and relationships
  └── Flag legacy patterns that need modernization

Phase 2: PLAN translation (T2 — Sonnet × 1)
  ├── Design modern architecture (modules, layers, patterns)
  ├── Create mapping table: legacy component → modern equivalent
  ├── Decide what to preserve vs. redesign
  ├── Produce per-file task specs with pattern references
  └── Order by dependency (foundations first)

Phase 3: EXECUTE translation (T3 — Haiku × N)
  ├── Group 1: Foundation (types, interfaces, config) — parallel
  ├── Group 2: Data layer (repositories, models) — parallel
  ├── Group 3: Business logic (services) — parallel
  ├── Group 4: API/UI layer (routes, components) — parallel
  └── Group 5: Tests — parallel per module
```

## Phase 1: Legacy Ingestion

### What to Capture

| Category                  | What to Document                                            | Why                                                      |
| ------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| **Public API surface**    | All exported functions, classes, interfaces with signatures | These are the contract — modern system must satisfy them |
| **Data models**           | All entities, their fields, relationships, and constraints  | Schema migration depends on this                         |
| **Entry points**          | Routes, event handlers, scheduled jobs, CLI commands        | Each becomes a modern implementation target              |
| **External integrations** | Third-party APIs, databases, message queues, file systems   | Must be preserved or replaced                            |
| **Business rules**        | Validation logic, state machines, calculations              | Must be preserved exactly                                |
| **Configuration**         | Environment variables, feature flags, connection strings    | Must be mapped to modern config                          |

### What to Skip

- Implementation details of private functions (only document public signatures)
- CSS/styling specifics (unless migrating UI)
- Build configuration (the modern system uses its own)
- Comments and documentation (capture the behavior, not the docs)

### Ingestion Prompt for Legacy Systems

```
AGENT: Haiku Engineer

YOUR TASK: Read the following legacy source files and produce a structured inventory.
This is for a migration project — document what the modern system must replicate.

FILES TO READ: [list]

OUTPUT FORMAT:
## Public API
[table: name | kind | signature | description]

## Data Models
[table: entity | fields with types | relationships | constraints]

## External Dependencies
[table: what | how used | replaceable?]

## Business Rules
[numbered list of logical rules expressed as: WHEN [condition] THEN [action]]

## State Transitions (if applicable)
[state machine diagram or table]

## Ambiguities
[anything unclear that the planner must decide on]

RULES:
- Document BEHAVIOR, not implementation
- Express business rules in plain logic, not code
- Flag anything that looks like a bug vs. intentional behavior as [AMBIGUOUS]
- Do NOT suggest how to modernize — just document what exists
```

## Phase 2: Translation Planning

### The Mapping Table

The planner's primary output for lift-and-shift is a **mapping table**:

```markdown
## Architecture Decisions

- Modern stack: [framework, language, patterns]
- Module structure: [how legacy maps to modern modules]
- Key pattern changes: [e.g., callbacks → async/await, classes → functions]

## Component Mapping

| Legacy Component         | Modern Equivalent                   | Pattern Reference                | Notes                   |
| ------------------------ | ----------------------------------- | -------------------------------- | ----------------------- |
| UserController (Express) | src/api/users.ts (Fastify)          | src/api/health.ts                | Same route structure    |
| UserModel (Sequelize)    | src/db/user-repository.ts (Drizzle) | src/db/base-repository.ts        | Follow repo pattern     |
| UserService (class)      | src/services/user.ts (functions)    | src/services/auth.ts             | Stateless functions     |
| user.middleware.js       | src/middleware/user.ts              | src/middleware/auth.ts           | Fastify preHandler      |
| UserValidator            | src/schemas/user.ts (Zod)           | src/schemas/auth.ts              | Zod schema pattern      |
| user.test.js             | tests/unit/services/user.test.ts    | tests/unit/services/auth.test.ts | Vitest + same structure |

## Dependency Order

Group 1 (no deps): types, schemas, config
Group 2 (depends on 1): repositories, data models
Group 3 (depends on 2): services, business logic
Group 4 (depends on 3): routes, middleware, API layer
Group 5 (depends on 1-4): tests
```

### Planning Rules for Lift-and-Shift

1. **Establish the pattern first** — Before mass-translating, manually implement ONE representative component at T2 to establish the pattern. Then all others follow it at T3.
2. **Preserve behavior, not structure** — The modern version may have different class/function organization, but must produce identical behavior.
3. **Map every business rule** — Each rule from the ingestion must appear in exactly one task's acceptance criteria.
4. **Create a "pattern file" for each category** — One exemplar route, one exemplar service, one exemplar test. All others reference it.
5. **Handle the first of each kind at T2** — The first route, first service, first test requires judgment (establishing the pattern). All subsequent ones are T3.

## Phase 3: Execution Groups

### Group 1: Foundation (all T3, parallel)

- Types/interfaces
- Configuration files
- Schema definitions (Zod, etc.)
- Shared utilities (if simple translations)

### Group 2: Data Layer (all T3, parallel)

- Database models/entities
- Repository classes
- Migration files

### Group 3: Business Logic (mostly T3, parallel)

- Service functions
- **Exception**: First service of each pattern category → T2 (establishes pattern)

### Group 4: API Layer (all T3, parallel)

- Route handlers
- Middleware
- Request/response schemas

### Group 5: Tests (all T3, parallel)

- Unit tests per service
- Integration tests per route
- **Exception**: First test file → T2 (establishes test patterns and fixtures)

## Validation Between Groups

After each group completes:

1. Run type-checker — all new files must type-check clean
2. Run existing tests (if any) — no regressions
3. Run new tests (from Group 5 if available)

Validation is T3 (Haiku) — binary pass/fail.

## Cost Model Example

For a 30-file Express → Fastify migration:

```
WITHOUT three-phase pipeline (all Sonnet):
  Read 30 files + plan + implement = ~30 T2 subagent calls
  Cost: 30 × $$ = 30$$

WITH three-phase pipeline:
  Phase 1: 6 ingestion tasks (T3) = 6 × $
  Phase 2: 1 planning task (T2) = 1 × $$
  Phase 3: 25 execution tasks (T3) + 2 pattern tasks (T2) = 25$ + 2$$
  Validation: 5 checks (T3) = 5 × $

  Total: 36$ + 3$$ ≈ 36×$ + 3×10$ = 66$ equivalent
  vs. baseline: 30×10$ = 300$ equivalent

  Savings: ~78%
```
