# RESTful API Design

Conventions for designing RESTful APIs based on Microsoft REST API Guidelines, Zalando RESTful API Guidelines, and industry standards.

## Resource Naming

- Use **plural nouns** for collection resources: `/users`, `/orders`, `/products`.
- Use **lowercase with hyphens** (kebab-case) for multi-word paths: `/shopping-carts`, `/general-deliveries`.
- Resource names represent **things (nouns)**, not actions (verbs).
- Use **path segments** to express hierarchy: `/customers/{id}/addresses/{addr}`.

```
# Before (violation: verb in URL, camelCase)
POST /createUser
GET  /getUserById?id=42
POST /api/sendEmail

# After (correct: nouns, plural, kebab-case)
POST /users
GET  /users/42
POST /emails
```

**Rules:**

- Each sub-path must be a valid reference: `/shopping-carts/de:1681e6b88ec1/items/1` implies `/shopping-carts/de:1681e6b88ec1` and `/shopping-carts` are also valid.
- Limit nesting depth to 2–3 levels. Flatten deep hierarchies by promoting sub-resources to top-level.

```
# Before (too deeply nested)
/users/{userId}/offers/{offerId}/shipments/{shipmentId}

# After (flattened)
/users/{userId}
/users/{userId}/offers
/offers/{offerId}
/offers/{offerId}/shipments
/shipments/{shipmentId}
```

## HTTP Methods

| Method   | Purpose                             | Idempotent | Safe | Request Body |
| -------- | ----------------------------------- | ---------- | ---- | ------------ |
| `GET`    | Read resource(s)                    | Yes        | Yes  | No           |
| `POST`   | Create resource (server assigns ID) | No\*       | No   | Yes          |
| `PUT`    | Create/replace entire resource      | Yes        | No   | Yes          |
| `PATCH`  | Partial update (JSON Merge Patch)   | Yes\*\*    | No   | Yes          |
| `DELETE` | Remove resource                     | Yes        | No   | No           |

\*POST can be made idempotent with idempotency keys (see below).
\*\*PATCH with JSON Merge Patch is idempotent; JSON Patch operations may not be.

**Rules:**

- Use `GET` for listing and reading. Never use `GET` to modify state.
- Use `POST` for creating resources where the server assigns the ID.
- Use `PUT` or `PATCH` for upsert when the client provides the key.
- Prefer `PATCH` over `PUT` for updates — `PUT` requires sending the full resource.
- Never use `PUT` on a collection (e.g., `PUT /users` to replace all users).
- Treat method names as **case-sensitive** and always use uppercase.

## HTTP Status Codes

### Success Codes

| Code             | When to Use                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| `200 OK`         | Successful GET, PUT, PATCH, or POST action (with response body)             |
| `201 Created`    | Successful POST/PUT that creates a new resource. Include `Location` header. |
| `202 Accepted`   | Request accepted for async processing. Return status monitor URL.           |
| `204 No Content` | Successful DELETE or update with no response body                           |

### Client Error Codes

| Code                       | When to Use                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| `400 Bad Request`          | Malformed syntax, invalid request, or semantic validation failure              |
| `401 Unauthorized`         | Missing or invalid credentials (unauthenticated)                               |
| `403 Forbidden`            | Valid credentials but insufficient permissions (unauthorized)                  |
| `404 Not Found`            | Resource does not exist. Also use instead of 403 when existence is sensitive.  |
| `409 Conflict`             | Resource conflict (e.g., concurrent modification, unique constraint violation) |
| `412 Precondition Failed`  | Conditional request header (If-Match/If-Unmodified-Since) check failed         |
| `422 Unprocessable Entity` | Well-formed request but business rule validation failure                       |
| `429 Too Many Requests`    | Rate limit exceeded (see `references/rate-limiting.md`)                        |

### Server Error Codes

| Code                        | When to Use                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `500 Internal Server Error` | Unexpected server failure                                     |
| `502 Bad Gateway`           | Upstream service returned an invalid response                 |
| `503 Service Unavailable`   | Service temporarily overloaded. Include `Retry-After` header. |
| `504 Gateway Timeout`       | Upstream service did not respond in time                      |

**Rules:**

- Return `200 OK` with an empty `value: []` array when a filtered collection yields no results (not 404).
- Return `404` instead of `403` when revealing resource existence would be a security risk.
- Never return `200` for failed operations — use appropriate 4xx/5xx codes.
- Avoid `301`/`302`/`307`/`308` redirect codes in APIs.

## Idempotency

All HTTP methods should be idempotent — calling them N times produces the same result as calling once.

- `GET`, `PUT`, `DELETE` are inherently idempotent per HTTP spec.
- Make `POST` idempotent using **idempotency keys**:

```http
POST /orders HTTP/1.1
Content-Type: application/json
Idempotency-Key: 4227cdc5-9f48-4e84-921a-10967cb785a0

{ "product": "Widget", "quantity": 5 }
```

**Rules:**

- Servers must store the idempotency key and return the original response on retry.
- Keys should be UUIDs generated by the client.
- Keys should expire after a reasonable period (e.g., 24–48 hours).
- If the same key is reused with a different payload, return `422 Unprocessable Entity`.

## HATEOAS (Hypermedia Controls)

APIs may include links to related resources and actions in responses. Use standard link relations.

```json
{
  "id": "order-42",
  "status": "shipped",
  "_links": {
    "self": { "href": "/orders/42" },
    "cancel": { "href": "/orders/42/cancel", "method": "POST" },
    "customer": { "href": "/customers/7" }
  }
}
```

**When to use HATEOAS:**

- Public APIs with diverse consumers who need discoverability
- APIs where available actions depend on resource state (e.g., can only cancel a non-shipped order)

**When to skip HATEOAS:**

- Internal APIs with known consumers
- Simple CRUD APIs without complex state transitions

## Content Negotiation

- Use `application/json` as the default content type.
- Use `application/problem+json` for error responses (RFC 9457).
- Support `Accept-Encoding: gzip` for response compression.

## Query Parameters

- Use query parameters for **filtering**, **sorting**, **pagination**, and **field selection**.
- Use consistent naming: `?status=active&sort=created_at&order=desc&limit=20`.
- Do not include query strings in the OpenAPI path definition — define them separately as parameters.

## Anti-Patterns

- **Verbs in URLs:** `POST /createUser` → `POST /users`
- **Ignoring HTTP semantics:** Using POST for everything including reads.
- **200 for errors:** Returning 200 with `{ "success": false }` in the body.
- **Leaking implementation:** `/api/v1/MySqlUsers/getById` exposes database details.
- **Inconsistent pluralization:** Mixing `/user` and `/orders` in the same API.
- **Deep nesting:** More than 3 levels of path nesting. Flatten to root resources.
