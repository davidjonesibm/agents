# Rate Limiting & Throttling

Patterns for protecting APIs from overload. Based on Microsoft REST API Guidelines and IETF RateLimit header fields draft.

## Server-Side Rate Limiting

Limit the number of requests a client can make within a time window to protect server resources.

**Common strategies:**

| Strategy       | Description                                                     | Best For                       |
| -------------- | --------------------------------------------------------------- | ------------------------------ |
| Fixed Window   | Count requests in fixed time windows (e.g., per minute)         | Simple per-user limits         |
| Sliding Window | Rolling window that smooths out burst edges                     | Fairer rate limiting           |
| Token Bucket   | Tokens replenish at a fixed rate; each request consumes a token | Allowing bursts within limits  |
| Leaky Bucket   | Requests processed at a fixed rate; excess queued or rejected   | Smooth, predictable throughput |

**Rules:**

- Apply rate limits per **API key**, **user**, or **IP address** — not globally.
- Use different limits for different endpoints (read vs. write, cheap vs. expensive).
- Rate limit at the API gateway level when possible (before the request reaches application code).

## 429 Too Many Requests

When a client exceeds the rate limit, return `429` with standard headers indicating when to retry.

**Response:**

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 1710000000

{
  "type": "https://api.example.com/problems/rate-limit-exceeded",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "Rate limit of 100 requests per minute exceeded. Retry after 30 seconds."
}
```

## Rate Limit Headers

Include rate limit information in **every response** (not just 429s) so clients can self-throttle.

| Header                | Description                                            | Example      |
| --------------------- | ------------------------------------------------------ | ------------ |
| `RateLimit-Limit`     | Maximum requests allowed in the current window         | `100`        |
| `RateLimit-Remaining` | Requests remaining in the current window               | `42`         |
| `RateLimit-Reset`     | Unix timestamp (seconds) when the window resets        | `1710000000` |
| `Retry-After`         | Seconds to wait before retrying (on 429/503 responses) | `30`         |

**Rules:**

- Always include `Retry-After` on `429` and `503` responses.
- Include `RateLimit-*` headers on all successful responses so clients can monitor their usage.
- `Retry-After` takes precedence over calculated backoff in client retry logic.

## Client-Side Throttling

When consuming rate-limited APIs, implement client-side throttling to avoid hitting limits.

```typescript
// Pseudocode — client-side rate limiter
class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number,
    private readonly refillRate: number, // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens <= 0) {
      const waitMs = (1 / this.refillRate) * 1000;
      await sleep(waitMs);
      this.refill();
    }
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate,
    );
    this.lastRefill = now;
  }
}
```

**Rules:**

- Parse `RateLimit-Remaining` headers to proactively slow down before hitting the limit.
- Honor `Retry-After` headers exactly — do not retry sooner.
- Implement backoff when receiving 429s (see `references/resilience.md`).

## Service Unavailable (503)

Distinct from rate limiting — `503` indicates the service is temporarily overloaded, not that the client is making too many requests.

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 60

{
  "type": "https://api.example.com/problems/service-unavailable",
  "title": "Service Unavailable",
  "status": 503,
  "detail": "The service is temporarily unavailable. Please retry after 60 seconds."
}
```

**Differences:**

- `429` = client is sending too many requests (client's fault).
- `503` = service is overloaded or in maintenance (server's fault).
- Both should include `Retry-After` headers.
- Both are **transient** and retryable.

## Rate Limit Design Guidelines

- **Start generous, tighten later.** It's easier to reduce limits than increase them (clients adapt to what they get).
- **Document limits clearly.** Include rate limits in API documentation and OpenAPI spec.
- **Different tiers:** Free tier: 100 req/min. Paid: 1000 req/min. Enterprise: custom.
- **Distinguish read vs. write:** Reads are cheap — allow higher limits. Writes are expensive — limit more aggressively.
- **Allow bursts:** Token bucket allows short bursts above steady-state rate. Better UX than fixed window.
- **Cost-based limiting:** Assign costs to different operations. A search query costs more than a simple GET.

## Anti-Patterns

- **No rate limiting:** Any client can flood the API. Always implement limits.
- **Rate limiting without headers:** Client has no way to know they're approaching the limit. Include RateLimit-\* headers.
- **429 without Retry-After:** Client doesn't know when to retry. Always include `Retry-After`.
- **Global rate limit only:** One limit shared across all endpoints. Use per-endpoint and per-tier limits.
- **Hard-coded limits in code:** Limits should be configurable without code changes. Use configuration/environment variables.
- **Blocking instead of rejecting:** Queuing excess requests silently. Return 429 immediately so the client can decide.
