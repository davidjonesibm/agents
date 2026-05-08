# Story Patterns

Vertical slice preference and the canonical story splitting patterns.

## Vertical Slices vs. Horizontal Slices

**Always prefer vertical slices.** A vertical slice cuts through all layers of the system (UI, API, database, etc.) to deliver a complete, end-to-end behavior. A horizontal slice isolates one layer (e.g., "build the database schema" or "create the service class").

```
# Before (horizontal slice — no user value on its own)
As a developer, I want the product table schema created in the database,
so that we have a place to store product data.

# After (vertical slice — thin but complete)
As a shopper, I want to view a product's name and price,
so that I can decide whether to add it to my cart.

Scope note: Minimal implementation — product name and price only, fetched from
a single DB table. No images, reviews, or inventory. Thin but end-to-end.
```

**The vertical slice test:** For any story, ask: "Can a user or stakeholder test this right now, without any other story being merged first?" If not, it is probably a horizontal slice.

**Why vertical slices matter:** Horizontal slices produce work that cannot be demonstrated to users or stakeholders. They create "almost done" backlogs that are 90% complete for months. Vertical slices produce working software at every delivery point.

**Legitimate uses of horizontal slices (acknowledge explicitly):**
- **Spikes** — time-boxed research tasks that produce a document, not a feature (see §Break Out a Spike below).
- **Cross-cutting infrastructure** — auth systems, logging pipelines, CI configuration — that directly enables multiple vertical slices to follow. Plan the vertical slices explicitly before accepting the horizontal work.

When a horizontal slice is unavoidable, document it as a technical story with an explicit rationale and the vertical stories it unblocks (see `references/templates.md §Technical Story`).

---

## Story Splitting Patterns

When a story fails the Small or Estimable INVEST criteria, apply one of these patterns. Each pattern produces stories that are still independent and valuable. See `references/quality.md` for INVEST self-check.

### 1. Workflow Steps

Split by the steps in a user's workflow. Each story covers one step end-to-end.

```
# Before (too large — spans multiple workflow steps)
As a hiring manager, I want to post a job, screen applications, and schedule interviews,
so that I can hire the right person efficiently.

# After (split by workflow step)
Story 1: As a hiring manager, I want to create and publish a job posting,
         so that candidates can find and apply for the role.
Story 2: As a hiring manager, I want to review incoming applications,
         so that I can identify the most promising candidates.
Story 3: As a hiring manager, I want to move a candidate to the interview stage,
         so that I can schedule next steps with them.
```

### 2. Business Rules

Keep the happy path in one story; each significant business rule or validation edge case becomes a separate story.

```
# Before (too large — bundles happy path with all validation rules)
As a shopper, I want to apply a discount code at checkout,
so that I get the correct reduced price.
(Rules: single-use codes, expired codes, percentage vs. fixed, minimum order threshold)

# After (happy path first, then rules)
Story 1 (happy path): As a shopper, I want to apply a valid discount code,
                      so that my order total is reduced.
Story 2: As a shopper, I want to see a clear error when I enter an expired code,
         so that I understand why the discount wasn't applied.
Story 3: As a shopper, I want to see an error when my cart is below the minimum order
         threshold for a discount, so that I know what's needed to qualify.
```

### 3. Data Variations

Split by the type, format, or source of data being processed.

```
# Before (multiple data sources bundled together)
As a user, I want to import my contacts,
so that I can invite them to the app.

# After (split by data source)
Story 1: As a user, I want to import contacts from a CSV file,
         so that I can invite people I've already organized in a spreadsheet.
Story 2: As a user, I want to import contacts from Google Contacts,
         so that I can invite my network without exporting a file.
```

### 4. Interface Variations

Split by UI surface, input method, or delivery channel.

```
# Before (all notification channels bundled)
As a user, I want to receive notifications,
so that I know when something important happens.

# After (split by channel)
Story 1: As a user, I want to receive in-app notifications,
         so that I see alerts when I'm actively using the product.
Story 2: As a user, I want to receive email notifications for important events,
         so that I stay informed when I'm not logged in.
Story 3: As a user, I want to receive push notifications on mobile,
         so that I get real-time alerts without opening the app.
```

### 5. Simple / Complex

Build the simple case first; defer complexity to a follow-up story after the baseline is working.

```
# Before (full complexity upfront)
As a user, I want an advanced search with filters, sorting, and saved searches,
so that I can find exactly what I need.

# After
Story 1 (simple): As a user, I want to search products by keyword,
                  so that I can quickly find what I'm looking for.
                  (Basic text match — no filters, no sort options)
Story 2 (complex): As a user, I want to filter search results by category and price range,
                   so that I can narrow down many results to the best options.
Story 3 (deferred): As a user, I want to save a search and be notified when new matches appear,
                    so that I don't have to search manually every day.
```

### 6. Defer Performance

Build for correctness first. Add a performance story after the baseline is measured — never optimize speculatively.

```
Story 1: As a user, I want to see my order history,
         so that I can review past purchases.
         (No caching — direct database query. Ship and measure.)

Story 2 (deferred): As a user, I want my order history to load in under 300ms,
                    so that browsing past orders feels fast.
                    (Requires: Story 1 baseline metrics. Add Redis cache with 5-min TTL.)
```

**Why:** Building for performance before you have a baseline leads to premature optimization. Always measure the real bottleneck first.

### 7. Break Out a Spike

When a story is not estimable due to technical uncertainty, extract a time-boxed spike before committing.

```
# Story blocked by uncertainty
As a user, I want real-time order tracking updates,
so that I know where my delivery is at all times.
↳ Team cannot estimate — never integrated with the carrier API; don't know the data model.

# Spike (research task, not a user story)
**Spike:** Evaluate ShipTrack carrier API for real-time tracking integration
**Time-box:** 2 days
**Output:** Decision doc covering: (a) authentication approach, (b) webhook vs. polling,
            (c) data shape for order status events, (d) estimated effort for the tracking story.
**Not output:** Production code.

# Story (post-spike, now estimable)
As a user, I want real-time order tracking updates,
so that I know where my delivery is at all times.
[Now estimable based on spike findings — attach decision doc as context]
```

**Spike rules:**
- Always time-boxed: 1–5 days maximum.
- Output is a document, decision, or prototype — never production code.
- The spike itself does not require INVEST criteria — it is research, not a feature.
- A spike must have a clear question to answer; "investigate X" without a decision criterion is not a valid spike.
