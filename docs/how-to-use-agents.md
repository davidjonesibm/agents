# How to Use These Agents

Which agent to pick, what each one is actually for, and how to phrase a request so it lands.

**The short version:** open **Software Engineer** unless you have a specific reason not to. RUG
is for parallel fan-out, Foundry is for agent/skill files, everything else is a subagent that
gets dispatched rather than opened.

---

## Pick an agent

The agent's body is re-sent on every turn, so the size column is a real cost, not trivia.

| Agent                 | Size    | Open it when                                                                                 | Don't                                     |
| --------------------- | ------- | -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Software Engineer** | ~4,100t | **Your default.** Implement, debug, review, architect. Has a terminal, a todo list, and can dispatch subagents. | Editing agent or skill files              |
| **RUG**               | ~4,100t | 3+ **independent** units you want run in parallel — "add these 6 endpoints", "update 12 csproj refs" | Anything serial, exploratory, or one-threaded |
| **Foundry**           | ~1,300t | `.agent.md`, `SKILL.md`, `.instructions.md` — absolute override, no exceptions                | Anything else                             |
| **Product Owner**     | ~1,470t | Stories, acceptance criteria, backlog decomposition                                          | Implementation                            |
| **Haiku Engineer**    | ~670t   | Dispatched, effectively never opened. Mechanical edits against a named pattern file          | Anything needing a decision               |
| **CI Monitor**        | ~450t   | Subagent for `/monitor-ci` only                                                              | Direct use                                |

VS Code also ships its own built-in subagents (`Explore` and friends). They are not managed by
this repo and `install.mjs` neither installs nor prunes them.

Two agents live in this repo but are **excluded from the local install** via
`install.config.json`:

| Agent                        | Why excluded                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| **App Store Deployment**     | Stack is ~870 C# files and zero Swift/Kotlin                        |
| **Context7-Expert**          | MCP servers are disabled at the org level — the agent cannot function |

---

## Software Engineer — the default

It is the only agent that is both hands-on and self-sufficient: terminal, edit tools, a todo
list, on-demand skills, and `runSubagent` for fan-out.

**What it does now that it didn't before:**

- **Tracks the ask on a todo list** and closes against it, so partial coverage is visible rather
  than silently dropped. This was the single reason RUG used to "feel more complete" — it was
  accounting, not orchestration.
- **Reports what it did not verify.** A green build is never treated as proof that a runtime
  behaviour changed. Expect lines like `Unverified — needs a run; check the requests table`.
- **Stops after two failed attempts** with a structured report instead of grinding.
- **Diagnoses before editing** when you hand it a symptom. See below.

**Symptoms are not tasks.** If you open with "X is wrong in production", it loads the
`root-cause-analysis` skill and proves the cause before touching code. You will see a hypothesis
stated with what would kill it. That interstitial step is deliberate — the alternative is five
speculative fixes that all build clean and change nothing.

Give it, in this order: **the symptom · what you already ruled out · where to look**.

```
The OrderImport messages show up as dependencies, not requests, in App Insights.
Already ruled out: the tag names, the DisplayName override, the sampling config.
Start in YCP.Messaging/ServiceBusSubscriber.cs.
```

The ruled-out list is worth more than everything else you can write. Without it the agent
re-walks ground you already covered, on your budget.

---

## RUG — parallel fan-out only

RUG (Repeat Until Good) is a pure dispatcher. It has **no terminal**, writes no code, and every
task it receives becomes a subagent dispatch.

### It earns its keep when

The work is **separable** — 3+ units that don't depend on each other's output. Twelve route
files, six endpoints, five test files, one pattern each. RUG runs them in parallel groups at the
cheapest tier that works.

### It costs you when

The work is one thread. Every dispatch re-pays a base prompt, and a serial chain of dispatches
is strictly more expensive than doing the same chain in one Software Engineer session — you pay
the orchestrator's context *and* each specialist's, for no parallelism in return.

### Typical flow

```
You → RUG:  "Add these 6 endpoints, following the pattern in src/api/auth.ts"

RUG:  1. Cost gate — how many files, how many dispatches
      2. One planning dispatch (Sonnet) — produces per-file specs
      3. Todo list from the plan
      4. Six implementation dispatches (Haiku, parallel — pattern is named)
      5. Validation dispatch
      6. Reports: "Done. 6 files created, type-check and tests pass."
```

You see the routing notes, the todo list, and the final summary. You do **not** see subagent
prompts or their raw output — RUG absorbs that, which is the point.

### RUG behaviours that surprise people

| Behaviour                                  | Why                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Stops and asks before a big scope          | >15 files in one dispatch, >8 files touched, or "audit everything" trips a cost gate  |
| Escalates to Opus without asking           | Only after two failed attempts on the same task — repeated failure *is* the approval  |
| Counts "same symptom after a fix" as a failure | A build that went green without changing behaviour is a failed attempt            |
| Refuses to run a command for you           | It has no terminal, by design                                                        |

---

## How to phrase requests

### Outcome first, mechanism second

```
"Add a user registration endpoint with email validation and password hashing"

"Migrate the 12 Express routes in src/legacy/routes/ to Fastify.
 Use src/api/health.ts as the pattern. Keep the same URL structure."

"Add tests for src/services/order.ts. Use Vitest, mock the repository layer,
 and follow tests/unit/services/auth.test.ts"
```

### What each element buys you

| Element                  | Why it helps                                    | Example                                 |
| ------------------------ | ----------------------------------------------- | --------------------------------------- |
| **State the outcome**    | The agent knows what "done" looks like          | "Add pagination to the users endpoint"  |
| **Name technologies**    | Treated as hard constraints — no substitution   | "Use Zod, not Joi"                      |
| **Reference a pattern**  | Unlocks Haiku (10–30× cheaper) for the edit     | "Follow the pattern in src/api/auth.ts" |
| **Specify scope**        | Prevents scope creep                            | "Only files in src/services/"           |
| **Say what NOT to do**   | Explicit boundaries beat inferred ones          | "Don't touch the database schema"       |

### Naming an existing file to copy is the highest-leverage sentence you can write

It converts a design task into a translation task, which is the difference between a Sonnet
dispatch and a Haiku one on every single file.

### Changing approach mid-thread

This is the highest-risk moment in any session. "Let's use the new SDK instead of fighting
something headed for EOL" is a **strategy** — but it reads like a *tactic*, and a tactic-reading
produces half a migration that then takes six turns to debug.

State it as a replacement with a boundary, and check the restatement before letting it run:

```
Stop the current approach. Do the full OpenTelemetry migration instead:
both hosts, the package, and remove the classic SDK registration.
Restate the plan before you touch anything.
```

### Batch related work

Piecemeal forces sequential execution and re-sends the whole thread each time:

```
❌ "Create a user service" → wait → "now tests" → wait → "now the route handler"
✅ "Add a complete user CRUD flow: service, repository, route handlers, and tests.
    Follow the patterns in the auth module."
```

---

## When to start a new session, and when to escalate the model

These are not the same lever and the cheap one is usually the right one.

**Cost is roughly quadratic in turn count** — every turn re-sends the whole accumulated thread.
A 25-turn Sonnet session and a 6-turn Opus session on the same bug measured out with Opus
costing **~1.8× more**, despite finishing in a quarter of the turns.

| Situation                                    | Do this                                                        |
| -------------------------------------------- | -------------------------------------------------------------- |
| Two hypotheses disproven, thread full of dead theories | **New session, same model.** Paste the ruled-out list, not the reasoning. A reset zeroes the quadratic at 1× multiplier. |
| The task changed                             | New session. The old context is now ballast                    |
| A fresh session on the same model also stalls | **Then** escalate to Opus — with the ruled-out list, not the transcript |
| Many interacting constraints held at once (concurrency, distributed state, DI resolution chains) | Opus first is defensible |
| Novel design with no pattern to match        | Opus first is defensible                                       |
| "This bug is annoying"                       | Not a reason. Reset the context instead                        |

**Escalate on evidence that the frame is wrong, not on difficulty and not on frustration.**
Keeping a poisoned context and multiplying it by 5 is the most expensive move available.

---

## Example scenarios

### 1. New feature from requirements → RUG

```
Add a "forgot password" flow:
- POST /api/auth/forgot-password (accepts email, sends reset token)
- POST /api/auth/reset-password (accepts token + new password)
- Token expires after 1 hour
- Use the patterns in src/api/auth.ts and src/services/auth.ts
- Store tokens in the password_resets table
```

| Step | Agent             | Tier | Task                                                          |
| ---- | ----------------- | ---- | ------------------------------------------------------------- |
| 1    | Software Engineer | T2   | Plan: decompose, design the token strategy                    |
| 2–4  | Haiku Engineer ×3 | T3   | Zod schemas, migration, repository — all pattern-following    |
| 5    | Software Engineer | T2   | `src/services/password-reset.ts` — expiry and generation logic |
| 6–7  | Haiku Engineer ×2 | T3   | Route handlers, unit tests                                    |
| 8    | Haiku Engineer    | T3   | Validate: type-check + tests                                  |

2 Sonnet + 6 Haiku, versus 8 Sonnet unoptimized.

### 2. Lift-and-shift migration → RUG

```
Migrate the Express API in src/legacy/ to Fastify. There are about 15 route files.
Use src/api/health.ts as the pattern. Keep all existing behavior identical.
```

| Step | Agent               | Tier | Task                                                          |
| ---- | ------------------- | ---- | ------------------------------------------------------------- |
| 1–5  | Haiku Engineer × 5  | T3   | Ingest legacy routes in parallel → interface inventories      |
| 6    | Software Engineer   | T2   | Plan: map legacy → modern, produce per-file specs             |
| 7    | Software Engineer   | T2   | Translate the first route — establishes the pattern           |
| 8–21 | Haiku Engineer × 14 | T3   | Translate the remaining 14 in parallel groups                 |
| 22   | Haiku Engineer      | T3   | Validate                                                      |

The three-phase shape — cheap ingest, one expensive plan, cheap parallel execution — is what RUG
exists for.

### 3. Test coverage → RUG

```
Add unit tests for all exported functions in src/services/ (5 files).
Use Vitest, follow tests/unit/services/auth.test.ts, mock all repository dependencies.
```

Same shape: 5 Haiku ingests → 1 Sonnet plan → 5 Haiku test files → 1 Haiku validation.

### 4. Bug fix → Software Engineer, not RUG

```
Users get a 500 when updating their profile with an empty bio.
Logs show "Cannot read properties of null".
Already ruled out: the validation layer — it accepts empty strings fine.
```

One thread, one investigation, needs a terminal to reproduce. Routing this through RUG buys
nothing and pays two base prompts. Software Engineer states a hypothesis, proves it, fixes it,
adds the regression test, and tells you what it could not verify without running the app.

### 5. Large refactor → either

```
Split src/services/order.ts (800 lines) into order-creation.ts, order-status.ts,
and order-queries.ts. Keep the same public API surface.
```

Once the plan exists, the file moves are independent — that is RUG's shape. Below about four
output files, Software Engineer with a todo list is cheaper.

---

## When NOT to use RUG

| Scenario                                    | Open instead              |
| ------------------------------------------- | ------------------------- |
| Quick single-file edit                      | Software Engineer         |
| A question about the code                   | Software Engineer         |
| Debugging anything                          | Software Engineer         |
| Editing an agent, skill, or instruction file | Foundry                   |
| "Where does X live" reconnaissance          | Software Engineer         |

**Use RUG when** the work is 3+ separable units that can genuinely run at the same time.
Everything else is cheaper in one hands-on session.
