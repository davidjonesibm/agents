---
name: work-planning
description: >-
  Produces structured, token-optimized execution plans that maximize cheap-model (T3)
  task eligibility. Covers the three-phase pipeline: ingestion (T3), planning (T2),
  execution (T3). USE WHEN decomposing complex tasks, planning multi-file implementations,
  performing lift-and-shift migrations, translating requirements into implementation specs,
  or any time the orchestrator needs a detailed plan before dispatching work.
  DO NOT USE FOR: single-file edits that don't need planning, trivial tasks, or
  tasks already fully specified by the user.
---

# Work Planning

Produce execution plans that are **directly dispatchable** to cheap models. The goal: maximize the number of tasks that qualify for Tier 3 (Haiku Engineer) by front-loading all judgment into the planning phase.

## Core Principle

**Planning is where you spend intelligence. Execution is where you spend tokens.**

A well-constructed plan turns expensive reasoning into cheap mechanical execution. Every minute spent making the plan more specific saves 10× in execution cost.

## The Three-Phase Pipeline

Every complex task follows this pipeline. The orchestrator (RUG) drives the transitions.

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: INGEST (T3 — Haiku, parallelizable)                │
│ Read sources → produce structured inventory                  │
│ No decisions. No judgment. Just structured documentation.    │
└──────────────────────────┬──────────────────────────────────┘
                           │ compressed output
┌──────────────────────────▼──────────────────────────────────┐
│ Phase 2: PLAN (T2 — Sonnet)                                  │
│ Analyze inventory → make design decisions → output task specs │
│ This is the ONLY phase that requires judgment.               │
└──────────────────────────┬──────────────────────────────────┘
                           │ T3-ready task specs
┌──────────────────────────▼──────────────────────────────────┐
│ Phase 3: EXECUTE (T3 — Haiku, parallelizable)                │
│ Implement each task mechanically from spec                   │
│ No decisions. Follow patterns. Meet acceptance criteria.     │
└─────────────────────────────────────────────────────────────┘
```

### When to Use Each Phase

| Scenario                      |    Phase 1 (Ingest)    |     Phase 2 (Plan)      | Phase 3 (Execute)  |
| ----------------------------- | :--------------------: | :---------------------: | :----------------: |
| Lift-and-shift migration      |  ✅ Inventory legacy   |    ✅ Map to modern     | ✅ Translate files |
| New feature from requirements |           —            |  ✅ Design + decompose  | ✅ Implement tasks |
| Large refactoring             |  ✅ Map current state  | ✅ Design target state  |  ✅ Apply changes  |
| Bug fix across many files     | ✅ Trace affected code |  ✅ Plan fix approach   |   ✅ Apply fixes   |
| Adding tests to existing code | ✅ Inventory functions | ✅ Design test strategy |   ✅ Write tests   |

**Skip Phase 1** when the planner already has sufficient context (e.g., user provided detailed requirements, or the scope is a single module).

## Phase 1: Ingestion

**Model**: Haiku Engineer (T3) — parallelizable across files/modules

**Purpose**: Convert raw source material into compressed, structured representations that Phase 2 can reason over without reading the originals.

**Key rule**: The planner (Phase 2) should NEVER need to read raw source files. Everything it needs must be in the ingestion output.

### Ingestion Output Formats

Choose the format that matches the task:

| Task Type                    | Output Format                                       | See                       |
| ---------------------------- | --------------------------------------------------- | ------------------------- |
| Migration / lift-and-shift   | Interface inventory + call graph + dependency map   | `references/ingestion.md` |
| Refactoring                  | Module map + coupling analysis + public API surface | `references/ingestion.md` |
| Test coverage                | Function inventory + signature map + side effects   | `references/ingestion.md` |
| Feature across existing code | Relevant file summaries + integration points        | `references/ingestion.md` |

### Ingestion Rules

1. **Parallelize aggressively** — Each file or module is an independent ingestion task
2. **Output is structured data** — JSON, Markdown tables, or code-fence blocks. Never prose summaries.
3. **Include only what the planner needs** — function signatures, not implementations. Interfaces, not bodies.
4. **Preserve relationships** — Who calls whom, what depends on what, what implements what interface.
5. **Flag ambiguity** — If something is unclear from the code alone, mark it `[AMBIGUOUS: reason]` so the planner knows to address it.

See `references/ingestion.md` for detailed prompt templates and output schemas.

## Phase 2: Planning

**Model**: Software Engineer (T2 — Sonnet)

**Purpose**: Make all design decisions and produce task specs detailed enough for Haiku to execute without judgment.

### What Makes a Good Plan

A plan is good when **every task in it passes the T3 eligibility checklist**:

- [ ] Scope is explicit — exact files and locations specified
- [ ] Pattern exists — reference file or example code identified
- [ ] No design decisions — implementation path fully prescribed
- [ ] Acceptance criteria are concrete — verifiable without judgment
- [ ] Single concern — task does ONE thing

If a task can't pass this checklist, it must stay at T2 or be decomposed further.

### Plan Output Format

The plan MUST use the structured format defined in `references/plan-format.md`. Key elements:

1. **Architecture decisions** — All design choices made upfront (the "why")
2. **Task list** — Ordered, with dependencies and tier tags
3. **Per-task spec** — File paths, pattern references, exact requirements, acceptance criteria
4. **Parallel groups** — Which tasks can run simultaneously

### Planning Rules

1. **Make EVERY decision** — Don't defer choices to execution. Naming, structure, error handling, edge cases — all decided here.
2. **Reference existing patterns** — For every task, point to a file in the codebase that shows the pattern to follow.
3. **Write binary acceptance criteria** — "Tests pass", "Type-checks clean", "File exports X" — not "Code is well-structured".
4. **Specify the negative** — What NOT to do is as important as what to do. "Do NOT modify auth.ts", "Do NOT add error handling beyond what's in the pattern".
5. **Order by dependency** — Later tasks may reference earlier tasks' output as patterns.
6. **Maximize parallelism** — Group independent tasks explicitly.
7. **Size tasks for single-subagent execution** — One task ≈ one file or one tightly-coupled set of changes.

## Phase 3: Execution

**Model**: Haiku Engineer (T3) — parallelizable within dependency groups

**Purpose**: Implement each task mechanically from its spec. No creativity needed.

### Execution Rules

1. **One task = one subagent dispatch** — Never batch unrelated tasks
2. **Include the full task spec in the prompt** — Don't reference "task 3 from the plan"; paste it inline
3. **Include pattern file paths** — Haiku reads the pattern file first, then implements
4. **Validation is separate** — After each parallel group completes, run validation before the next group

## When to Load This Skill

The orchestrator should load this skill when:

- The user's request involves **3+ files** to create or modify
- The task involves **translating from one system/format to another**
- The user provides **requirements or specs** that need decomposition
- The task involves **understanding existing code before making changes**
- The user explicitly asks to **plan**, **break down**, or **decompose** work

## Constraints

- **Never produce vague task specs** — "Implement the service layer" is not a T3-eligible task
- **Never skip ingestion when source analysis is needed** — Don't ask Sonnet to read 50 files
- **Never output a plan without pattern references** — Every task needs a "follow this pattern" pointer
- **Never create tasks that require design decisions** — Split them until each is mechanical
- **Never produce acceptance criteria that require judgment** — "Good code quality" is not verifiable
