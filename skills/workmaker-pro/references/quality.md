# Quality Gates

INVEST self-check, acceptance criteria formats (Given/When/Then, checklist, scenario-based), and definition of done.

## INVEST Self-Check

Run every user-facing story through all six criteria before finalizing. Flag failures explicitly — do not ship a story with an open ⚠️.

| Criterion | Question | Failure Signal |
|-----------|----------|----------------|
| **I**ndependent | Can this story be built and shipped without waiting for another story? | "This needs Story X first" / shared database changes / UI depends on another story's API |
| **N**egotiable | Is scope open to conversation — not a fixed implementation contract? | Story specifies library names, component names, or internal architecture |
| **V**aluable | Does this deliver value to a user or the business on its own? | Story is a technical layer (schema, service class) with no user-visible outcome |
| **E**stimable | Can the team estimate it with enough certainty to commit? | "Too vague" / "depends on how the third-party API behaves" / first time the team has done this |
| **S**mall | Can it be completed within one sprint (typically 1–3 days of dev work)? | Team says it needs 4+ days / multiple developers must work in parallel |
| **T**estable | Is it clear when the story is done — can acceptance criteria be written? | Team cannot agree on a definition of "done" / outcome is subjective |

**Self-check output format:**
```
INVEST Check:
  ✅ Independent — no dependency on other in-flight stories
  ✅ Negotiable — slider vs. text inputs is open to the team
  ✅ Valuable — user directly benefits from price filtering
  ⚠️  Estimable — needs spike on third-party payment SDK before this can be estimated
      → Action: extract a 2-day spike (see references/patterns.md §Break Out a Spike)
  ✅ Small — estimated at 2 days
  ✅ Testable — AC covers happy path and no-results edge case
```

**Fixing INVEST failures:**

- **Not Independent** → split the blocking dependency into its own story or spike; reorder so the blocker ships first.
- **Not Negotiable** → remove "using X library" / "via Y component" from story text; move implementation hints to Notes or a separate ADR.
- **Not Valuable** → reframe as user-facing benefit, or write a technical story (see `references/templates.md §Technical Story`).
- **Not Estimable** → add a time-boxed spike story first; reduce scope to only what is known.
- **Not Small** → apply a splitting pattern (see `references/patterns.md §Story Splitting Patterns`).
- **Not Testable** → write at least one Given/When/Then scenario before finalizing; if impossible, the story isn't ready.

---

## Acceptance Criteria

Every story requires acceptance criteria. Choose the format based on the story type.

### Format 1: Given/When/Then (Gherkin Style)

Use for: behavior-driven stories, user interactions, API contracts, testable business rules.

```
Given [a starting context or state]
When  [the user or system takes an action]
Then  [the observable outcome]
And   [additional outcome] (optional)
```

**Full example:**
```
Story: As a shopper, I want to filter search results by price range,
       so that I only see products within my budget.

Given I am on the search results page with 40 results
When I set the price range to $10–$50 and apply the filter
Then only products priced between $10 and $50 are shown
And the result count updates to reflect the filtered set
And the active filter is visually indicated

Given I am on the search results page
When I set a price range with no matching products and apply the filter
Then a "No results for this price range" message is shown
And the filter controls remain visible so I can adjust the range
```

**Rules:**
- Each scenario starts with "Given" — never stack a second "When" without resetting context with a fresh "Given".
- Write at least one happy path scenario and one edge case or error scenario per story.
- "Then" clauses must be observable and independently verifiable — avoid "system works correctly" or "the page loads".
- "And" extends the immediately preceding Given/When/Then — do not use "And" to start a new scenario.

### Format 2: Checklist Style

Use for: task-centric stories, API-facing stories, infrastructure stories, technical stories.

```
- [ ] [Verifiable outcome 1]
- [ ] [Verifiable outcome 2]
- [ ] [Edge case or error condition]
```

**Full example:**
```
Story: As an API consumer, I want paginated search results,
       so that I can load large result sets without fetching everything at once.

Acceptance Criteria:
- [ ] GET /products?page=1&limit=20 returns the first 20 matching results
- [ ] Response body includes: total_count, page, limit, and next_url fields
- [ ] page=0 or limit=0 returns HTTP 400 with a descriptive error message
- [ ] limit > 100 is clamped to 100; response includes a warning field indicating clamping occurred
- [ ] Results are stable across pages (consistent ordering — cursor or stable sort key required)
- [ ] An empty result set returns HTTP 200 with an empty results array, not HTTP 404
```

**Rules:**
- Each item must be independently verifiable — avoid compound criteria ("does X and Y" → split into two items).
- Items should be written so a tester can mark them done without ambiguity.
- Avoid implementation steps masquerading as criteria (see `references/anti-patterns.md §8`).

### Format 3: Scenario-Based

Use for: complex flows, multi-step user journeys, stories with meaningful branching paths.

```
**Scenario: [name]**
[Narrative, 2–5 sentences. Describe the full flow and end with a verifiable outcome.]
```

**Full example:**
```
Story: As a new user, I want to verify my email before logging in,
       so that my account is secure and confirmed.

**Scenario: Happy path — user verifies within 24 hours**
A new user registers and receives a verification email within 2 minutes. They click the link,
their account is activated, and they are redirected to the dashboard with a success toast.
The verification link is single-use and expires after 24 hours.

**Scenario: Expired link**
A user clicks a verification link that is more than 24 hours old. They see a clear error
message explaining the link has expired, with a button to request a new one. Their account
remains inactive until they verify with the new link.

**Scenario: Duplicate click (already verified)**
A user clicks the verification link a second time (e.g., from a re-sent email). They see
a message saying their account is already active and are redirected to the login page.
No error is thrown; the action is idempotent.
```

### Choosing an AC Format

| Story Type | Recommended Format |
|------------|-------------------|
| User-facing feature with clear inputs/outputs | Given/When/Then |
| API endpoint, infrastructure, technical story | Checklist |
| Multi-step user journey, branching flow | Scenario-based |
| Simple story with a single verifiable outcome | Single-item checklist |
| Story with both behavior and edge cases | Mix: GWT for happy path + checklist for edge cases |

AC formats can be mixed within a single story — use the format that makes each criterion clearest.

---

## Definition of Done

The DoD is a team-level quality floor applied to every story. It supplements acceptance criteria — it does not replace them.

**Standard story-level DoD (modern CI/CD-aware):**
```
Definition of Done:
- [ ] Code reviewed and approved (PR merged to main branch)
- [ ] All acceptance criteria verified (manual or automated test)
- [ ] Unit tests passing; new behavior is covered
- [ ] Integration/E2E tests passing (CI pipeline green)
- [ ] No new linting, type, or security scan errors introduced
- [ ] Feature flagged if not ready for all users
- [ ] User-visible or API-facing changes documented
- [ ] Deployed to staging or preview environment and smoke-tested
```

**Adjusting DoD by story type:**

| Story Type | Additional DoD Items |
|------------|---------------------|
| UI story | Reviewed on target viewports; keyboard navigation tested; color contrast passes |
| API story | OpenAPI spec updated; contract tests passing |
| Technical story | ADR or runbook updated (not user-facing docs) |
| Performance story | Benchmark run before and after; results recorded |
| Security story | Security review completed; threat model updated if needed |

**Rules:**
- The DoD is a floor — teams may add items, never remove them to ship faster.
- "Done" means deployed and verified, not just merged. Code that lives in main but isn't deployed is not done.
- Do not put story-specific behavior in the DoD — that belongs in acceptance criteria.
- Review and update the DoD with the team at least once per quarter to reflect current practices.
