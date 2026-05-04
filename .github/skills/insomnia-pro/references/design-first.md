# Design-First Workflow

Design-first API development with Insomnia 12.5+: OpenAPI spec authoring, live preview, Spectral linting, custom rules, collection generation from design documents, and CLI lint integration.

## Design Documents vs Collections

| Concept                 | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| **Design Document**     | OpenAPI spec authoring with live preview and linting |
| **Collection**          | Groups of requests for testing and debugging         |
| **Generate Collection** | Creates a Collection from a Design Document          |

**Best practice:** Start with a Design Document, author the spec, generate a Collection, then test against it. Never skip the spec authoring step for APIs intended to be shared or published.

## Creating a Design Document

1. **New → Design Document** in a project.
2. Select the storage backend (Git Sync recommended for team collaboration — see `references/collaboration.md`).
3. Insomnia opens a split-pane editor: YAML/JSON on the left, live preview on the right.

## OpenAPI Authoring

Insomnia supports **OpenAPI 3.0 and 3.1**. The editor provides:

- Syntax highlighting and auto-completion.
- Real-time validation with inline error markers.
- Automatic Spectral linting on every change.

```yaml
# openapi.yaml — minimal valid OpenAPI 3.1 document
openapi: '3.1.0'
info:
  title: My API
  version: '1.0.0'
paths:
  /users/{id}:
    get:
      operationId: getUser
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
components:
  schemas:
    User:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
        name:
          type: string
```

## Spectral Linting

Insomnia runs [Spectral](https://stoplight.io/open-source/spectral) lint rules on the Design Document automatically. Built-in rules cover the OAS ruleset (operation IDs, response schemas, required fields, etc.).

### Viewing Lint Errors

Lint errors appear inline in the editor and in the **Problems** panel at the bottom of the Design view.

### Custom Spectral Rules

Place a `.spectral.yaml` file at the root of the Git repository (for Git Sync projects) or alongside the exported spec for CLI workflows:

```yaml
# .spectral.yaml
extends: ['spectral:oas']

rules:
  # Require all operations to have a summary
  operation-summary-required:
    description: 'Every operation must have a summary'
    message: 'Operation {{property}} is missing a summary'
    severity: error
    given: '$.paths.*[get,post,put,patch,delete]'
    then:
      field: summary
      function: truthy

  # Disallow generic 'object' schemas without properties
  no-empty-object-schema:
    description: 'Object schemas must define properties'
    severity: warn
    given: "$.components.schemas.*[?(@.type == 'object')]"
    then:
      field: properties
      function: truthy
```

**Best practice:** Commit `.spectral.yaml` to source control. This ensures the same rules are enforced in the Insomnia editor, in CLI lint, and in PR checks.

```bash
# Before — custom rules only in the editor (not in CI)
# Developer edits spec, rules are enforced locally, CI has no lint step

# After — rules in .spectral.yaml, enforced everywhere
inso lint spec ./openapi.yaml   # uses .spectral.yaml automatically if present
```

## Generating a Collection from a Design Document

1. Open the Design Document.
2. Click **Generate Collection** (top-right toolbar).
3. Insomnia creates a Collection with one request per `operationId`, pre-filled with paths and example values.

**Note:** Generation is one-way and one-time — subsequent spec changes are not automatically reflected in the generated collection. Re-generate or manually update the collection after significant spec changes.

## CLI Linting

```bash
# Lint a design document by name from an Insomnia export
inso lint spec "My API" -w ./insomnia-export.json

# Lint a raw OpenAPI file directly (no export needed)
inso lint spec ./openapi.yaml

# Lint with custom Spectral config
inso lint spec ./openapi.yaml --spectral-config ./.spectral.yaml
```

Exit code `1` when lint errors are present — use in CI to block merges on failing specs.

```yaml
# .github/workflows/lint.yml
- name: Lint OpenAPI spec
  run: inso lint spec ./openapi.yaml
  # Fails the workflow on any Spectral error (exit code 1)
```

## Design-First Workflow Summary

```
1. New Design Document (Git Sync storage)
2. Author OpenAPI spec in the editor
3. Add .spectral.yaml with team-agreed rules
4. inso lint spec in CI (PR gate)
5. inso export spec to publish openapi.yaml artifact
6. Generate Collection for manual testing
7. Write after-response assertions in the collection
8. inso run collection in CI
```

See also `references/cli.md` for `inso lint spec` and `inso export spec` command details. See also `references/collaboration.md` for Git Sync storage recommended for design documents.
