# OpenAPI Documentation

Best practices for documenting APIs using OpenAPI Specification (OAS) 3.1. Based on the OpenAPI Specification and Swagger documentation.

## Structure Overview

```yaml
openapi: 3.1.0
info:
  title: Order Service API
  version: 1.0.0
  description: API for managing customer orders

servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://api.staging.example.com/v1
    description: Staging

paths:
  /orders:
    get: ...
    post: ...
  /orders/{orderId}:
    get: ...
    patch: ...
    delete: ...

components:
  schemas: ...
  securitySchemes: ...
  parameters: ...
  responses: ...
```

## Path & Operation Definitions

Every operation should include: `summary`, `operationId`, `parameters`, `requestBody`, `responses`, and `tags`.

```yaml
paths:
  /users/{userId}:
    get:
      tags:
        - Users
      summary: Get a user by ID
      description: Retrieves a specific user by their unique identifier.
      operationId: getUserById
      parameters:
        - name: userId
          in: path
          required: true
          description: Unique user identifier
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '404':
          description: User not found
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/Problem'
        default:
          description: Unexpected error
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/Problem'
```

**Rules:**

- Every operation must have a unique `operationId`. Used for SDK generation.
- Use `$ref` for all reusable schemas — never inline complex types.
- Use `tags` to group related operations (one tag per resource).
- Query parameters go in `parameters`, not in the path string.

## Schema Design

Define schemas in `components/schemas` and reference them throughout the spec.

```yaml
components:
  schemas:
    CreateUserRequest:
      type: object
      required: [name, email]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        email:
          type: string
          format: email
        age:
          type: integer
          minimum: 0
          maximum: 150
      additionalProperties: false

    UserResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        email:
          type: string
          format: email
        createdAt:
          type: string
          format: date-time

    Problem:
      type: object
      properties:
        type:
          type: string
          format: uri
          default: 'about:blank'
        title:
          type: string
        status:
          type: integer
        detail:
          type: string
        instance:
          type: string
          format: uri
```

**Rules:**

- Separate request and response schemas — they evolve independently (see `references/dtos.md`).
- Use `additionalProperties: false` for request schemas to reject unknown fields.
- Use standard formats: `date-time`, `email`, `uri`, `uuid`, `int32`, `int64`.
- Include `examples` for complex schemas.
- Use `required` arrays to mark mandatory properties.

## Component Reuse

Reuse schemas, parameters, responses, and headers via `$ref`.

```yaml
# Reusable pagination parameter
components:
  parameters:
    LimitParam:
      name: limit
      in: query
      description: Maximum number of items to return
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20

    CursorParam:
      name: cursor
      in: query
      description: Opaque pagination cursor
      schema:
        type: string

# Reusing in paths
paths:
  /orders:
    get:
      parameters:
        - $ref: '#/components/parameters/LimitParam'
        - $ref: '#/components/parameters/CursorParam'
```

```yaml
# Reusable error response
components:
  responses:
    NotFound:
      description: Resource not found
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/Problem'
    DefaultError:
      description: Unexpected error
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/Problem'

# Usage
paths:
  /users/{id}:
    get:
      responses:
        '404':
          $ref: '#/components/responses/NotFound'
        default:
          $ref: '#/components/responses/DefaultError'
```

## Security Scheme Definitions

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

    OAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/authorize
          tokenUrl: https://auth.example.com/token
          scopes:
            orders.read: Read access to orders
            orders.write: Write access to orders
            users.admin: Administrative user access

# Apply globally
security:
  - BearerAuth: []

# Override per-operation
paths:
  /orders:
    get:
      security:
        - OAuth2: [orders.read]
    post:
      security:
        - OAuth2: [orders.write]
  /public/health:
    get:
      security: [] # No auth required
```

## Examples

Provide examples for schemas, parameters, and responses to improve documentation clarity.

```yaml
components:
  schemas:
    UserResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        email:
          type: string
          format: email
      example:
        id: '550e8400-e29b-41d4-a716-446655440000'
        name: 'Alice Johnson'
        email: 'alice@example.com'
```

## Contract-First Design

1. Write the OpenAPI spec **before** implementing the API.
2. Generate server stubs and client SDKs from the spec.
3. Validate requests/responses against the spec in CI (contract testing).
4. Keep the spec as the **single source of truth** — code conforms to the spec, not the other way around.

## Anti-Patterns

- **No spec:** Building APIs without an OpenAPI document. Write the spec first.
- **Stale spec:** OpenAPI file doesn't match the actual API. Validate in CI.
- **Inline everything:** Complex schemas defined inline in every operation. Use `$ref` and `components/schemas`.
- **Missing operationId:** Operations without an `operationId`. Required for SDK generation.
- **No error schemas:** Only documenting success responses. Document errors with Problem schema.
- **Overly specific error responses:** Defining 401, 403, 404, 500 on every operation. Use `default` for common errors.
