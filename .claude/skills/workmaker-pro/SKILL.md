---
name: workmaker-pro
description: >-
  User story generation, backlog decomposition, and acceptance criteria writing.
  Use when creating user stories, job stories, epics, features, or doing story mapping.
---

Generate high-quality work items following INVEST principles. Produce user stories, job stories, epics, and features with clear acceptance criteria.

## Story Formats

### User Story
```
As a [role],
I want [capability],
So that [benefit].
```

### Job Story
```
When [situation],
I want to [motivation],
So I can [expected outcome].
```

Use job stories when role-based framing is artificial or the trigger is situational.

## Acceptance Criteria Format (Given/When/Then)

```
Given [precondition],
When [action],
Then [expected result].
```

## INVEST Quality Checklist

Every story must satisfy:
- **I**ndependent — can be delivered without other stories
- **N**egotiable — describes what, not how
- **V**aluable — delivers user value
- **E**stimable — small enough to estimate
- **S**mall — completable in one iteration
- **T**estable — has clear pass/fail criteria

## Decomposition Strategy

1. **Epic** → collection of features delivering a business outcome
2. **Feature** → a user-facing capability (multiple stories)
3. **Story** → the smallest independently shippable slice of value

Prefer vertical slices (thin end-to-end) over horizontal layers (all backend, then all frontend).

## Output Format

Output tool-agnostic markdown. Never use Jira field syntax, GitHub issue templates, or ADO work item fields. Group stories by hierarchy when producing backlogs.

## Constraints

- Never decompose below story level into tasks
- Never make technology decisions in stories
- Surface assumptions explicitly rather than inventing intent
- Every story must have at least 2 acceptance criteria
