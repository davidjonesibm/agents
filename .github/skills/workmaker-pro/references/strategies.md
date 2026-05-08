# Decomposition Strategies

Three top-down strategies for breaking work into epics, features, and stories. Choose one per project or workflow context.

## Choosing a Strategy

| Context | Best Strategy |
|---------|--------------|
| Sprint-based delivery, roadmap with milestones, cross-functional teams | Epic → Feature → Story |
| Continuous delivery, no fixed sprints, team visualizes flow with WIP limits | Kanban feature-by-feature |
| Discovery phase, mapping a complete user journey, stakeholder alignment workshop | Story mapping |

When in doubt: use **epic/feature/story** for planned delivery, **kanban** for continuous flow, **story mapping** when you don't yet know what to build.

---

## Strategy 1: Epic → Feature → Story

Traditional agile backlog hierarchy for sprint-based delivery.

**Hierarchy:**
```
Epic (weeks–months, outcome-oriented)
└── Feature (days–weeks, shippable user-visible increment)
    └── Story (1–3 days, fits in a sprint, satisfies INVEST)
```

**Layer definitions:**
- **Epic**: A large body of work with a measurable outcome. Too uncertain or large to estimate directly. Contains multiple features.
- **Feature**: A user-visible capability that delivers value independently. The unit of release planning. Shippable without waiting for other features.
- **Story**: A thin, estimable slice of a feature. The unit of sprint planning. Must satisfy INVEST (see `references/quality.md`).

**Writing Epics — frame as outcomes, not outputs:**
```
# Before (output-framed, unmeasurable)
Epic: Build a checkout redesign

# After (outcome-framed, bounded)
Epic: Reduce checkout abandonment from 65% to under 45%
      by streamlining the payment flow for logged-in and guest users.
```

**Writing Features — user-visible, independently shippable:**
```
# Before (not user-visible, not shippable alone)
Feature: Build the payment infrastructure layer

# After (user-visible, shippable increment)
Feature: Guest checkout with card payment
         Users can complete a purchase without creating an account.
```

**Writing Stories under a Feature:**
```
Feature: Guest checkout with card payment

Story 1: As a shopper, I want to check out without creating an account,
         so that I can complete my purchase quickly.
Story 2: As a shopper, I want to enter my card details securely during checkout,
         so that I can pay without a saved payment method.
Story 3: As a shopper, I want to see a clear order confirmation after paying,
         so that I know my purchase was successful.
```

**Rules:**
- A feature with fewer than 2 stories is likely a story, not a feature — promote it down.
- An epic with fewer than 3 features should be reconsidered — it may just be a feature.
- Stories within a feature must be independently shippable — no story should depend on another being merged first.
- Features are the release unit; stories are the sprint unit.

---

## Strategy 2: Kanban Feature-by-Feature Flow

Continuous delivery without a fixed sprint or epic hierarchy. Work flows from discovery to done.

**When to use:** Teams delivering continuously, small teams, or contexts where features ship independently as soon as they're ready.

**Structure:**
```
Feature (user-visible capability, independently deliverable)
└── Story (thin slice, 1–3 days)
```

No epic layer. Features are pulled from a prioritized backlog into the flow as capacity allows.

**WIP limits:**
- Limit stories in progress to team capacity — typically 1 story per developer or pair.
- Features should not have more than 2–3 stories in flight simultaneously.
- A feature is "done" only when all its stories are in production and validated.

**Writing Features for kanban — emphasize independence:**
```
# Each feature must be releasable on its own:
Feature: Filter search results by price range
→ Ships the moment the filter UI, API query, and index changes are complete.
   No dependency on other features. Can be behind a flag if needed.
```

**Flow columns (example):**
```
Backlog | Ready | In Progress | Review | Done
```
Stories move left to right. A feature is only started when capacity is available at the "In Progress" column.

**Rules:**
- No cross-feature dependencies — each feature is self-contained end-to-end.
- Use feature flags to decouple deploy from release — code ships when ready, feature activates on schedule.
- Do not use velocity or story points in a pure kanban flow; measure cycle time (time from start to done) and throughput (stories per week).
- Priorities are managed continuously — re-rank the backlog as new information arrives rather than locking it per sprint.

---

## Strategy 3: Story Mapping (Jeff Patton)

A two-dimensional map of a complete user journey. Use during discovery or for release planning across a full workflow.

**Structure:**
```
Activity (backbone — what users do, ordered left to right by journey sequence)
└── Step (narrative flow — how they accomplish each activity)
    └── Detail / Story (vertical depth — variations, edge cases, enhancements)
```

- **Backbone** = the top row of activities, ordered chronologically across the user's journey.
- **Walking skeleton** = one story from each activity column — the thinnest end-to-end system that works.
- **Release slices** = horizontal cuts through the map, each slice being a releasable increment.

**Example map (e-commerce purchase journey):**
```
Activity:  [Search]          → [View Product]      → [Add to Cart]   → [Checkout]       → [Post-Purchase]
Step:      Search keyword       View images           Add quantity      Enter address      View confirmation
           Apply filters        Read reviews          View cart         Enter payment      Receive email
           View results         Compare products      Remove item       Review order       Track delivery
Detail:    Save search          Share product         Save for later    Apply coupon       Cancel order
           Voice search         360° view             Suggest similar   Guest checkout     Return item

Walking skeleton (release 1):
  Search keyword → View images → Add quantity → Enter address → Enter payment → View confirmation
```

**Building the backbone:**

```
# Before (technical tasks, not user activities)
Backbone: Database → API → Authentication → UI Components → Deployment

# After (user activities, journey order)
Backbone: Discover product → Evaluate product → Purchase → Receive order → Manage order
```

**Rules:**
- Build the backbone first with users or stakeholders — validate the journey before writing individual stories.
- The walking skeleton must be thin but complete: every activity column must have at least one story in the skeleton.
- Stories below the walking skeleton line represent later releases. Slice releases as horizontal cuts, not column-by-column.
- Story map sessions are collaborative workshops — the map is the output of a conversation, not a solo writing exercise.
- Activities are user-facing actions, not technical modules. "Authenticate" is not an activity — "Sign in" is.
- Do not confuse the vertical depth (more detail) with the horizontal breadth (more journey steps). Depth = later releases; breadth = the full journey.

**Choosing the walking skeleton:**
- Ask: "What is the minimum we can build that lets one user complete the full journey, end-to-end, even if it's awkward?"
- Exclude all "nice to have" rows, optional flows, error paths, and enhancement rows.
- The skeleton must be demonstrable to a real user — if it requires tech-only setup to see, it's not thin enough.
