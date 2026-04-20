# Agent Frontmatter Reference

All `.agent.md` files begin with YAML frontmatter between `---` delimiters. This defines the agent's metadata, tool access, model selection, and workflow connections.

## Field Reference

### `description` (required)

Brief, clear description shown in the VS Code chat input. This is the most important field — it determines how users discover and understand the agent.

```yaml
description: 'Design, create, and debug VS Code custom agents (.agent.md files)'
```

- Keep it to one sentence.
- Include key file types or domains the agent handles.
- This text appears directly in the VS Code UI.

### `name` (optional)

Display name for the agent. Defaults to the filename (minus `.agent.md`) if omitted.

```yaml
name: Security Reviewer
```

- Use title case.
- Keep it concise — it shows in the chat participant picker.

### `argument-hint` (optional)

Guidance text shown to users in the chat input, hinting at what to type.

```yaml
argument-hint: Describe the agent role, purpose, and required capabilities
```

### `tools` (optional)

Array of tool identifiers the agent can access. See `references/tools.md` for the complete list.

```yaml
# Category wildcards (preferred — future-proof)
tools: ['search', 'read', 'edit', 'execute']

# Specific tools (use when you need precision)
tools: ['search', 'read', 'edit/editFiles', 'execute/runInTerminal']

# MCP tools mixed in
tools: ['search', 'read', 'web', 'azure-mcp/search']

# Standalone tools alongside categories
tools: ['search', 'read', 'edit', 'execute', 'browser', 'todo']
```

- Use category wildcards (`search`, `edit`, etc.) when the agent needs most tools in a group.
- Use specific identifiers (`edit/editFiles`) to restrict access precisely.
- Never grant tools the agent doesn't need.

### `model` (optional)

Request a specific model. Omit to use the VS Code default.

```yaml
model: Claude Sonnet 4
```

### `handoffs` (optional)

Define workflow transitions to other agents. Each handoff appears as a button in chat.

```yaml
handoffs:
  - label: Review Code
    agent: code-reviewer
    prompt: Review the changes I just made for correctness and style
    send: false
  - label: Run Tests
    agent: test-runner
    prompt: Run the test suite and report failures
    send: true
```

See `references/handoffs.md` for detailed patterns.

### `agents` (optional)

List of agent names this agent can delegate to as subagents (via `agent/runSubagent`).

```yaml
agents: ['Context7-Expert', 'security-reviewer']
```

- Use the agent's `name:` field value (not the filename).
- Requires `agent` or `agent/runSubagent` in the `tools:` array to be useful.

## Syntax Rules

- Use **single quotes** for string values that contain special YAML characters (colons, brackets).
- Use **block scalars** (`>-` or `|`) for multi-line descriptions.
- Arrays can use flow syntax (`['a', 'b']`) or block syntax (`- a`).
- Boolean values: `true` / `false` (no quotes).

```yaml
# Flow array (preferred for short lists)
tools: ['search', 'read', 'edit']

# Block array (preferred for long lists or handoffs)
tools:
  - search
  - read
  - edit
  - execute
  - vscode
  - web
  - agent
```

## Complete Example

```yaml
---
description: 'Review code for security vulnerabilities and suggest fixes'
name: Security Reviewer
argument-hint: Paste code or describe the component to review
tools: ['search', 'read', 'web/fetch']
model: Claude Sonnet 4
handoffs:
  - label: Apply Fixes
    agent: implementation-agent
    prompt: Apply the security fixes I recommended above
    send: false
agents: ['Context7-Expert']
---
```

## Common Mistakes

- **Missing `description:`** — the field is required; the agent won't load properly without it.
- **Using invalid tool identifiers** — check `references/tools.md`; invalid IDs are silently ignored.
- **Quoting booleans** — `send: 'false'` is a string, not a boolean. Use `send: false`.
- **Forgetting the closing `---`** — YAML frontmatter must be enclosed by two `---` lines.
- **Using filename instead of `name:` in `agents:`** — the `agents:` array references display names, not filenames.
- **Overly vague `description:`** — "A helpful agent" tells users nothing. Be specific about what it does.
