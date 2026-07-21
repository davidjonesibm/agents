# Story Templates

Full templates with worked examples for user stories, job stories, technical stories, and spikes.

---

## User Story Template

The default format. Use for all user-facing behavior.

```
**Story:** [title — imperative verb phrase, e.g., "Filter search results by price"]
As a [role],
I want [goal — what the user wants to do],
so that [benefit — why it matters to them].

**Acceptance Criteria:**
[Given/When/Then, checklist, or scenario-based — see references/quality.md]

**Definition of Done:** [team-level DoD applies unless story-specific items are noted]

**Notes / Out of Scope:** [optional — list explicit exclusions to prevent scope creep]

**INVEST Check:**
  ✅/⚠️ Independent — [one-line assessment]
  ✅/⚠️ Negotiable — [one-line assessment]
  ✅/⚠️ Valuable — [one-line assessment]
  ✅/⚠️ Estimable — [one-line assessment]
  ✅/⚠️ Small — [one-line assessment]
  ✅/⚠️ Testable — [one-line assessment]
```

**Worked example:**
```
**Story:** Filter search results by price range
As a shopper,
I want to filter search results by a minimum and maximum price,
so that I only see products I can afford.

**Acceptance Criteria:**
Given I am on the search results page with results visible
When I set the price range to $10–$50 and apply the filter
Then only products priced between $10 and $50 are displayed
And the result count updates to reflect the filtered set
And a visual indicator shows the active price filter

Given I set a price range that matches no products
When I apply the filter
Then a "No results for this price range" message is shown
And the filter controls remain visible so I can adjust the range

**Notes / Out of Scope:** Saved filter preferences (deferred to Story: save search filters).
Currency conversion (out of scope for this release — USD only).

**INVEST Check:**
  ✅ Independent — no dependency on other in-flight stories
  ✅ Negotiable — slider vs. text inputs vs. presets all open to team
  ✅ Valuable — directly reduces bounce caused by price mismatch
  ✅ Estimable — team has built filter UI before; estimated at 2 days
  ✅ Small — fits comfortably within one sprint
  ✅ Testable — AC covers happy path and no-results edge case
```

---

## Job Story Template

Alternative to user stories. Emphasizes situational context and motivation over role.

**When to use job stories instead of user stories:**
| Situation | Use |
|-----------|-----|
| Multiple user segments would act identically | Job story — role adds no useful signal |
| Triggering context (situation) drives the need | Job story |
| Distinct user roles with different permissions/views | User story |
| Business process or explicit role-based workflow | User story |
| Discovery phase or jobs-to-be-done analysis | Job story |

```
**Story:** [title]
When [situation — the triggering context that creates the need],
I want to [motivation — the action or capability],
so I can [expected outcome — the goal achieved].

**Acceptance Criteria:**
[Same formats as user stories — see references/quality.md]

**INVEST Check:** [same as user story template]
```

**Worked example:**
```
**Story:** Resume a checkout session after being interrupted
When I am partway through checkout and have to close the browser before completing my order,
I want my cart contents and shipping address to be saved automatically,
so I can pick up where I left off without re-entering everything.

**Acceptance Criteria:**
Given I have added items to my cart and entered a shipping address
When I close the browser tab and return to the site within 24 hours
Then my cart items are still present
And my shipping address is pre-filled in the checkout form

Given I return to the site more than 24 hours after abandoning checkout
When I view my cart
Then I see a message: "Your saved session has expired"
And the cart is shown as empty

**INVEST Check:**
  ✅ Independent — cart persistence is isolated from payment flow
  ✅ Negotiable — cookie vs. server-side session storage open to team
  ✅ Valuable — reduces checkout abandonment; direct revenue impact
  ✅ Estimable — similar to existing session work; estimated at 3 days
  ✅ Small — fits within one sprint
  ✅ Testable — two scenarios cover the key paths
```

---

## Technical Story Template

Use for infrastructure, tech debt, performance, or security work that is difficult to frame with a user benefit.

**Try user story format first.** Many "technical" stories can be reframed with a user-visible benefit:

```
# Before (tech-only framing)
Migrate the database from MySQL to PostgreSQL.

# After (user-visible benefit found)
As a user, I want the application to stay responsive during peak usage,
so that I can always access my data when I need it.
Rationale: PostgreSQL migration enables connection pooling required to handle
           peak-hour traffic that currently causes timeouts.
```

**When user story format genuinely doesn't fit, use:**
```
**Technical Story:** [title]
**Type:** [Tech Debt | Infrastructure | Performance | Security]

**Problem:** [What is broken, degraded, risky, or blocking? 1–3 sentences.]

**Proposed Change:** [What will be done? Direction, not a full spec.]

**Value / Risk Reduction:** [Why does this matter? What degrades or breaks if deferred?]

**Acceptance Criteria:**
[Checklist format — see references/quality.md §Checklist Style]

**Definition of Done:** [Standard DoD + type-specific items]

**INVEST Check:** Not required. Apply Estimable and Testable as a minimum gate.
```

**Worked example — tech debt:**
```
**Technical Story:** Extract payment logic into a dedicated service
**Type:** Tech Debt

**Problem:** Payment processing is embedded directly in the OrderController, making it
impossible to unit-test payment scenarios without a full HTTP stack. Three payment-related
bugs in the last sprint traced back to this coupling.

**Proposed Change:** Move all payment logic into a PaymentService class with a clean interface.
The controller delegates to the service. No new payment behavior — pure refactor.

**Value / Risk Reduction:** Reduces bug risk in the payment flow; enables unit tests for
payment scenarios without mocking HTTP; unblocks Story: add Apple Pay support.

**Acceptance Criteria:**
- [ ] A PaymentService class exists and is injected into OrderController via DI
- [ ] All payment-related logic is removed from OrderController
- [ ] Existing integration tests still pass (zero behavior changes)
- [ ] Unit tests cover the three payment scenarios that caused last sprint's bugs
- [ ] No new direct DB calls in OrderController (all via service layer)

**Definition of Done:** Standard DoD + ADR updated to document the new service boundary.
```

**Worked example — performance:**
```
**Technical Story:** Cache product listing API responses
**Type:** Performance

**Problem:** Product listing endpoint averages 1,200ms under load; target SLA is < 300ms.
P99 is 4s. Every request hits the database — no caching exists.

**Proposed Change:** Add a Redis cache layer for product listing responses with a 5-minute TTL.
Cache is invalidated on product create, update, or delete events.

**Value / Risk Reduction:** Required before launch — performance SLA is a go/no-go criterion.
User testing shows high bounce from search results due to perceived slowness.

**Acceptance Criteria:**
- [ ] Product listing endpoint responds in < 200ms at p95 under 100 concurrent simulated users
- [ ] Cache is invalidated within 5 seconds of any product update
- [ ] A cache miss still returns correct, up-to-date results
- [ ] Cache hit rate exceeds 80% under typical load; benchmark result recorded
- [ ] Redis unavailability degrades gracefully — falls through to DB, does not crash
```

---

## Spike Template

Use when a story cannot be estimated because of genuine technical unknowns.

```
**Spike:** [question being investigated — frame as a question or decision, not a task]
**Time-box:** [1–5 days — never open-ended]

**Question to Answer:** [The specific decision or uncertainty this spike resolves.]

**Output:** [What artifact will exist when the spike is done — decision doc, ADR, prototype, estimate.]

**Not output:** Production code. Spikes produce documents, not features.

**Done when:** [The question is answered and the output artifact exists — regardless of the answer.]
```

**Worked example:**
```
**Spike:** Evaluate real-time delivery options for the order tracking feature
**Time-box:** 3 days

**Question to Answer:** Can we use WebSockets through the existing API gateway, or do we need
a dedicated real-time service? What are the latency, infrastructure cost, and operational
complexity trade-offs between WebSockets, Server-Sent Events, and long polling?

**Output:** Decision document covering:
  (a) Recommended approach with rationale
  (b) Any new infrastructure required
  (c) Revised effort estimate for Story: real-time order tracking updates
  (d) Known risks and mitigations

**Not output:** Production code, a working prototype, or a merged PR.

**Done when:** The decision document is written and the order tracking story has a credible estimate.
```

**Spike rules:**
- Spikes are always time-boxed. If the question isn't answered in the time-box, the team decides with the information available — the spike does not extend.
- Spikes do not require INVEST criteria. They are research tasks, not user-facing stories.
- A spike must have one specific question. "Research GraphQL" is not a valid spike. "Determine whether our current API gateway supports GraphQL subscriptions without infrastructure changes" is.
- After a spike, the unblocked story must be re-estimated and re-evaluated against INVEST before being accepted into a sprint.
