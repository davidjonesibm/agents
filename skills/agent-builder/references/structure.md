# Agent Body Structure

The body of an `.agent.md` file (everything after the closing `---`) contains the agent's instructions. This is what shapes the agent's behavior, personality, and output quality.

## Section Order

Follow this order for agent body content. Not every section is required — include only what's relevant.

1. **Identity & Purpose** — Clear statement of agent role and mission
2. **Core Responsibilities** — Bullet list of primary tasks
3. **Operating Guidelines** — How to approach work, quality standards
4. **Constraints & Boundaries** — What NOT to do, safety limits
5. **Output Specifications** — Expected format, structure, detail level
6. **Examples** — Sample interactions or outputs (when helpful)
7. **Tool Usage Patterns** — When and how to use specific tools

## Identity & Purpose

Start with a clear identity statement. This anchors the agent's behavior.

```markdown
# Security Reviewer

You are an expert security reviewer specialized in identifying OWASP Top 10
vulnerabilities in web applications. Your purpose is to audit code for security
issues and provide actionable remediation guidance.
```

- Use a heading matching the agent's name.
- State the role ("You are a...") and purpose ("Your purpose is to...") in the first sentence.
- Be specific about the domain — "web applications" not just "applications".

## Core Responsibilities

Use a bullet list of the agent's primary tasks. Keep it focused — 3-7 items.

```markdown
## Core Responsibilities

- Audit source code for injection, XSS, CSRF, and other OWASP Top 10 vulnerabilities
- Review authentication and authorization logic for flaws
- Identify insecure dependencies and suggest upgrades
- Produce prioritized security assessment reports
```

## Operating Guidelines

Define how the agent should approach work. Use imperative language.

```markdown
## Operating Guidelines

- Always read the full file before reporting issues — do not flag code without context.
- Prioritize findings by severity: Critical > High > Medium > Low.
- Provide remediation code snippets, not just descriptions of problems.
- When uncertain about a vulnerability, flag it with a confidence level.
```

## Constraints & Boundaries

Explicitly state what the agent must NOT do.

```markdown
## Constraints

- Do NOT modify source code — this is a read-only review agent.
- Do NOT report stylistic issues — focus only on security.
- Do NOT recommend tools or libraries without verifying they exist.
- Do NOT skip files — audit everything in scope.
```

- Use "Do NOT" or "Never" — not "Try to avoid" or "Prefer not to".
- Be exhaustive — unmentioned boundaries will be crossed.

## Output Specifications

Define the exact format of the agent's output. Agents without output specs produce inconsistent results.

```markdown
## Output Format

For each finding, report:

1. **File and line(s)** affected
2. **Vulnerability type** (e.g., SQL Injection, XSS)
3. **Severity** (Critical / High / Medium / Low)
4. **Description** — what the issue is and why it matters
5. **Remediation** — code snippet showing the fix

End with a summary table of all findings sorted by severity.
```

## Examples

Include concrete examples when the expected output is complex or non-obvious.

````markdown
## Example Output

### src/routes/users.ts

**Line 24: SQL Injection (Critical)**

User input is concatenated directly into a SQL query.

```typescript
// Before
const result = await db.query(
  `SELECT * FROM users WHERE id = ${req.params.id}`,
);

// After
const result = await db.query('SELECT * FROM users WHERE id = $1', [
  req.params.id,
]);
```
````

## Tool Usage Patterns

When an agent has specific tools, document when and how to use them.

```markdown
## Tool Usage

- Use `search/codebase` to find relevant code before reviewing — do not ask the user to paste code.
- Use `read/readFile` to read full file contents — never review partial snippets.
- Use `web/fetch` to check CVE databases when you identify a vulnerable dependency.
- Do NOT use `edit/*` tools — this agent is read-only.
```

## Instruction Writing Best Practices

- **Use imperative language** for required behaviors: "Always validate input", "Never skip files".
- **Be specific** — "Review for SQL injection" not "Review for security issues".
- **Include concrete examples** of good output — agents mimic what you show them.
- **Specify output format explicitly** — Markdown structure, code blocks, tables.
- **Define success criteria** — what does "done" look like?
- **Handle edge cases** — what should the agent do when it finds nothing? When it's unsure?
- **Avoid hedging** — "You should try to" is weaker than "Always". Agents follow strong directives more reliably.
- **Front-load critical rules** — put the most important instructions near the top of each section.
