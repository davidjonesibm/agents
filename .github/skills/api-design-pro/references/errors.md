# Error Handling Taxonomy

Consistent error handling across all API layers. Based on RFC 9457 (Problem Details for HTTP APIs), Microsoft REST API Guidelines, and Zalando RESTful API Guidelines.

## Error Response Format (RFC 9457)

Use the **Problem Details** format (`application/problem+json`) for all error responses.

```json
{
  "type": "https://api.example.com/problems/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 422,
  "detail": "Account balance is $30.00 but the transfer requires $50.00.",
  "instance": "/transfers/a]b4c5d6",
  "balance": 30.0,
  "required": 50.0
}
```

**Required fields:**

- `type` (string, URI) — Machine-readable problem type identifier. Defaults to `about:blank`.
- `title` (string) — Short human-readable summary of the problem type. Does not change between occurrences.
- `status` (integer) — HTTP status code.

**Optional fields:**

- `detail` (string) — Human-readable explanation specific to this occurrence.
- `instance` (string, URI) — URI identifying this specific occurrence (useful for log correlation).
- Extension fields — Additional properties specific to the problem type (e.g., `balance`, `retryAfter`).

## Error Taxonomy

### Client Errors (4xx)

Errors caused by the client. The request should not be retried without modification.

| Category       | Status | Error Code           | When                                                  |
| -------------- | ------ | -------------------- | ----------------------------------------------------- |
| Validation     | `400`  | `badRequest`         | Malformed syntax, missing required fields             |
| Validation     | `422`  | `validationError`    | Well-formed but semantically invalid (business rules) |
| Authentication | `401`  | `unauthorized`       | Missing or invalid credentials                        |
| Authorization  | `403`  | `forbidden`          | Valid credentials, insufficient permissions           |
| Not Found      | `404`  | `notFound`           | Resource does not exist                               |
| Conflict       | `409`  | `conflict`           | Concurrent modification, duplicate key                |
| Precondition   | `412`  | `preconditionFailed` | ETag/If-Match mismatch                                |
| Rate Limit     | `429`  | `tooManyRequests`    | Throttled (see `references/rate-limiting.md`)         |

### Server Errors (5xx)

Errors caused by the server. May be transient and retryable.

| Category | Status | Error Code            | When                                  |
| -------- | ------ | --------------------- | ------------------------------------- |
| Internal | `500`  | `internalServerError` | Unexpected failure                    |
| Upstream | `502`  | `badGateway`          | Dependency returned invalid response  |
| Overload | `503`  | `serviceUnavailable`  | Temporarily unable to handle requests |
| Timeout  | `504`  | `gatewayTimeout`      | Dependency did not respond in time    |

### Domain Errors

Business rule violations that don't map cleanly to HTTP status codes. Use `422` with a specific `type` URI.

```json
{
  "type": "https://api.example.com/problems/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 422,
  "detail": "Cannot process withdrawal. Available balance: $30.00, requested: $50.00."
}
```

### Transient Errors

Errors that may resolve on their own. Clients should retry with backoff.

**Transient indicators:**

- Status codes: `429`, `500`, `502`, `503`, `504`
- Network errors: connection refused, DNS resolution failure, socket timeout
- Headers: presence of `Retry-After`

**Non-transient indicators:**

- Status codes: `400`, `401`, `403`, `404`, `409`, `422`
- These will fail identically on retry — fix the request instead.

## Validation Error Format

Return **all** validation errors in one response. Include the field path for each error.

```json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Multiple validation errors in request body",
  "errors": [
    {
      "field": "email",
      "code": "invalidFormat",
      "message": "Must be a valid email address"
    },
    {
      "field": "age",
      "code": "outOfRange",
      "message": "Must be between 0 and 150"
    }
  ]
}
```

**Rules:**

- The top-level `code`/`type` identifies the category (`validationError`).
- Each entry in `errors` identifies the specific field and constraint violated.
- Use dot notation for nested field paths: `address.zipCode`.

## Error Propagation Across Layers

Each layer in the 3-layer architecture translates errors to its own abstraction level.

```
HTTP Client Error (e.g., 503 from Stripe)
    ↓ Resilience Layer: retries, opens circuit, wraps as TransientError
    ↓ Manager Layer: maps HTTP status to typed ApiError
    ↓ Service Layer: maps ApiError to domain error (PaymentDeclinedError)
    ↓ Controller/Handler: maps domain error to Problem Details response
```

**Rules:**

- Never let raw HTTP errors from external APIs leak to your API consumers.
- Wrap external errors with context: "Stripe API returned 503" → "Payment service temporarily unavailable".
- Log the original error with full details (status, headers, body) at the manager layer.
- Return a generic error to the consumer — never expose upstream API details.

```typescript
// Before (violation: leaking upstream error details)
app.get('/orders/:id', async (req, res) => {
  try {
    const order = await stripe.retrievePayment(req.params.id);
    return order;
  } catch (err) {
    // Leaks Stripe's error format to our consumers
    res.status(err.statusCode).send(err.raw);
  }
});

// After (correct: translate to own error format)
app.get('/orders/:id', async (req, res) => {
  try {
    const order = await orderService.getOrder(req.params.id);
    return order;
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).send({
        type: 'https://api.example.com/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Order ${req.params.id} not found.`,
      });
    }
    // Log original error, return generic to consumer
    log.error({ err, orderId: req.params.id }, 'Failed to retrieve order');
    return res.status(503).send({
      type: 'https://api.example.com/problems/service-unavailable',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Unable to retrieve order. Please retry later.',
    });
  }
});
```

## Error Code Mapping Strategy

Map the top-level error code to the HTTP status code. Use camelCase for error codes.

| HTTP Status | Error Code                                |
| ----------- | ----------------------------------------- |
| `400`       | `badRequest`                              |
| `401`       | `unauthorized`                            |
| `403`       | `forbidden`                               |
| `404`       | `notFound`                                |
| `409`       | `conflict`                                |
| `412`       | `preconditionFailed`                      |
| `422`       | `validationError` or domain-specific code |
| `429`       | `tooManyRequests`                         |
| `500`       | `internalServerError`                     |
| `503`       | `serviceUnavailable`                      |

## Security Considerations

- Return `404` instead of `403` when revealing resource existence is a security risk (e.g., user profiles, private repos).
- Never include stack traces in production error responses.
- Never include internal implementation details (database errors, file paths, class names).
- Log full error details server-side. Return only safe, meaningful messages to clients.
- Document top-level error codes — they are part of the API contract.
- Treat non-standard error fields as non-contractual debugging aids.

## OpenAPI Error Definition

Use the `default` response to handle standard errors without defining each one individually:

```yaml
responses:
  '200':
    description: Success
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/OrderResponse'
  default:
    description: Error occurred — see status code and problem object for details.
    content:
      application/problem+json:
        schema:
          $ref: '#/components/schemas/Problem'
```

## Anti-Patterns

- **Generic error messages:** `"An error occurred"` with no code, type, or field information. Use Problem Details.
- **200 for errors:** `{ "success": false, "error": "Something went wrong" }`. Use proper HTTP status codes.
- **Exposing upstream errors:** Forwarding a third-party API's error format directly to your consumers.
- **First-error-only:** Returning the first validation error and requiring the client to fix-and-retry. Return all errors.
- **String-only errors:** `{ "error": "Invalid email" }` with no structure. Use typed error codes and field paths.
- **Status code mismatch:** Returning `200` with `"status": 500` in the body. The HTTP status code must match.
