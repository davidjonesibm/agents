# DTO Design

Data Transfer Objects (DTOs) define the shape of data crossing API boundaries. Separate request DTOs from response DTOs — they serve different purposes and evolve independently.

## Request / Response Separation

- **Request DTOs** define what the client sends. Include only writable fields.
- **Response DTOs** define what the server returns. Include computed fields, timestamps, links.
- Never reuse the same type for both request and response.

```typescript
// Before (violation: same type for request and response)
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  passwordHash: string;
}

// After (correct: separate request and response)
interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  // no passwordHash — never expose internal fields
}
```

## Naming Conventions

| DTO Type       | Convention                                                     | Example              |
| -------------- | -------------------------------------------------------------- | -------------------- |
| Create request | `Create{Resource}Request`                                      | `CreateOrderRequest` |
| Update request | `Update{Resource}Request`                                      | `UpdateOrderRequest` |
| Response       | `{Resource}Response`                                           | `OrderResponse`      |
| List response  | `{Resource}ListResponse` or `PaginatedResponse<OrderResponse>` | —                    |
| Patch request  | `Patch{Resource}Request`                                       | `PatchOrderRequest`  |

## Property Naming

- Use **camelCase** for JSON properties in JavaScript/TypeScript ecosystems.
- Use **snake_case** for JSON properties in Python/Ruby ecosystems.
- Be consistent within an API — never mix casing styles.
- Use clear, unambiguous names. Avoid abbreviations.

```json
// Before (inconsistent casing, abbreviations)
{
  "usr_nm": "Alice",
  "emailAddress": "alice@example.com",
  "created_at": "2024-01-15"
}

// After (consistent camelCase)
{
  "userName": "Alice",
  "emailAddress": "alice@example.com",
  "createdAt": "2024-01-15"
}
```

## Validation Rules

Validate **all** input at system boundaries (API handler / route level). Never trust client input.

**What to validate:**

- **Required fields** — reject requests missing mandatory properties
- **Type constraints** — string, number, boolean, array, object
- **Format constraints** — email, URL, UUID, date-time (ISO 8601), phone number
- **Range constraints** — min/max for numbers, minLength/maxLength for strings
- **Enum constraints** — value must be one of a predefined set
- **Pattern constraints** — regex for structured strings (e.g., phone numbers)

```typescript
// Pseudocode — schema validation (framework-agnostic)
const CreateUserSchema = {
  type: 'object',
  required: ['name', 'email'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string', format: 'email' },
    age: { type: 'integer', minimum: 0, maximum: 150 },
    role: { type: 'string', enum: ['user', 'admin', 'moderator'] },
  },
  additionalProperties: false,
};
```

**Rules:**

- Use JSON Schema or framework-native validation (Fastify schema, Zod, FluentValidation, Pydantic).
- Set `additionalProperties: false` to reject unknown fields (prevents mass-assignment attacks).
- Return **all** validation errors at once — not just the first one found.

```json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation Failed",
  "status": 422,
  "detail": "Multiple validation errors occurred",
  "errors": [
    { "field": "email", "message": "Must be a valid email address" },
    { "field": "name", "message": "Must not be empty" }
  ]
}
```

## Mapping Between Layers

DTO mapping should be explicit and auditable. Avoid implicit mapping (e.g., spreading raw objects).

```typescript
// Before (violation: spreading unknown properties)
function createUserResponse(dbRecord: any): UserResponse {
  return { ...dbRecord };
}

// After (correct: explicit field mapping)
function createUserResponse(dbRecord: UserRecord): UserResponse {
  return {
    id: dbRecord.id,
    name: dbRecord.name,
    email: dbRecord.email,
    createdAt: dbRecord.created_at.toISOString(),
  };
}
```

**Rules:**

- Map explicitly — list every field. Never spread or Object.assign from untrusted sources.
- Map at layer boundaries: DB record → Domain model → Response DTO.
- Handle `null` vs `undefined` explicitly: use `null` for "no value" in JSON, never `undefined`.

## Date/Time Format

- Always use **ISO 8601** format: `2024-01-15T09:30:00Z`.
- Always include timezone (prefer UTC with `Z` suffix).
- Use `string` type with `format: date-time` in schemas.

## Partial Updates (PATCH)

Use **JSON Merge Patch** (RFC 7396) for partial updates. Only include fields that are changing.

```http
PATCH /users/42 HTTP/1.1
Content-Type: application/merge-patch+json

{
  "name": "Updated Name"
}
```

**Rules:**

- Omitted fields remain unchanged.
- Setting a field to `null` removes it.
- Patch request DTOs should have all properties optional.

```typescript
// Patch request — all fields optional
interface PatchUserRequest {
  name?: string;
  email?: string;
  age?: number | null; // null means "remove this value"
}
```

## Envelope vs. Flat Responses

For single resources, return the resource directly (flat):

```json
{ "id": "42", "name": "Alice", "email": "alice@example.com" }
```

For collections, use an envelope with a `value` or `items` array:

```json
{
  "items": [
    { "id": "42", "name": "Alice" },
    { "id": "43", "name": "Bob" }
  ],
  "totalCount": 150,
  "nextCursor": "eyJpZCI6NDN9"
}
```

## Anti-Patterns

- **Reusing DB models as DTOs:** Exposes internal schema, leaks sensitive fields, and couples API to database.
- **Accepting arbitrary JSON:** No schema validation. Leads to injection and type confusion.
- **Returning `undefined` in JSON:** JSON has no `undefined`. Use `null` for absent values or omit the key.
- **Inconsistent date formats:** Mixing Unix timestamps, locale-specific strings, and ISO 8601 in the same API.
- **Over-fetching:** Returning 50 fields when the client needs 3. Use field selection or purpose-built response DTOs.
