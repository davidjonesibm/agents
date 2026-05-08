# Anti-Patterns

Common story-writing mistakes. Each entry includes a before/after rewrite.

## 1. Stories That Are Too Big ("Epics Disguised as Stories")

**Signal:** Team cannot estimate; story is expected to take multiple sprints; AC list has 10+ items.

```
# Before (an epic, not a story)
As a user, I want a complete profile management system,
so that I can manage my account.

# After — split by workflow steps (see references/patterns.md §Workflow Steps)
Story 1: As a user, I want to update my display name,
         so that my profile reflects what I want others to see.
Story 2: As a user, I want to upload a profile photo,
         so that others can recognize me in the product.
Story 3: As a user, I want to change my email address with re-verification,
         so that my account stays secure when my contact details change.
```

## 2. Solution-Prescribed Stories

**Signal:** Story text specifies implementation: library names, component names, table names, API paths, or tech stack choices.

```
# Before (violates Negotiable — removes team's design freedom)
As a user, I want a React dropdown built with shadcn/ui Select component,
so that I can select my country during checkout.

# After (what, not how)
As a user, I want to select my country from a list during checkout,
so that my order is shipped to the correct address.
```

**Why:** Prescribing the solution removes the team's ability to find the best approach and violates the Negotiable INVEST criterion. Move implementation preferences to Notes or a separate ADR.

## 3. Missing "So That" Clause

**Signal:** Story ends after the goal statement; no benefit or outcome is stated.

```
# Before (no value justification)
As a user, I want to reset my password.

# After
As a user, I want to reset my password,
so that I can regain access to my account if I've forgotten my credentials.
```

**Why:** The "so that" clause validates that the story is Valuable. Without it, the team cannot make value-based trade-offs or scope decisions. A missing "so that" often means the story hasn't been thought through.

## 4. Compound Stories ("And" Stories)

**Signal:** Story contains "and" or "also" connecting two distinct user goals that could each stand alone.

```
# Before (two stories in one)
As a user, I want to search for products and save them to a wishlist,
so that I can find and remember items I like.

# After (split by goal)
Story 1: As a user, I want to search for products by keyword,
         so that I can quickly find items I'm interested in.
Story 2: As a user, I want to save a product to my wishlist,
         so that I can easily find it again later without searching.
```

## 5. Horizontal Slices (Technical Layers Without User Value)

**Signal:** Story covers a single architectural layer; no user can benefit from it in isolation; written for a developer audience.

```
# Before (horizontal — architectural layer, no standalone user value)
As a developer, I want to create the database schema for the notifications table,
so that we have storage for notification data.

# After option A — reframe as a vertical slice
As a user, I want to see a notification badge when I have unread alerts,
so that I know when something needs my attention.
Scope: Minimal — badge count only. Covers: DB table + API + badge UI. Thin but end-to-end.

# After option B — if infrastructure truly must stand alone, use a technical story
Technical Story: Create the notifications database table
Rationale: Required before [Story: notification badge] can be built. Not user-visible.
Time-box: 0.5 days. See references/templates.md §Technical Story.
```

## 6. Implementation Details in Acceptance Criteria

**Signal:** AC specifies class names, method names, table columns, internal variable names, or library calls rather than observable outcomes.

```
# Before (implementation steps, not verifiable outcomes)
Given the UserNotificationService.markAsRead() method is called
When the notification ID exists in the notifications table
Then the read_at column is set to the current UTC timestamp

# After (observable behavior — testable by anyone, not just the implementer)
Given I have an unread notification
When I click on the notification
Then it is marked as read
And the unread badge count decreases by one
And if I refresh the page, the notification is still shown as read
```

## 7. Generic "As a user" Without Meaningful Role Differentiation

**Signal:** Every story in the backlog says "As a user" — different personas with different permissions and needs are collapsed into one role.

```
# Before (three distinct roles, all "user")
As a user, I want to approve expense reports, so that my team can be reimbursed.
As a user, I want to submit an expense report, so that I can get reimbursed for work costs.
As a user, I want to view all submitted expenses, so that I can audit spending.

# After (roles clarified)
As an employee, I want to submit an expense report,
so that I can get reimbursed for approved work costs.

As a manager, I want to approve expense reports for my direct reports,
so that my team members are reimbursed promptly.

As a finance admin, I want to view all submitted and approved expenses across the organization,
so that I can audit spending and prepare accurate financial reports.
```

**Why:** Role differentiation exposes different needs, permissions, UX flows, and access controls that "user" hides. Collapsed roles produce generic stories that are harder to test and prioritize.

## 8. Acceptance Criteria Written as Developer Tasks

**Signal:** AC reads like a technical checklist for the implementer rather than verifiable outcomes for a tester or product owner.

```
# Before (developer implementation checklist — not AC)
- [ ] Create the PaymentController class
- [ ] Add the POST /payments endpoint to the router
- [ ] Call the StripeService.charge() method with the card token
- [ ] Save the payment result to the Payment entity and flush to the DB

# After (verifiable outcomes — any tester can confirm these)
- [ ] A valid payment request returns HTTP 200 with a transaction ID in the response body
- [ ] An invalid card number returns HTTP 422 with an error message identifying the decline reason
- [ ] A successful payment triggers an order confirmation email within 60 seconds
- [ ] Submitting the same request with an identical idempotency key returns the original transaction ID without charging the card again
```

## 9. Stories With No Clear Role ("As a system")

**Signal:** The "role" in the user story is a technical component, background process, or the system itself.

```
# Before (system, not a person)
As the system, I want to send a welcome email when a user registers,
so that new users are onboarded.

# After option A — identify the real beneficiary
As a new user, I want to receive a welcome email after registering,
so that I have confirmation my account was created and know how to get started.

# After option B — if there is no user-facing benefit, use a technical story
Technical Story: Send automated welcome email on user registration
Type: Infrastructure
Value: Reduces support requests from users unsure if registration succeeded.
```

## 10. Skipping the INVEST Check

**Signal:** Stories are finalized and moved to sprint without any quality gate.

```
# Anti-pattern: story written and immediately accepted
Story: As a user, I want real-time chat, so that I can message other users.
[Added directly to sprint backlog — no INVEST check, no AC, estimated at "a few days"]

# After: apply INVEST before accepting
INVEST Check:
  ⚠️  Independent — requires WebSocket infrastructure not yet built → extract infrastructure technical story first
  ✅ Negotiable — implementation open
  ✅ Valuable — direct user benefit
  ⚠️  Estimable — team has never built real-time features → extract a 3-day spike (WebSocket vs. SSE vs. polling)
  ⚠️  Small — WebSocket infra + UI + persistence is 2–3 weeks → must split after spike findings
  ⚠️  Testable — no AC written → must add before sprint commitment

Action: Create spike → re-estimate → split → write AC → then accept into sprint.
```
