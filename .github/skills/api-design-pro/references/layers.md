# 3-Layer API Connectivity Architecture

The 3-layer pattern separates external API integrations into three distinct layers, each with a single responsibility. This pattern applies to **consuming** external APIs (outbound), not to building your own API endpoints.

## Layer Overview

```
┌─────────────────────────────────────────────┐
│  Application Code (Controllers, Handlers)   │
├─────────────────────────────────────────────┤
│  Service Layer         ← Domain logic       │
│    ↓                                        │
│  Manager Layer         ← HTTP orchestration │
│    ↓                                        │
│  Resilience Layer      ← Fault tolerance    │
├─────────────────────────────────────────────┤
│  HTTP Client (fetch, axios, HttpClient)     │
└─────────────────────────────────────────────┘
```

## Layer 1: Service Layer

**Purpose:** Domain-specific business logic. Translates domain concepts into API calls and API responses into domain objects.

**Responsibilities:**

- Maps domain models to API request DTOs
- Maps API response DTOs to domain models
- Orchestrates multi-step API workflows (e.g., "create customer then create subscription")
- Applies business rules before/after API calls
- Owns the public interface used by application code

**Rules:**

- MUST NOT contain HTTP details (URLs, headers, status codes)
- MUST NOT handle retries or circuit-breaking
- MUST accept and return domain types, never raw HTTP responses
- MUST be injected with the manager layer (never instantiate directly)

```typescript
// Before (violation: service layer contains HTTP details)
class PaymentService {
  async charge(amount: number, currency: string) {
    const response = await fetch('https://api.stripe.com/v1/charges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ amount, currency }),
    });
    return response.json();
  }
}

// After (correct: service layer uses domain types)
class PaymentService {
  constructor(private readonly paymentManager: PaymentManager) {}

  async chargeCustomer(order: Order): Promise<PaymentResult> {
    const request = this.toChargeRequest(order);
    const response = await this.paymentManager.createCharge(request);
    return this.toPaymentResult(response);
  }

  private toChargeRequest(order: Order): CreateChargeRequest {
    /* mapping */
  }
  private toPaymentResult(response: ChargeResponse): PaymentResult {
    /* mapping */
  }
}
```

## Layer 2: Manager Layer

**Purpose:** HTTP orchestration. Handles request construction, authentication, URL building, header management, and response parsing.

**Responsibilities:**

- Constructs HTTP requests (URL, method, headers, body serialization)
- Manages authentication (API keys, tokens, OAuth flows)
- Parses HTTP responses into typed DTOs
- Maps HTTP status codes to typed errors
- Handles request-specific concerns (content negotiation, query parameters)

**Rules:**

- MUST NOT contain business logic
- MUST NOT handle retries, circuit-breaking, or timeouts (delegate to resilience layer)
- MUST accept and return DTO types
- MUST be injected with the resilience layer (never call HTTP client directly)

```typescript
// Before (violation: manager handles retries)
class PaymentManager {
  async createCharge(request: CreateChargeRequest): Promise<ChargeResponse> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.httpClient.post('/charges', request);
        return response.data;
      } catch (err) {
        if (attempt === 2) throw err;
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
}

// After (correct: manager delegates to resilience layer)
class PaymentManager {
  constructor(private readonly resilience: ResilienceLayer) {}

  async createCharge(request: CreateChargeRequest): Promise<ChargeResponse> {
    const response = await this.resilience.execute(() =>
      this.buildRequest('POST', '/v1/charges', request),
    );
    return this.parseResponse<ChargeResponse>(response);
  }

  private buildRequest(
    method: string,
    path: string,
    body: unknown,
  ): HttpRequest {
    return {
      method,
      url: `${this.baseUrl}${path}`,
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    };
  }
}
```

## Layer 3: Resilience Layer

**Purpose:** Fault tolerance. Wraps HTTP calls with resilience patterns to handle transient failures gracefully.

**Responsibilities:**

- Retry with exponential backoff for transient errors
- Circuit-breaking to prevent cascading failures
- Timeouts to prevent hanging requests
- Bulkhead isolation between different API consumers
- Fallback responses when all retries are exhausted

**Rules:**

- MUST NOT contain business logic
- MUST NOT understand API-specific request construction
- MUST be generic and reusable across different API integrations
- MUST be configurable per-integration (different timeout/retry settings)

See `references/resilience.md` for detailed resilience pattern implementations.

## Dependency Direction

Dependencies flow **inward only**: Service → Manager → Resilience → HTTP Client.

```
Application Code
      │
      ▼
Service Layer (domain logic, DTO mapping)
      │ depends on
      ▼
Manager Layer (HTTP construction, auth, parsing)
      │ depends on
      ▼
Resilience Layer (retry, circuit breaker, timeout)
      │ depends on
      ▼
HTTP Client (fetch, axios, node-fetch, HttpClient)
```

- **Never skip layers.** The service layer must not call the HTTP client directly.
- **Inject dependencies.** Each layer receives its dependency via constructor injection.
- **One manager per external API.** Each third-party API gets its own manager instance.
- **Shared resilience config.** Multiple managers can share a resilience layer with different configurations.

## When This Pattern Applies

| Scenario                                              | Use 3-layer?                             |
| ----------------------------------------------------- | ---------------------------------------- |
| Consuming an external REST API (Stripe, Twilio, etc.) | **Yes**                                  |
| Calling an internal microservice                      | **Yes** (same failure modes apply)       |
| Simple config fetch at startup                        | Optional (consider a simpler wrapper)    |
| Database access                                       | **No** (use repository pattern instead)  |
| Building your own API endpoints                       | **No** (use controller/handler patterns) |

## Anti-Patterns

- **Fat service:** Service layer contains HTTP construction, auth, and retry logic — all in one class. Split into three layers.
- **Leaky abstraction:** Service layer returns raw HTTP response objects or status codes to application code. Map to domain types.
- **Resilience at the wrong layer:** Retry logic in the service or manager layer. Move to resilience layer.
- **Shared manager:** One manager class handles multiple unrelated APIs. Create one manager per API.
- **Direct instantiation:** Layers create their dependencies with `new`. Use constructor injection.
