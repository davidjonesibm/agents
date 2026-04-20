# Caching Strategies

HTTP caching, conditional requests, and ETag-based concurrency control. Based on RFC 9110 and Microsoft REST API Guidelines.

## HTTP Cache-Control

Use the `Cache-Control` response header to instruct clients and intermediaries on caching behavior.

**Common directives:**

| Directive         | Meaning                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `no-store`        | Never cache. Use for sensitive data (user profiles, financial data).       |
| `no-cache`        | Cache but revalidate every time (conditional request).                     |
| `private`         | Only the user's browser may cache (not CDNs or proxies).                   |
| `public`          | Any cache may store the response (CDNs, proxies).                          |
| `max-age=N`       | Cache is valid for N seconds from the response time.                       |
| `s-maxage=N`      | Override max-age for shared caches (CDNs).                                 |
| `immutable`       | Content will never change (use for versioned static assets).               |
| `must-revalidate` | After max-age expires, cache must revalidate before serving stale content. |

```http
# Cacheable for 1 hour, only in user's browser
Cache-Control: private, max-age=3600

# Cacheable by CDN for 5 minutes
Cache-Control: public, s-maxage=300

# Never cache (sensitive data)
Cache-Control: no-store

# Cache but always revalidate with ETag
Cache-Control: no-cache
```

**Rules:**

- Authenticated responses should use `Cache-Control: private` or `no-store`.
- Collection responses that change frequently: `no-cache` with ETag validation.
- Static reference data: `public, max-age=3600` (or longer with versioned URLs).
- Mutation responses (POST, PUT, PATCH, DELETE): `no-store`.

## ETag (Entity Tag)

A hash or version identifier for a resource's current state. Used for conditional requests and optimistic concurrency.

**Response with ETag:**

```http
HTTP/1.1 200 OK
ETag: "a1b2c3d4e5f6"
Content-Type: application/json

{ "id": "user1", "name": "Alice" }
```

**Types of ETags:**

- **Strong ETag** (`"abc123"`) — byte-for-byte identical representation.
- **Weak ETag** (`W/"abc123"`) — semantically equivalent (different encoding is OK).

**Rules:**

- Always return an `ETag` header for cacheable GET responses.
- Generate ETags from content hash, version number, or last-modified timestamp.
- ETags must change whenever the resource content changes.

## Conditional GET (Cache Validation)

Client sends the cached ETag to check if the resource has changed. Saves bandwidth when the resource hasn't changed.

**Request:**

```http
GET /users/42 HTTP/1.1
If-None-Match: "a1b2c3d4e5f6"
```

**Response (unchanged):**

```http
HTTP/1.1 304 Not Modified
ETag: "a1b2c3d4e5f6"
```

**Response (changed):**

```http
HTTP/1.1 200 OK
ETag: "new-etag-value"
Content-Type: application/json

{ "id": "user1", "name": "Alice Updated" }
```

**Rules:**

- Return `304 Not Modified` (no body) when the ETag matches — saves bandwidth.
- Return `200 OK` with the full resource and new ETag when it doesn't match.
- Support `If-None-Match` on all cacheable GET endpoints.

## Conditional Writes (Optimistic Concurrency)

Prevent lost updates when multiple clients modify the same resource concurrently.

**Read-modify-write cycle:**

```http
# 1. GET the resource with its ETag
GET /orders/42 HTTP/1.1

HTTP/1.1 200 OK
ETag: "version-1"
{ "id": "42", "status": "pending", "amount": 100 }

# 2. Update with If-Match to prevent lost update
PUT /orders/42 HTTP/1.1
If-Match: "version-1"
Content-Type: application/json

{ "id": "42", "status": "shipped", "amount": 100 }

# 3a. Success — ETag matched, update applied
HTTP/1.1 200 OK
ETag: "version-2"

# 3b. Conflict — another client modified the resource first
HTTP/1.1 412 Precondition Failed
```

**Alternative: Version-based concurrency (in the body):**

```http
# GET returns version in body
GET /orders/42
{ "id": "42", "version": 1, "status": "pending" }

# PUT includes version for conflict detection
PUT /orders/42
{ "id": "42", "version": 1, "status": "shipped" }

# Success: 200 OK (version incremented)
# Conflict: 409 Conflict (version mismatch)
```

**Rules:**

- Support `If-Match` header for PUT, PATCH, and DELETE operations on resources that may be concurrently modified.
- Return `412 Precondition Failed` when the ETag doesn't match.
- Clients should GET the latest resource and retry the update on `412`.

## Last-Modified Header

Alternative to ETags using timestamps. Less precise but simpler.

```http
# Response with Last-Modified
HTTP/1.1 200 OK
Last-Modified: Wed, 22 Jul 2024 19:15:56 GMT

# Conditional GET
GET /orders HTTP/1.1
If-Modified-Since: Wed, 22 Jul 2024 19:15:56 GMT

# Conditional update
PUT /orders/42 HTTP/1.1
If-Unmodified-Since: Wed, 22 Jul 2024 19:15:56 GMT
```

**Rules:**

- Prefer ETags over Last-Modified — timestamps have only 1-second resolution.
- Support both when possible (ETags for precision, Last-Modified for compatibility).
- Return both `ETag` and `Last-Modified` headers on cacheable responses.

## Application-Level Caching

For caching API responses within your own service layer (not HTTP caching).

**Strategies:**

- **Cache-aside:** Application checks cache, queries API on miss, stores result.
- **TTL-based:** Cache entries expire after a fixed duration.
- **Event-driven invalidation:** Cache is invalidated when the source data changes.

```typescript
// Pseudocode — cache-aside pattern
async function getUser(id: string): Promise<User> {
  const cached = await cache.get(`user:${id}`);
  if (cached) return cached;

  const user = await userManager.fetchById(id);
  await cache.set(`user:${id}`, user, { ttl: 300 }); // 5-minute TTL
  return user;
}
```

**Rules:**

- Set appropriate TTLs based on data volatility. User profiles: 5 min. Config data: 1 hour.
- Invalidate cache on writes — don't rely solely on TTL for consistency.
- Use cache stampede prevention (mutex/lock) for expensive queries fetched by many concurrent requests.
- Mark cached/stale responses clearly in logs for debugging.

## Anti-Patterns

- **No caching:** Every request hits the database or upstream API. Add appropriate HTTP caching headers.
- **Cache everything forever:** `max-age=99999999` with no invalidation. Data goes stale silently.
- **ETag without If-Match support:** Returning ETags but not supporting conditional writes. Implement both.
- **Caching mutations:** Caching POST/PUT/DELETE responses. Only cache GET responses.
- **Ignoring Vary:** Not including `Vary: Authorization` when responses differ per user. Leads to serving one user's data to another.
