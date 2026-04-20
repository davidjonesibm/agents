# API Versioning

Strategies for evolving APIs without breaking existing clients. Based on Microsoft REST API Guidelines and Zalando RESTful API Guidelines.

## Versioning Strategies

### 1. Query Parameter Versioning (Microsoft Pattern)

Version is a **required** query parameter on every request. Uses date-based versions (`YYYY-MM-DD`).

```http
GET /users?api-version=2024-01-15
POST /orders?api-version=2024-06-01
```

**Preview versions** use a `-preview` suffix:

```http
GET /users?api-version=2024-03-01-preview
```

**Pros:** Clear version in every request, supports date-based versioning, easy to log and debug.
**Cons:** Clutters URLs, requires version on every single request.

**Error for missing version:**

```json
{
  "error": {
    "code": "MissingApiVersionParameter",
    "message": "The api-version query parameter is required for all requests."
  }
}
```

### 2. URL Path Versioning

Version is embedded in the URL path prefix.

```http
GET /v1/users
GET /v2/users
```

**Pros:** Most widely understood, easy to route at load balancer/gateway level.
**Cons:** Changes the resource URL, breaks bookmarks and caches, proliferates routes.

**Rules:**

- Use `v{N}` prefix (integer, not date): `/v1/`, `/v2/`.
- When possible, redirect old versions to new: `GET /v1/users` → `301 /v2/users`.

### 3. Header/Media Type Versioning (Zalando Pattern)

Version is specified via `Accept` or `Content-Type` headers with custom media types.

```http
Accept: application/vnd.example.v2+json
Content-Type: application/vnd.example.v1+json
```

**Pros:** Clean URLs, version decoupled from resource identity.
**Cons:** Harder to test (can't just change URL), less visible in logs.

### 4. No Versioning (Evolutionary Design)

Evolve the API in a backward-compatible way. Never introduce breaking changes.

**Backward-compatible changes (safe):**

- Adding new optional fields to responses
- Adding new optional query parameters
- Adding new endpoints
- Adding new enum values (if extensible)
- Relaxing validation constraints

**Breaking changes (require new version):**

- Removing or renaming fields
- Changing a field's type
- Making an optional field required
- Changing the meaning of an existing field
- Removing endpoints
- Changing URL structure

## Recommended Approach

Pick **one** strategy and apply it consistently across all APIs. For most projects:

1. **Internal APIs:** Prefer evolutionary design (no explicit versioning). Add fields, never remove.
2. **Public APIs:** Use URL path versioning (`/v1/`) or query parameter versioning.
3. **Enterprise/platform APIs:** Use date-based query parameter versioning for granular control.

## Deprecation Protocol

When deprecating API features, signal it well in advance using standard headers.

**Response headers for deprecated features:**

```http
Deprecation: @1758095283
Sunset: Wed, 31 Dec 2025 23:59:59 GMT
```

- `Deprecation` (RFC 9745) — Timestamp when the feature was deprecated, or `true` if already deprecated.
- `Sunset` (RFC 8594) — Date when the feature will stop working.

**OpenAPI definition for deprecation headers:**

```yaml
components:
  headers:
    Deprecation:
      schema:
        type: string
        format: date-timestamp
      example: '@1758093035'
    Sunset:
      schema:
        type: string
        format: http-date
      example: 'Wed, 31 Dec 2025 23:59:59 GMT'
```

**Rules:**

- Announce deprecation **at least 6 months** before sunset for public APIs.
- Include migration guidance in API documentation and changelog.
- Monitor usage of deprecated endpoints. Contact consumers who haven't migrated.
- After sunset date, return `410 Gone` instead of silently breaking.

## Compatibility Rules

- Do **not** add new required request fields to existing endpoints — it breaks existing clients.
- Do **not** remove or rename response fields — existing clients may depend on them.
- Do **not** change error code values — clients may have logic that matches on them.
- **Do** add new optional response fields freely.
- **Do** add new endpoints freely.
- **Do** use `x-extensible-enum` or open enum patterns so new values don't break strict parsers.

```typescript
// Before (violation: adding required field is breaking)
// v1: POST /users { name: string }
// v2: POST /users { name: string, email: string }  ← email is required, breaks v1 clients

// After (correct: new fields are optional with defaults)
// v1: POST /users { name: string }
// v2: POST /users { name: string, email?: string }  ← email is optional
```

## Anti-Patterns

- **Versioning too eagerly:** Creating v2 for minor additions. Evolve instead.
- **Multiple active versions:** Supporting v1, v2, v3, v4 simultaneously. Sunset aggressively.
- **Mixed strategies:** Using URL versioning for some endpoints and header versioning for others.
- **Breaking without versioning:** Removing fields or changing types without bumping the version.
- **Silent deprecation:** Removing features without advance notice or sunset headers.
