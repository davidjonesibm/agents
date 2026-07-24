# Plan Output Format

The structured format that Phase 2 (planning) must produce. This format is designed to be directly consumable by the RUG orchestrator for dispatch.

## Full Plan Template

```markdown
# Execution Plan: [Brief Title]

## Architecture Decisions

[All design choices made upfront. These are NOT repeated in task specs.]

- Pattern: [e.g., "Repository pattern for data access"]
- Naming: [e.g., "kebab-case files, PascalCase classes, camelCase functions"]
- Error handling: [e.g., "Throw typed errors in services, catch at route boundary"]
- [Other decisions relevant to this task]

## Pattern References

Files that establish the patterns tasks must follow:

| Pattern Category | Reference File                   | Used By Tasks |
| ---------------- | -------------------------------- | ------------- |
| Route handler    | src/api/health.ts                | 4, 5, 6       |
| Service function | src/services/auth.ts             | 7, 8, 9       |
| Repository       | src/db/user-repository.ts        | 10, 11        |
| Unit test        | tests/unit/services/auth.test.ts | 12, 13, 14    |

## Task List

### Group 1: [Name] (parallel, no dependencies)

#### Task 1 [T3]: [Short title]

- **File**: src/types/user.ts (create)
- **Pattern**: Follow src/types/auth.ts
- **Spec**: Export `User`, `CreateUserDto`, `UpdateUserDto` interfaces matching fields from [source]
- **Acceptance**: File exports all 3 types, type-checks clean
- **Do NOT**: Add validation logic (that's in schemas)

#### Task 2 [T3]: [Short title]

- **File**: src/schemas/user.ts (create)
- **Pattern**: Follow src/schemas/auth.ts
- **Spec**: Zod schemas for CreateUser and UpdateUser matching the DTO interfaces
- **Acceptance**: Schemas validate correct inputs, reject invalid ones, type-checks clean
- **Do NOT**: Add custom error messages beyond what the pattern shows

---

### Group 2: [Name] (parallel, depends on Group 1)

#### Task 3 [T2]: [Short title — requires judgment]

- **File**: src/services/user.ts (create)
- **Why T2**: First service implementation; establishes business logic patterns
- **Context**: [What this service does, design decisions it must make]
- **Requirements**: [Detailed requirements including edge cases]
- **Acceptance**: [Criteria list]
- **Establishes pattern for**: Tasks 4, 5 (other services)

#### Task 4 [T3]: [Short title]

- **File**: src/services/order.ts (create)
- **Pattern**: Follow src/services/user.ts (from Task 3)
- **Spec**: [Exact spec]
- **Acceptance**: [Binary criteria]

---

### Group 3: [Name] (parallel, depends on Group 2)

...

## Dependency Graph
```

Group 1 ──→ Group 2 ──→ Group 3 ──→ Group 4
│
▼
Validation

```

## Validation Checkpoints

After each group:
- [ ] Type-check passes (`npm run typecheck` or equivalent)
- [ ] Existing tests still pass
- [ ] New files follow the referenced patterns
```

## Per-Task Spec Requirements

Every task spec MUST include ALL of these fields:

| Field                       | Required         | Purpose                                       |
| --------------------------- | ---------------- | --------------------------------------------- |
| **File**                    | Always           | Exact path, with (create) or (modify)         |
| **Pattern**                 | Always for T3    | File path to follow                           |
| **Spec**                    | Always           | What to implement — explicit enough for Haiku |
| **Acceptance**              | Always           | Binary pass/fail criteria                     |
| **Do NOT**                  | Recommended      | Explicit boundaries                           |
| **Why T2**                  | If T2            | Justification for needing judgment            |
| **Establishes pattern for** | If first-of-kind | Which downstream tasks reference this         |

## Task Sizing Rules

| Size Indicator                                    | Action                                    |
| ------------------------------------------------- | ----------------------------------------- |
| Touches 1 file, single concern                    | Good — one task                           |
| Touches 1 file, 2–3 related concerns              | Acceptable if under ~200 lines of change  |
| Touches 2+ files with shared logic                | Split into per-file tasks with dependency |
| Requires reading many files to understand context | Needs ingestion phase first               |
| Contains "and" joining unrelated concerns         | Split immediately                         |

## Converting Requirements to Plans

When the input is user requirements (not existing code):

### Step 1: Identify Components

From requirements, list every artifact that needs to exist:

- Files to create
- Files to modify
- Tests to write

### Step 2: Establish Patterns

For each category of artifact, identify OR create a pattern reference:

- If a similar file exists in the codebase → reference it
- If no pattern exists → mark the first task as T2 (it creates the pattern)
- All subsequent tasks of the same kind → T3 (follow the pattern)

### Step 3: Order by Dependency

```
Types/interfaces (no deps) → Data layer → Business logic → API layer → Tests
```

Within each layer, tasks are usually parallel.

### Step 4: Write Per-Task Specs

Apply the template above. Every task must be independently dispatchable — a subagent reading just that task spec (plus the pattern file) can implement it without additional context.

## Anti-Patterns

| Bad Plan Output                        | Problem                          | Fix                                        |
| -------------------------------------- | -------------------------------- | ------------------------------------------ |
| "Implement the user service"           | No spec, no pattern, no criteria | Full task spec with all fields             |
| "Follow best practices"                | Not a verifiable criterion       | Name the specific practice or pattern file |
| Task touches 5 files                   | Too large for one subagent       | Split into per-file tasks                  |
| No pattern reference                   | Haiku will improvise (badly)     | Identify or create a pattern               |
| "Make sure it works"                   | Not binary acceptance criteria   | "Type-checks clean, tests pass"            |
| T3 task with design decisions embedded | Will fail or produce bad output  | Escalate to T2 or decide in plan           |
