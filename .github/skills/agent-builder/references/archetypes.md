# Common Agent Archetypes

Reusable agent patterns with recommended tools, instruction focus areas, and handoff strategies. Use these as starting points when designing new agents.

## Planner Agent

**Purpose:** Research, analyze, and break down requirements into actionable plans.

- **Tools:** `['search', 'read', 'web/fetch']` — read-only via category wildcards
- **Focus:** Research, analysis, breaking down requirements, architecture decisions
- **Output:** Structured implementation plans, task breakdowns, architecture decision records
- **Handoff:** → Implementation Agent

```yaml
tools: ['search', 'read', 'web/fetch']
handoffs:
  - label: Implement Plan
    agent: implementer
    prompt: Implement the plan I created above
    send: false
```

**Key instructions to include:**

- Read existing code before proposing changes
- Produce numbered task lists with clear acceptance criteria
- Flag risks and open questions explicitly
- Never modify code — planning only

## Implementation Agent

**Purpose:** Write code, refactor, and apply changes following a plan or specification.

- **Tools:** `['search', 'read', 'edit', 'execute/runInTerminal']` — full editing via wildcard
- **Focus:** Writing code, refactoring, applying changes
- **Constraints:** Follow established patterns, maintain existing code style
- **Handoff:** → Review Agent or Testing Agent

```yaml
tools: ['search', 'read', 'edit', 'execute/runInTerminal']
handoffs:
  - label: Review Changes
    agent: reviewer
    prompt: Review the code changes I just made
    send: false
```

**Key instructions to include:**

- Read relevant files before editing — understand context first
- Follow existing code conventions (naming, structure, patterns)
- Run linting/type-checking after changes
- Explain non-obvious design decisions in comments

## Security Reviewer Agent

**Purpose:** Identify vulnerabilities and suggest security improvements.

- **Tools:** `['search', 'read', 'web/fetch']` — read-only
- **Focus:** OWASP Top 10, auth/authz flaws, insecure dependencies
- **Output:** Prioritized security assessment reports with remediation code

```yaml
tools: ['search', 'read', 'web/fetch']
```

**Key instructions to include:**

- Prioritize by severity (Critical > High > Medium > Low)
- Provide fix code, not just descriptions
- Check dependencies against known CVEs
- Never modify code — report only

## Test Writer Agent

**Purpose:** Generate comprehensive tests and ensure coverage.

- **Tools:** `['search', 'read', 'edit', 'execute']` — needs terminal + test failure access
- **Focus:** Unit tests, integration tests, edge cases, coverage
- **Pattern:** Write failing tests first, then implement (TDD handoff)

```yaml
tools: ['search', 'read', 'edit', 'execute']
handoffs:
  - label: Implement Code
    agent: implementer
    prompt: Implement code to make the failing tests above pass
    send: false
```

**Key instructions to include:**

- Read the source code to understand what to test
- Cover happy paths, edge cases, and error conditions
- Use the project's existing test framework and patterns
- Run tests after writing to verify they fail for the right reason

## Documentation Agent

**Purpose:** Generate clear, comprehensive documentation.

- **Tools:** `['search', 'read', 'edit/createFile', 'edit/editFiles']`
- **Focus:** API docs, inline comments, READMEs, architecture guides
- **Output:** Markdown documentation files

```yaml
tools: ['search', 'read', 'edit/createFile', 'edit/editFiles']
```

**Key instructions to include:**

- Read the code before documenting — never guess at behavior
- Use consistent heading structure and formatting
- Include code examples for API documentation
- Keep language clear and concise — avoid jargon

## Orchestrator / Router Agent

**Purpose:** Route tasks to the right specialist agent based on the request.

- **Tools:** `['search', 'read', 'agent']` — needs subagent delegation
- **Focus:** Task classification, routing decisions, coordination
- **Pattern:** Reads the request, picks the best specialist, delegates

```yaml
tools: ['search', 'read', 'agent']
agents: ['Planner', 'Implementer', 'Reviewer', 'Security Reviewer']
```

**Key instructions to include:**

- Decision matrix mapping request types to specialist agents
- Rules for when to handle directly vs. delegate
- Instructions for passing context to subagents
- Fallback behavior when no specialist matches

## When to Create an Agent vs. Use a Skill

| Create an **Agent** when...                       | Create a **Skill** when...                            |
| ------------------------------------------------- | ----------------------------------------------------- |
| The task requires a distinct persona/role         | The knowledge is domain reference material            |
| The task needs specific tool restrictions         | Multiple agents could benefit from the same knowledge |
| The agent is part of a handoff workflow           | The expertise is about "how to review/use X"          |
| Users should be able to invoke it by name in chat | The knowledge doesn't need its own tool set           |

**Rule of thumb:** Agents are _actors_ (they do things). Skills are _expertise_ (they know things). An agent loads skills to become expert in a domain.
