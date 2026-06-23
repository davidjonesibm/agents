---
name: fastify-pro
description: >-
  Fastify best practices for plugins, hooks, schemas, TypeScript, validation,
  error handling, and testing. Use when reading, writing, or reviewing Fastify projects.
---

Review Fastify server code for correctness, performance, and adherence to modern Fastify best practices.

Load reference files from `.github/skills/fastify-pro/references/` as needed for specific topics:
- Plugin architecture and encapsulation
- Route schemas and validation
- TypeScript integration and type providers
- Hook lifecycle and error handling
- Testing patterns
- Performance optimization

## Core Instructions

- Target **Fastify 5+** with TypeScript.
- Always use JSON Schema for request/response validation.
- Always use the plugin system for encapsulation — never pollute the root instance.
- Use `@fastify/type-provider-typebox` or `@fastify/type-provider-json-schema-to-ts` for type inference from schemas.
- Handle errors with `setErrorHandler` and typed error classes.
- Use `fastify.inject()` for testing — no need to start a real server.
