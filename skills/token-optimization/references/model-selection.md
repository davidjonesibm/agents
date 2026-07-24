# Model Selection Strategy

Detailed decision framework for orchestrators choosing which model tier to assign per subagent task.

## The Cost Multiplier Problem

Each subagent invocation has compound cost:

- **Input tokens** — prompt (context + instructions + user request)
- **Output tokens** — generated response (code, explanations, confirmations)
- **Iteration cost** — failed attempts require re-dispatch at full cost

A Tier 1 model costs ~10–30× more per token than Tier 3. For a 10-subagent task:

- All Tier 2: 10 × $$ = baseline
- Mixed (2 Tier 2 + 8 Tier 3): 2×$$ + 8×$ = ~40–60% savings
- All Tier 1: 10 × $$$ = 10–30× baseline — catastrophic

## Task Classification Examples

### Tier 3 — Execution (Haiku / GPT-4o-mini)

These tasks have clear specs and mechanical execution:

| Task                                               | Why Tier 3 Works                         |
| -------------------------------------------------- | ---------------------------------------- |
| Create a new file matching an existing pattern     | Pattern exists; copy + adapt             |
| Add a test for a specific function                 | Input/output known; assertion mechanical |
| Rename a variable across files                     | Find-and-replace with context            |
| Add a field to a known interface + its usages      | Scope explicit; no judgment              |
| Create a migration adding a column                 | Template-based; SQL is specified         |
| Fix a type error with an obvious solution          | Error message prescribes the fix         |
| Write boilerplate (route handler, component shell) | Pattern prescribed by framework skill    |
| Simple validation (check file exists, tests pass)  | Binary pass/fail; no analysis            |

### Tier 2 — Balanced (Sonnet / GPT-4o)

These tasks require judgment but have bounded complexity:

| Task                                            | Why Tier 2 Needed             |
| ----------------------------------------------- | ----------------------------- |
| Implement a new feature across 2–3 files        | Design decisions in wiring    |
| Refactor a module for better separation         | Judgment on boundaries        |
| Debug with a partial stack trace                | Requires reasoning about flow |
| Code review with quality feedback               | Nuance in suggestions         |
| Write integration tests (choosing what to mock) | Design decisions in scope     |
| Implement error handling strategy               | Trade-offs in granularity     |

### Tier 1 — Reasoning (Opus / o1 / o3)

These tasks are ambiguous, novel, or safety-critical:

| Task                                                | Why Tier 1 Needed         |
| --------------------------------------------------- | ------------------------- |
| Design a new system from vague requirements         | Ambiguity resolution      |
| Debug a cross-layer issue with no clear root cause  | Deep multi-step reasoning |
| Security audit of auth flow                         | Safety-critical analysis  |
| Architecture decision with competing trade-offs     | Judgment at system level  |
| Recover from cascading test failures across modules | Complex state reasoning   |

## Orchestrator Protocol: Tagging Tasks

When decomposing a request, tag each task immediately:

```
TODO LIST:
1. [T3] Create UserService interface at src/services/user.ts
2. [T3] Create UserRepository at src/db/user-repository.ts
3. [T2] Implement UserService with business logic
4. [T3] Add tests for UserRepository (CRUD operations)
5. [T2] Add tests for UserService (mocking repository)
6. [T3] Validate: type-check + all tests pass
```

Rules:

- File creation from known patterns → T3
- Implementation with design decisions → T2
- Validation with binary outcome → T3
- Debugging or architecture → T2 (or T1 if ambiguous)

## Escalation Protocol

When a Tier 3 subagent fails validation:

1. **First failure**: Check if the prompt was unclear → re-dispatch at Tier 3 with better specificity
2. **Second failure**: Escalate to Tier 2 — the task likely requires judgment the cheap model lacks
3. **Never retry Tier 3 more than twice** — diminishing returns; the cost of 3 Tier 3 attempts approaches 1 Tier 2 attempt

When a Tier 2 subagent fails:

1. **First failure**: Re-dispatch at Tier 2 with failure context
2. **Second failure**: Escalate to Tier 1 if the failure suggests ambiguity or novel complexity
3. **Pattern failure**: If multiple T2 subagents fail on related tasks, the plan may be flawed — re-plan with Tier 1

## Validation-Specific Guidance

Validation subagents almost always qualify for Tier 3:

- Check that files exist and contain expected patterns
- Run tests and report pass/fail
- Run type-checker and report errors
- Compare output against acceptance criteria checklist

**Exception**: If validation requires _judgment_ (e.g., "is this code well-structured?"), use Tier 2.

## Cost Estimation Template

For a typical 6-task implementation:

```
Without optimization (all Tier 2):
  6 work + 6 validation + 1 integration = 13 subagent calls at Tier 2
  Cost: 13 × $$ = 13$$

With model selection:
  2 work (T2) + 4 work (T3) + 6 validation (T3) + 1 integration (T3) =
  2×$$ + 11×$ ≈ 2$$ + 3.5$$ = 5.5$$

  Savings: ~58%
```
