# Handoff Design Patterns

Handoffs connect agents into workflows. They appear as buttons in VS Code chat, allowing users to move between agents with pre-filled context.

## YAML Syntax

Handoffs are defined in frontmatter under the `handoffs:` key.

```yaml
handoffs:
  - label: Review Code # Button text shown in chat
    agent: code-reviewer # Target agent filename (without .agent.md)
    prompt: Review the changes # Pre-filled prompt text
    send: false # false = user reviews before sending; true = auto-send
```

### Field Reference

| Field    | Required | Description                                                       |
| -------- | -------- | ----------------------------------------------------------------- |
| `label`  | Yes      | Button text shown in chat — use action verbs ("Review", "Deploy") |
| `agent`  | Yes      | Target agent's filename without `.agent.md`                       |
| `prompt` | No       | Pre-filled prompt text for the target agent                       |
| `send`   | No       | `true` = auto-send on click, `false` = user can edit first        |

## `handoffs:` vs `agents:`

These two frontmatter fields serve different purposes:

| Feature   | `handoffs:`                                | `agents:`                                       |
| --------- | ------------------------------------------ | ----------------------------------------------- |
| Purpose   | User-facing workflow transitions (buttons) | Programmatic delegation (subagent calls)        |
| UI        | Buttons in chat                            | No UI — agent calls subagents via tool          |
| Direction | User clicks to navigate to another agent   | Current agent spawns a subagent automatically   |
| Tool      | No tool required                           | Requires `agent/runSubagent` in `tools:`        |
| Use case  | Multi-step workflows with user checkpoints | Background delegation without user intervention |

**Rule of thumb:** Use `handoffs:` when the user should see and control the transition. Use `agents:` when the current agent needs to silently delegate work.

## Design Principles

- **Use descriptive button labels** — "Apply Security Fixes" not "Next" or "Continue".
- **Pre-fill prompts with context** — the target agent should know what happened in the current session.
- **Use `send: false`** for handoffs requiring user review or additional input.
- **Use `send: true`** for automated workflow steps where no user input is needed.
- **Keep handoff chains short** — 2-4 agents max. Longer chains lose context and confuse users.

## Workflow Patterns

### Sequential Handoff Chain

Each agent handles one phase, then hands off to the next.

```
Plan → Implement → Review → Deploy
```

```yaml
# In planner.agent.md
handoffs:
  - label: Implement Plan
    agent: implementer
    prompt: Implement the plan I created above
    send: false

# In implementer.agent.md
handoffs:
  - label: Review Changes
    agent: reviewer
    prompt: Review the code changes I just made
    send: false
```

### Iterative Refinement

Agent hands off to a reviewer, who can hand back for revision.

```
Draft → Review → Revise → Finalize
```

```yaml
# In drafter.agent.md
handoffs:
  - label: Review Draft
    agent: reviewer
    prompt: Review this draft for completeness and accuracy
    send: false

# In reviewer.agent.md
handoffs:
  - label: Revise
    agent: drafter
    prompt: Address the feedback I provided above
    send: false
  - label: Approve
    agent: finalizer
    prompt: Finalize the approved draft
    send: true
```

### Test-Driven Development

Tests written first, then implementation to make them pass.

```
Write Failing Tests → Implement → Verify Tests Pass
```

```yaml
# In test-writer.agent.md
handoffs:
  - label: Implement Code
    agent: implementer
    prompt: Implement code to make the failing tests above pass
    send: false

# In implementer.agent.md
handoffs:
  - label: Verify Tests
    agent: test-runner
    prompt: Run the test suite and report results
    send: true
```

### Research-to-Action

Research agent investigates, then hands off for implementation.

```
Research → Recommend → Implement
```

```yaml
# In researcher.agent.md
handoffs:
  - label: Implement Recommendations
    agent: implementer
    prompt: Implement the recommendations from my research above
    send: false
```

## Common Mistakes

- **Missing `agent:` value** — the handoff button renders but does nothing.
- **Using `name:` instead of filename** — `agent:` references the filename (e.g., `code-reviewer`), not the display name.
- **`send: 'true'`** — this is a string, not a boolean. Use `send: true` (no quotes).
- **Circular handoffs without exit** — A → B → A with no way to finish. Always include a terminal step.
- **Empty prompts** — the target agent loses all context. Always pre-fill with a summary of what happened.
