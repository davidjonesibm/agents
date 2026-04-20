# Pagination Patterns

Strategies for returning large collections in manageable pages. Based on Microsoft REST API Guidelines and Zalando RESTful API Guidelines.

## Strategy Comparison

| Strategy     | Best For                         | Pros                                          | Cons                                                         |
| ------------ | -------------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| Cursor-based | Real-time data, large datasets   | Consistent with concurrent writes, performant | Can't jump to arbitrary page                                 |
| Offset-based | Small/static datasets, admin UIs | Simple, supports page jumping                 | Inconsistent under concurrent writes, slow for large offsets |
| Keyset       | Sorted datasets, time-series     | Very performant, consistent                   | Requires a unique sortable column, can't jump to page        |

## Cursor-Based Pagination (Recommended)

Use an **opaque cursor** (encoded position) to navigate pages. The server returns a `nextCursor` that the client passes to get the next page.

**Request:**

```http
GET /orders?limit=20
GET /orders?limit=20&cursor=eyJpZCI6NDIsImNyZWF0ZWRBdCI6IjIwMjQtMDEtMTUifQ
```

**Response:**

```json
{
  "items": [
    { "id": "42", "name": "Order A", "createdAt": "2024-01-15T09:00:00Z" },
    { "id": "43", "name": "Order B", "createdAt": "2024-01-15T10:00:00Z" }
  ],
  "nextCursor": "eyJpZCI6NDMsImNyZWF0ZWRBdCI6IjIwMjQtMDEtMTVUMTA6MDA6MDBaIn0",
  "hasMore": true
}
```

**Cursor structure** (encoded, opaque to the client):

```json
{
  "position": { "id": 43, "createdAt": "2024-01-15T10:00:00Z" },
  "direction": "ASCENDING"
}
```

**Rules:**

- Cursors must be **opaque** to the client — use Base64 encoding or encrypted tokens.
- Include all fields needed to reconstruct the database query (sort key + unique tiebreaker).
- The cursor should not contain the query filters — those come from query parameters.
- Last page: omit `nextCursor` or set `hasMore: false`.

## Offset-Based Pagination

Use `offset` (or `skip`) and `limit` (or `top`) to specify the page window.

**Request:**

```http
GET /users?limit=10&offset=20
GET /users?$top=10&$skip=20
```

**Response:**

```json
{
  "items": [
    { "id": "21", "name": "User 21" },
    { "id": "22", "name": "User 22" }
  ],
  "totalCount": 150,
  "offset": 20,
  "limit": 10
}
```

**When to use:**

- Small datasets (< 10,000 records)
- Admin panels where "jump to page N" is needed
- Static or rarely-updated data

**Pitfalls:**

- `OFFSET 100000` is slow — the DB scans and discards 100,000 rows.
- Concurrent inserts/deletes cause items to be skipped or duplicated between pages.

## Server-Driven Pagination

The server controls page size and provides an opaque `nextLink` URL for the next page. The client follows the link without constructing URLs.

**Response (Microsoft pattern):**

```json
{
  "value": [
    { "id": "user1", "displayName": "Alice" },
    { "id": "user2", "displayName": "Bob" }
  ],
  "nextLink": "https://api.example.com/users?$skiptoken=opaque-token"
}
```

**Rules:**

- Always support server-driven paging, even if the dataset is currently small (avoids breaking changes later).
- The `nextLink` is opaque — clients must not parse, modify, or construct it.
- Last page: omit `nextLink`.
- Clients should follow `nextLink` to retrieve all pages in sequence.

## Pagination Links (HATEOAS)

Include navigation links for self, first, prev, next, last:

```json
{
  "self": "https://api.example.com/orders?cursor=abc123",
  "first": "https://api.example.com/orders",
  "prev": "https://api.example.com/orders?cursor=prev-token",
  "next": "https://api.example.com/orders?cursor=next-token",
  "last": "https://api.example.com/orders?cursor=last-token",
  "items": [...]
}
```

## Page Size

- **Default page size:** 20–50 items (configurable via `limit` or `pageSize` parameter).
- **Maximum page size:** Cap at 100–200 items to prevent DoS. Enforce server-side.
- Allow clients to request a preferred page size via `maxpagesize` preference:

```http
GET /users?maxpagesize=50
```

The server **may** return fewer items than requested but should not exceed the maximum.

## Consistent Response Shape

Use the same envelope structure for all paginated endpoints:

```typescript
// Generic paginated response
interface PaginatedResponse<T> {
  items: T[];
  totalCount?: number; // optional: expensive to compute for large datasets
  nextCursor?: string; // cursor-based: omit on last page
  hasMore?: boolean; // alternative to nextCursor presence check
}
```

**Rules:**

- `totalCount` is optional — computing exact counts on large tables is expensive. Omit if not needed.
- Return `200 OK` with an empty `items: []` array when no results match — never `404`.
- Include `totalCount` only if the UI genuinely needs it (e.g., "Showing 1–20 of 150").

## Anti-Patterns

- **No pagination:** Returning all 100,000 records in a single response. Always paginate.
- **Client-side pagination only:** Sending all data and letting the client paginate. Paginate server-side.
- **Offset on large tables:** Using offset-based pagination for datasets with millions of rows. Use cursor-based.
- **Exposing cursor internals:** Using raw database IDs or sequential integers as cursors. Encode/encrypt cursors.
- **Inconsistent page shapes:** Different envelope formats for different endpoints. Standardize.
- **No max page size:** Allowing clients to request `?limit=1000000`. Enforce a cap.
