---
name: api-design-pro
description: >-
  API design best practices for REST, resource modeling, versioning, error responses,
  pagination, and OpenAPI documentation. Use when designing or reviewing API endpoints.
---

Review API design for correctness, consistency, and adherence to REST best practices.

Load reference files from `.github/skills/api-design-pro/references/` as needed for specific topics:
- Resource modeling and URL structure
- HTTP methods and status codes
- Error response format
- Pagination strategies
- Versioning approaches
- Authentication patterns
- OpenAPI/Swagger documentation

## Core Instructions

- Use plural nouns for resource collections (`/users`, not `/user`).
- Use HTTP methods semantically: GET (read), POST (create), PUT (full replace), PATCH (partial update), DELETE (remove).
- Return appropriate status codes: 201 for creation, 204 for no-content deletes, 404 for not-found, 422 for validation errors.
- Use consistent error response shape across all endpoints.
- Support pagination for all list endpoints (cursor-based preferred over offset).
- Version APIs via URL prefix (`/v1/`) or header, not query parameters.
- Document all endpoints with OpenAPI 3.1 specifications.
- Never expose internal IDs, database structure, or stack traces in responses.
