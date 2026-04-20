# Resilience Patterns

Resilience patterns protect applications from cascading failures when dependent services are slow, overloaded, or unavailable. All resilience logic belongs in the **resilience layer** (see `references/layers.md`).

## Circuit Breaker

Prevents repeated calls to a failing service. Tracks failure rate and "trips open" when a threshold is exceeded.

**States:**

- **Closed** — requests flow through normally; failures are counted
- **Open** — requests are rejected immediately without calling the service
- **Half-Open** — a limited number of test requests are allowed through to check recovery

**Configuration parameters:**

- `failureThreshold` — number/percentage of failures before opening (e.g., 5 failures or 50%)
- `successThreshold` — successes needed in half-open state to close the circuit
- `timeout` — how long to stay open before transitioning to half-open (e.g., 30s)

```typescript
// Pseudocode — framework-agnostic circuit breaker configuration
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5, // open after 5 consecutive failures
  successThreshold: 2, // close after 2 successes in half-open
  timeout: 30_000, // wait 30s before half-open
  resetTimeout: 60_000, // full reset window
});

// Usage
const result = await circuitBreaker.execute(() => httpClient.get('/api/data'));
```

**Rules:**

- Treat only transient errors as failures (5xx, timeouts, connection refused). Do not count 4xx client errors.
- Log state transitions (closed→open, open→half-open, half-open→closed).
- Return a fallback response when the circuit is open (see Fallback below).
- Use separate circuit breakers for different API endpoints or services.

## Retry with Exponential Backoff

Automatically retries failed requests with increasing delay between attempts.

**Formula:** `delay = baseDelay × 2^(attempt - 1) + jitter`

```typescript
// Pseudocode — retry with exponential backoff and jitter
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number; maxDelay: number },
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === options.maxRetries || !isTransient(error)) throw error;
      const jitter = Math.random() * 1000;
      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt - 1) + jitter,
        options.maxDelay,
      );
      await sleep(delay);
    }
  }
}
```

**Rules:**

- Always add **jitter** (random delay) to prevent thundering herd when multiple clients retry simultaneously.
- Set a **maximum delay cap** (e.g., 30s) to prevent unbounded waits.
- **Only retry transient errors:** 429 (Too Many Requests), 500, 502, 503, 504, connection timeouts, network errors.
- **Never retry:** 400, 401, 403, 404, 409, 422 — these are deterministic and will fail again.
- Respect the **Retry-After** header when present — use its value instead of calculated backoff.
- Set a **maximum total attempt count** (e.g., 3–5 attempts). More is rarely useful.

```typescript
// Before (violation: retries on all errors)
try {
  return await callApi();
} catch (err) {
  return await callApi(); // retries 400, 401, etc.
}

// After (correct: only retry transient errors)
const TRANSIENT_CODES = new Set([429, 500, 502, 503, 504]);

function isTransient(error: ApiError): boolean {
  return !error.status || TRANSIENT_CODES.has(error.status);
}
```

## Timeout

Prevents requests from hanging indefinitely when a service is slow.

**Rules:**

- Set **connection timeout** (time to establish connection) separately from **request timeout** (time for full response).
- Typical values: connection timeout 5s, request timeout 15–30s.
- Timeouts should be shorter than the circuit breaker's timeout window.
- Use AbortController/CancellationToken for cooperative cancellation.

```typescript
// Pseudocode — request with timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15_000);

try {
  const result = await fetch(url, { signal: controller.signal });
  return result;
} finally {
  clearTimeout(timeoutId);
}
```

## Bulkhead

Isolates different API consumers so that a failure in one does not consume all resources.

**Approaches:**

- **Thread/connection pool isolation** — each API integration gets its own pool
- **Semaphore isolation** — limits concurrent requests per integration
- **Queue isolation** — bounded queue per consumer

```typescript
// Pseudocode — semaphore-based bulkhead
class Bulkhead {
  private active = 0;
  constructor(private readonly maxConcurrent: number) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      throw new BulkheadRejectedException('Max concurrent requests exceeded');
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
    }
  }
}

// Usage — separate bulkheads per API
const paymentBulkhead = new Bulkhead(10); // max 10 concurrent payment API calls
const emailBulkhead = new Bulkhead(5); // max 5 concurrent email API calls
```

**Rules:**

- Size the bulkhead based on the downstream service's capacity — not your own.
- Reject immediately when full — do not queue (unless explicitly designed for it).
- Monitor rejection rate to detect capacity issues.

## Fallback

Provides a degraded-but-functional response when the primary path fails.

**Strategies:**

- **Cached value** — return the last known good response
- **Default value** — return a safe default
- **Alternative service** — call a backup API
- **Graceful degradation** — omit non-critical data from the response

```typescript
// Pseudocode — fallback with cached value
async function getProductCatalog(): Promise<Product[]> {
  try {
    return await productManager.fetchAll();
  } catch (error) {
    const cached = await cache.get<Product[]>('product-catalog');
    if (cached) {
      log.warn('Using cached catalog due to API failure');
      return cached;
    }
    throw error; // no fallback available
  }
}
```

**Rules:**

- Fallback responses should be clearly marked (e.g., add a `stale: true` flag or log a warning).
- Not every operation has a meaningful fallback. Payment processing should fail hard — stale data is dangerous.
- Fallback logic belongs in the **service layer**, not the resilience layer (the service knows what makes a valid fallback).

## Recommended Libraries by Language

| Language           | Library                                              | Notes                                                             |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------------------------- |
| TypeScript/Node.js | `cockatiel`                                          | Circuit breaker, retry, bulkhead, timeout as composable policies  |
| TypeScript/Node.js | `p-retry`, `p-timeout`                               | Lightweight retry and timeout for promises                        |
| Java/Kotlin        | `resilience4j`                                       | Industry standard; circuit breaker, retry, bulkhead, rate limiter |
| C#/.NET            | `Polly` (via `Microsoft.Extensions.Http.Resilience`) | First-party Microsoft integration                                 |
| Go                 | `sony/gobreaker`                                     | Circuit breaker; combine with `cenkalti/backoff` for retries      |
| Python             | `tenacity`                                           | Retry library; combine with `pybreaker` for circuit breaking      |

## Pattern Composition

Resilience patterns should be **composed in a specific order** (outermost to innermost):

```
Bulkhead → Circuit Breaker → Retry → Timeout → HTTP Call
```

1. **Bulkhead** limits concurrency (rejects early if at capacity)
2. **Circuit breaker** fails fast if the service is known to be down
3. **Retry** attempts the call multiple times with backoff
4. **Timeout** ensures each individual attempt doesn't hang
5. **HTTP call** is the actual request

```typescript
// Pseudocode — composed resilience pipeline
const pipeline = bulkhead.wrap(
  circuitBreaker.wrap(retry.wrap(timeout.wrap(httpCall))),
);
```

## Anti-Patterns

- **Retry without backoff:** Hammering a failing service with immediate retries makes overload worse.
- **Retrying non-idempotent operations:** Retrying a POST that creates a resource may cause duplicates. Use idempotency keys.
- **Infinite retries:** Always set a max attempt count. Unbounded retries waste resources.
- **Too-long timeouts:** A 60s timeout means blocked threads for a minute. Keep timeouts tight.
- **No jitter on retry:** Multiple clients with identical backoff schedules create thundering herd.
- **Circuit breaker too sensitive:** Tripping on 1–2 failures causes false positives. Require a window of failures.
