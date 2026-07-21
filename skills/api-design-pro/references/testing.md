# Testing API Integrations

Patterns for testing API connectivity layers, contract compliance, and resilience behavior.

## Test Pyramid for API Layers

```
        ╱ E2E Tests ╲        — Few: real HTTP against staging environment
       ╱──────────────╲
      ╱ Integration    ╲     — Some: real HTTP against test doubles
     ╱──────────────────╲
    ╱   Unit Tests       ╲   — Many: test each layer in isolation
   ╱──────────────────────╲
```

## Unit Testing Each Layer

### Service Layer Tests

Test business logic and DTO mapping. Mock the manager layer.

```typescript
// Pseudocode — service layer unit test
describe('OrderService', () => {
  it('maps domain order to charge request', async () => {
    const mockManager = {
      createCharge: vi.fn().mockResolvedValue({
        id: 'ch_123',
        status: 'succeeded',
        amount: 5000,
      }),
    };
    const service = new OrderService(mockManager);

    const result = await service.processPayment({
      orderId: 'order-1',
      amount: 50.0,
      currency: 'USD',
    });

    expect(mockManager.createCharge).toHaveBeenCalledWith({
      amount: 5000, // cents conversion
      currency: 'usd', // lowercase
      metadata: { orderId: 'order-1' },
    });
    expect(result.status).toBe('paid');
  });
});
```

**What to test in the service layer:**

- Domain model → request DTO mapping
- Response DTO → domain model mapping
- Business rule enforcement (validation, preconditions)
- Multi-step orchestration logic
- Error translation (API errors → domain errors)

### Manager Layer Tests

Test HTTP request construction and response parsing. Mock the resilience layer / HTTP client.

```typescript
// Pseudocode — manager layer unit test
describe('PaymentManager', () => {
  it('constructs correct HTTP request for charge creation', async () => {
    const mockResilience = {
      execute: vi.fn().mockResolvedValue({
        status: 200,
        body: { id: 'ch_123', status: 'succeeded' },
      }),
    };
    const manager = new PaymentManager(mockResilience, {
      baseUrl: 'https://api.stripe.com',
      apiKey: 'sk_test_123',
    });

    await manager.createCharge({ amount: 5000, currency: 'usd' });

    const call = mockResilience.execute.mock.calls[0][0];
    const request = await call();
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://api.stripe.com/v1/charges');
    expect(request.headers['Authorization']).toBe('Bearer sk_test_123');
  });

  it('maps 402 response to PaymentDeclinedError', async () => {
    const mockResilience = {
      execute: vi.fn().mockRejectedValue({
        status: 402,
        body: { error: { code: 'card_declined' } },
      }),
    };
    const manager = new PaymentManager(mockResilience, config);

    await expect(manager.createCharge(request)).rejects.toBeInstanceOf(
      PaymentDeclinedError,
    );
  });
});
```

**What to test in the manager layer:**

- URL construction with path and query parameters
- Header assembly (auth, content-type, custom headers)
- Request body serialization
- Response status code → error type mapping
- Response body deserialization

### Resilience Layer Tests

Test retry behavior, circuit breaker state transitions, and timeout handling.

```typescript
// Pseudocode — resilience layer unit test
describe('RetryPolicy', () => {
  it('retries transient errors up to max attempts', async () => {
    const callCount = { value: 0 };
    const fn = async () => {
      callCount.value++;
      if (callCount.value < 3) throw new TransientError(503);
      return { status: 200, body: 'ok' };
    };

    const result = await retryPolicy.execute(fn);

    expect(callCount.value).toBe(3);
    expect(result.body).toBe('ok');
  });

  it('does not retry client errors', async () => {
    const fn = vi.fn().mockRejectedValue(new ClientError(400));

    await expect(retryPolicy.execute(fn)).rejects.toThrow(ClientError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('CircuitBreaker', () => {
  it('opens after failure threshold and rejects immediately', async () => {
    const failingFn = vi.fn().mockRejectedValue(new TransientError(500));

    // Exhaust failure threshold
    for (let i = 0; i < 5; i++) {
      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
    }

    // Next call should be rejected immediately (circuit open)
    await expect(circuitBreaker.execute(failingFn)).rejects.toThrow(
      CircuitOpenError,
    );
    expect(failingFn).toHaveBeenCalledTimes(5); // not 6
  });
});
```

## Integration Testing

Test the full layer stack against a controlled HTTP server (test double).

```typescript
// Pseudocode — integration test with HTTP test double
describe('PaymentIntegration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await createTestServer();
    server.on('POST', '/v1/charges', (req) => {
      if (req.body.amount > 100000) {
        return { status: 402, body: { error: { code: 'amount_too_large' } } };
      }
      return {
        status: 200,
        body: { id: `ch_${Date.now()}`, status: 'succeeded' },
      };
    });
  });

  afterAll(() => server.close());

  it('processes a payment end-to-end', async () => {
    const service = createPaymentService({ baseUrl: server.url });
    const result = await service.processPayment({
      orderId: 'order-1',
      amount: 50.0,
      currency: 'USD',
    });
    expect(result.status).toBe('paid');
  });

  it('handles declined payment', async () => {
    const service = createPaymentService({ baseUrl: server.url });
    await expect(
      service.processPayment({
        orderId: 'order-2',
        amount: 1500.0, // triggers 402
        currency: 'USD',
      }),
    ).rejects.toThrow(PaymentDeclinedError);
  });
});
```

## Contract Testing

Validate that your API implementation matches the OpenAPI specification.

**Approaches:**

- **Schema validation in CI:** Run requests against the API and validate responses match the OpenAPI schema.
- **Consumer-driven contracts:** Consumers define expected request/response pairs. Provider verifies them.
- **Spec-first validation:** Generate tests from the OpenAPI spec and run them against the implementation.

**Rules:**

- Run contract tests in CI on every PR.
- Test both success and error response shapes.
- Validate required fields, types, and formats.
- Test boundary conditions (empty collections, max-length strings, null values).

## Testing Resilience Behavior

**Fault injection tests:**

- Simulate network timeouts → verify timeout handling
- Simulate 500 errors → verify retry with backoff
- Simulate sustained failures → verify circuit breaker opens
- Simulate rate limiting (429) → verify Retry-After is respected
- Simulate slow responses → verify timeout kicks in

```typescript
// Pseudocode — fault injection test
describe('Resilience under failure', () => {
  it('retries on 503 and succeeds on third attempt', async () => {
    let callCount = 0;
    server.on('GET', '/data', () => {
      callCount++;
      if (callCount < 3) return { status: 503 };
      return { status: 200, body: { data: 'success' } };
    });

    const result = await service.getData();

    expect(result.data).toBe('success');
    expect(callCount).toBe(3);
  });

  it('respects Retry-After header on 429', async () => {
    const startTime = Date.now();
    server.on(
      'GET',
      '/data',
      () => ({
        status: 429,
        headers: { 'Retry-After': '1' },
      }),
      { times: 1 },
    );
    server.on('GET', '/data', () => ({
      status: 200,
      body: { data: 'ok' },
    }));

    await service.getData();
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });
});
```

## Test Doubles Hierarchy

| Type     | Purpose                                                       | When                            |
| -------- | ------------------------------------------------------------- | ------------------------------- |
| **Mock** | Verify interactions (was this method called with these args?) | Unit tests for layer boundaries |
| **Stub** | Return canned responses                                       | Unit tests for response mapping |
| **Fake** | Simplified working implementation (in-memory server)          | Integration tests               |
| **Spy**  | Record calls for later assertion                              | Verifying retry counts, timing  |

## Anti-Patterns

- **Testing against production APIs:** Slow, flaky, and may incur costs. Use test doubles.
- **No error path tests:** Only testing the happy path. Test every error status code your API can return.
- **Mocking internal implementation:** Mocking private methods. Mock at layer boundaries only.
- **No resilience tests:** Assuming retry/circuit-breaker logic works. Test with fault injection.
- **Snapshot testing for APIs:** Brittle and hides intent. Assert specific fields and status codes.
- **Shared test state:** Tests depend on order or shared data. Each test should set up its own state.
