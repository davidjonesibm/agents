---
name: workmaker-pro
description: >-
  Generates and decomposes high-quality user stories, job stories, epics, and features using
  modern agile best practices. Supports epic/feature/story hierarchy, kanban feature-by-feature
  flow, and Jeff Patton story mapping. Enforces INVEST criteria, acceptance criteria
  (Given/When/Then, checklist, scenario-based), definition of done, and vertical slice preference.
  Use when writing user stories, building a product backlog, decomposing epics into stories,
  splitting large stories, generating acceptance criteria, or planning iterative delivery.
  Trigger keywords: user story, user stories, story writing, backlog, story splitting, epic,
  feature, story mapping, acceptance criteria, INVEST, job stories, work items, agile decomposition.
---

Generate high-quality user stories and work items at the epic, feature, and story layers — tool-agnostic markdown, portable to any delivery tool.

Generation process:

1. Identify the decomposition strategy (epic/feature/story, kanban flow, or story mapping) using `references/strategies.md`.
2. Choose the story format (user story or job story) and apply the correct template using `references/templates.md`.
3. Prefer vertical slices over horizontal slices; apply splitting patterns where needed using `references/patterns.md`.
4. Run every story through the INVEST self-check and generate acceptance criteria using `references/quality.md`.
5. Review the output against anti-patterns and rewrite any failures using `references/anti-patterns.md`.

For a single story (no backlog decomposition), skip step 1 and load only the relevant reference files.

## Core Instructions

- **Scope**: epics, features, and stories only — never decompose below story into tasks, never group above epics into themes.
- **Default format**: user story ("As a [role], I want [goal], so that [benefit]"). Switch to job story when the user prefers situational framing or when role-based framing is artificial.
- **Vertical slices always**: every story must touch all relevant system layers end-to-end; flag horizontal slices and reframe or acknowledge explicitly (see `references/patterns.md`).
- **INVEST is non-negotiable**: run the six-criterion self-check on every story; flag and fix failures before outputting.
- **Every story gets acceptance criteria**: default to Given/When/Then for behavior-centric stories; checklist for task-centric; scenario-based for complex multi-step flows.
- **Tool-agnostic output**: plain markdown only — no Jira field syntax, no GitHub issue templates, no ADO work item fields.
- **No SAFe**: do not reference Program Increment, PI Planning, Agile Release Train, or any SAFe-specific constructs.

## Output Format

Output each story as a standalone markdown block:

```
**Story:** [title — imperative verb phrase]
As a [role], I want [goal], so that [benefit].

**Acceptance Criteria:**
[chosen format — see references/quality.md]

**Definition of Done:** [team-level DoD applies; override only if story-specific items apply]

**INVEST Check:**
  ✅/⚠️ Independent — [one-line assessment]
  ✅/⚠️ Negotiable — [one-line assessment]
  ✅/⚠️ Valuable — [one-line assessment]
  ✅/⚠️ Estimable — [one-line assessment]
  ✅/⚠️ Small — [one-line assessment]
  ✅/⚠️ Testable — [one-line assessment]
```

For a backlog (multiple stories), group by the chosen strategy hierarchy and precede the list with a one-sentence rationale for the strategy chosen.

## References

- `references/strategies.md` — decomposition strategies: epic/feature/story hierarchy, kanban feature-by-feature flow, and Jeff Patton story mapping. Includes strategy selection guidance.
- `references/templates.md` — user story, job story, technical story, and spike templates with full worked examples.
- `references/quality.md` — INVEST self-check table, acceptance criteria formats (Given/When/Then, checklist, scenario-based), and definition of done guidance.
- `references/patterns.md` — vertical slice preference, story splitting patterns (workflow steps, business rules, data variations, interface variations, simple/complex, defer performance, break out a spike).
- `references/anti-patterns.md` — common story-writing mistakes with before/after rewrites.
