# How to Use RUG

RUG (Repeat Until Good) is a pure orchestration agent that delegates all work to specialist subagents. This guide covers what to expect, how to phrase requests, and example scenarios showing the cost-optimized pipeline in action.

---

## Quick Start

1. Select **RUG** as your agent in VS Code Copilot Chat
2. Describe what you want done (not how to do it)
3. RUG decomposes, delegates, validates, and reports back

You don't need to mention agents, tiers, or planning — RUG handles model selection automatically.

---

## What to Expect

### RUG's Behavior

- **Never writes code itself** — all implementation goes to subagents
- **Creates a todo list** — you'll see task progress tracked in real-time
- **Selects the cheapest effective model** for each task (Haiku for mechanical work, Sonnet for judgment calls)
- **Validates independently** — a separate subagent checks each task's output
- **Retries on failure** — escalates to a more capable model if needed
- **Reports completion** — summarizes what was done with file lists

### Typical Flow

```
You → RUG:  "Add user authentication to the API"

RUG:  1. Scans agents and skills
      2. Loads relevant skills (fastify-pro, api-design-pro, work-planning)
      3. Dispatches planning subagent (Sonnet)
      4. Creates todo list from plan
      5. Dispatches implementation subagents (Haiku for simple files, Sonnet for design)
      6. Dispatches validation subagents (Haiku)
      7. Reports: "Done. 6 files created, all tests pass."
```

### What You See in Chat

- Brief orchestration notes (which agent selected, which skills matched)
- Todo list updates as tasks progress
- Final summary with files changed

You do **not** see the full subagent prompts or their raw output — RUG absorbs that and reports the outcome.

---

## How to Phrase Requests

### Good Prompts (outcome-focused)

```
"Add a user registration endpoint with email validation and password hashing"

"Migrate the Express routes in src/legacy/ to Fastify using our existing patterns"

"Add unit tests for all functions in src/services/order.ts"

"Refactor the payment module to use the repository pattern like src/db/user-repository.ts"
```

### Better Prompts (with constraints)

```
"Add a user registration endpoint. Use Zod for validation, argon2 for password
hashing, and follow the pattern in src/api/auth.ts"

"Migrate the 12 Express routes in src/legacy/routes/ to Fastify.
Use src/api/health.ts as the pattern. Keep the same URL structure."

"Add tests for src/services/order.ts. Use Vitest, mock the repository layer,
and follow the pattern in tests/unit/services/auth.test.ts"
```

### What Makes a Prompt Effective

| Element                  | Why It Helps                                   | Example                                 |
| ------------------------ | ---------------------------------------------- | --------------------------------------- |
| **State the outcome**    | RUG knows what "done" looks like               | "Add pagination to the users endpoint"  |
| **Name technologies**    | Enforced as hard constraints — no substitution | "Use Zod, not Joi"                      |
| **Reference patterns**   | Enables Haiku (cheap model) execution          | "Follow the pattern in src/api/auth.ts" |
| **Specify scope**        | Prevents scope creep                           | "Only modify files in src/services/"    |
| **State what NOT to do** | Explicit boundaries                            | "Don't modify the database schema"      |

### Prompts That Trigger the Three-Phase Pipeline

These patterns automatically activate the cost-optimized pipeline (Haiku ingests → Sonnet plans → Haiku executes):

```
"Migrate all controllers in src/legacy/ to the modern Fastify pattern"
  → Phase 1: Haiku reads legacy files, produces interface inventory
  → Phase 2: Sonnet produces migration plan with per-file specs
  → Phase 3: Haiku translates each file in parallel

"Implement this feature spec: [detailed requirements across multiple files]"
  → Phase 2: Sonnet decomposes into tasks with pattern references
  → Phase 3: Haiku implements each task

"Add test coverage for all services in src/services/"
  → Phase 1: Haiku inventories all functions and their signatures
  → Phase 2: Sonnet plans test strategy and fixtures
  → Phase 3: Haiku writes each test file
```

---

## Example Scenarios

### Scenario 1: New Feature from Requirements

**You say:**

```
Add a "forgot password" flow:
- POST /api/auth/forgot-password (accepts email, sends reset token)
- POST /api/auth/reset-password (accepts token + new password)
- Token expires after 1 hour
- Use the patterns in src/api/auth.ts and src/services/auth.ts
- Store tokens in the password_resets table
```

**RUG does:**

| Step | Agent             | Tier | Task                                                                                         |
| ---- | ----------------- | ---- | -------------------------------------------------------------------------------------------- |
| 1    | Software Engineer | T2   | Plan: decompose into tasks, design token strategy                                            |
| 2    | Haiku Engineer    | T3   | Create `src/schemas/password-reset.ts` (Zod schemas)                                         |
| 3    | Haiku Engineer    | T3   | Create `src/db/migrations/add-password-resets.ts`                                            |
| 4    | Haiku Engineer    | T3   | Create `src/db/password-reset-repository.ts`                                                 |
| 5    | Software Engineer | T2   | Create `src/services/password-reset.ts` (design decisions on token generation, expiry logic) |
| 6    | Haiku Engineer    | T3   | Create `src/api/password-reset.ts` (route handlers following pattern)                        |
| 7    | Haiku Engineer    | T3   | Create `tests/unit/services/password-reset.test.ts`                                          |
| 8    | Haiku Engineer    | T3   | Validate: type-check + tests pass                                                            |

**Cost model:** 2 Sonnet calls + 6 Haiku calls vs. 8 Sonnet calls without optimization (~60% savings)

---

### Scenario 2: Lift-and-Shift Migration

**You say:**

```
Migrate the Express API in src/legacy/ to Fastify. There are about 15 route files.
Use src/api/health.ts as the pattern for route structure.
Keep all existing behavior identical.
```

**RUG does:**

| Step | Agent               | Tier | Task                                                                              |
| ---- | ------------------- | ---- | --------------------------------------------------------------------------------- |
| 1–5  | Haiku Engineer × 5  | T3   | Ingest legacy routes (parallel, 3 files each) → produce interface inventories     |
| 6    | Software Engineer   | T2   | Plan: map all legacy routes to modern equivalents, produce per-file task specs    |
| 7    | Software Engineer   | T2   | Implement first route translation (establishes pattern)                           |
| 8–21 | Haiku Engineer × 14 | T3   | Translate remaining 14 routes following the established pattern (parallel groups) |
| 22   | Haiku Engineer      | T3   | Validate: type-check + run route tests                                            |

**Cost model:** 2 Sonnet calls + 20 Haiku calls vs. 17 Sonnet calls without optimization (~75% savings)

---

### Scenario 3: Adding Test Coverage

**You say:**

```
Add unit tests for all exported functions in src/services/.
There are 5 service files. Use Vitest and follow tests/unit/services/auth.test.ts as the pattern.
Mock all repository dependencies.
```

**RUG does:**

| Step | Agent              | Tier | Task                                                                             |
| ---- | ------------------ | ---- | -------------------------------------------------------------------------------- |
| 1–5  | Haiku Engineer × 5 | T3   | Ingest each service file → function inventory with signatures and side effects   |
| 6    | Software Engineer  | T2   | Plan: design test strategy, fixture patterns, decide coverage scope per function |
| 7–11 | Haiku Engineer × 5 | T3   | Write test file for each service (parallel, following pattern)                   |
| 12   | Haiku Engineer     | T3   | Validate: all tests pass                                                         |

**Cost model:** 1 Sonnet call + 11 Haiku calls vs. 6 Sonnet calls without optimization (~70% savings)

---

### Scenario 4: Bug Fix

**You say:**

```
Users are getting a 500 error when updating their profile with an empty bio field.
The error shows "Cannot read properties of null" in the logs.
```

**RUG does:**

| Step | Agent             | Tier | Task                                                           |
| ---- | ----------------- | ---- | -------------------------------------------------------------- |
| 1    | Software Engineer | T2   | Diagnose: trace the null error through the profile update path |
| 2    | Software Engineer | T2   | Fix: add null check in the identified location                 |
| 3    | Haiku Engineer    | T3   | Validate: type-check passes, error no longer reproduces        |
| 4    | Haiku Engineer    | T3   | Add regression test for empty bio case                         |

**Note:** Bug diagnosis stays at T2 because it requires judgment. The fix may be T3 if the diagnosis identifies an obvious solution.

---

### Scenario 5: Large Refactoring

**You say:**

```
Refactor src/services/order.ts (800 lines) into separate modules:
- order-creation.ts
- order-status.ts
- order-queries.ts
Keep the same public API surface — just split the internals.
```

**RUG does:**

| Step | Agent             | Tier | Task                                                                     |
| ---- | ----------------- | ---- | ------------------------------------------------------------------------ |
| 1    | Haiku Engineer    | T3   | Ingest: document all exports, internal functions, and call relationships |
| 2    | Software Engineer | T2   | Plan: decide what goes where, handle shared state, maintain API surface  |
| 3    | Haiku Engineer    | T3   | Create `src/services/order-creation.ts` (move specified functions)       |
| 4    | Haiku Engineer    | T3   | Create `src/services/order-status.ts` (move specified functions)         |
| 5    | Haiku Engineer    | T3   | Create `src/services/order-queries.ts` (move specified functions)        |
| 6    | Haiku Engineer    | T3   | Update `src/services/order.ts` to re-export from new modules             |
| 7    | Haiku Engineer    | T3   | Validate: type-check + existing tests still pass                         |

---

## Tips for Maximum Efficiency

### Reference Existing Patterns

The single most impactful thing you can do is tell RUG which existing file to follow:

```
"Follow the pattern in src/api/auth.ts"
"Structure it like src/services/payment.ts"
"Use the same test setup as tests/unit/services/auth.test.ts"
```

This enables Haiku to handle the task (10–30× cheaper than Sonnet) because it has an explicit pattern to replicate.

### Be Specific About Technologies

Vague: "Add validation to the routes"
Specific: "Add Zod validation using schemas in src/schemas/"

Specificity prevents the orchestrator from needing to make choices (which would require a more expensive model).

### Batch Related Work

Instead of asking for one file at a time:

```
❌ "Create a user service"
   ... wait ...
   "Now add tests for it"
   ... wait ...
   "Now add the route handler"
```

Ask for the full scope:

```
✅ "Add a complete user CRUD flow: service, repository, route handlers, and tests.
    Follow the patterns in the auth module."
```

RUG parallelizes independent tasks within a single request — asking piecemeal forces sequential execution.

### Let RUG Handle the Planning

Don't micromanage the decomposition:

```
❌ "First create the types file, then the repository, then the service, then the routes"
```

State the outcome and let the pipeline optimize:

```
✅ "Add a complete order management feature with CRUD operations"
```

RUG's planning phase handles dependency ordering and parallelization automatically.

---

## When NOT to Use RUG

RUG adds overhead for simple tasks. Use a direct agent instead when:

| Scenario                              | Better Choice              |
| ------------------------------------- | -------------------------- |
| Quick single-file edit                | Software Engineer directly |
| Ask a question about code             | Software Engineer directly |
| Need library documentation            | Context7-Expert directly   |
| Editing an agent or skill file        | Foundry directly           |
| Single simple bug fix (obvious cause) | Software Engineer directly |

**Use RUG when:** The task spans 3+ files, requires planning, involves migration/translation, or benefits from parallel execution.
