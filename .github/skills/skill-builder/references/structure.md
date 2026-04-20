# Skill Structure and Organization

Rules for directory layout, reference file topics, the SKILL.md template, and cross-referencing.

## Directory Layout

Every skill follows this structure:

```
.github/skills/<skill-name>/
├── SKILL.md              # Entry point: frontmatter + review/usage instructions
└── references/           # Topic-organized knowledge files
    ├── api.md
    ├── patterns.md
    ├── performance.md
    └── ...
```

Workspace-scoped skills use `.agents/skills/<skill-name>/` instead.

- `SKILL.md` is always the entry point — agents read this file first.
- `references/` contains topic-organized knowledge files — agents load only what they need.
- The directory name must be kebab-case and must match the `name` field in SKILL.md frontmatter (see `references/frontmatter.md`).

## Standard Reference File Topics

Include only files with substantive content. Never create empty or stub files.

| File               | Content                                                  |
| ------------------ | -------------------------------------------------------- |
| `api.md`           | Deprecated APIs, modern replacements, new APIs to prefer |
| `patterns.md`      | Idiomatic patterns, anti-patterns, common mistakes       |
| `performance.md`   | Performance pitfalls, optimization techniques            |
| `security.md`      | Security best practices, common vulnerabilities          |
| `migration.md`     | Version upgrade steps, breaking changes, codemods        |
| `configuration.md` | Recommended config, common misconfigurations             |
| `testing.md`       | Testing patterns, test utilities, mocking strategies     |
| `typescript.md`    | Type patterns, generics usage, type narrowing            |

Custom topic files are allowed when a technology has domain-specific concerns that don't fit the standard topics (e.g., `hooks.md` for Fastify, `state.md` for Vue/Pinia).

## Reference File Content Rules

Each reference file should:

- Be **actionable** — rules an agent can follow, not vague advice.
- Use **before/after code examples** for every rule (see `references/examples.md`).
- Be **concise** — bullet points and code blocks, not prose paragraphs.
- Include the **"why"** briefly when the reason isn't obvious.
- Flag **severity** — which rules are critical vs. nice-to-have.
- Start with a one-line title (`# Topic Name`) and a one-line description of what the file covers.

## When to Split vs. Combine

- **Split** when a topic has 5+ rules — it deserves its own file.
- **Combine** when two topics have fewer than 3 rules each and are closely related.
- **Never split a single topic across two files** — all rules about the same topic belong together.
- If a rule has cross-cutting concerns (e.g., a pattern that also affects performance), put the rule in the primary topic file and add a "see also" cross-reference in the secondary file.

## Cross-Referencing

When a rule in one file is related to content in another:

```markdown
- Prefer `fastify.log` over `console.log` for structured logging (see also `references/performance.md` for serialization impact).
```

Cross-references use the format: `see also \`references/<filename>.md\``.

Never duplicate the full rule in both files — one file owns the rule, the other cross-references.

## SKILL.md Template

```markdown
---
name: <kebab-case-name>
description: >-
  <description with trigger keywords>
---

<One-line purpose statement>.

Review process:

1. Check for deprecated APIs using `references/api.md`.
2. Validate idiomatic patterns using `references/patterns.md`.
3. Check performance best practices using `references/performance.md`.
4. [Additional steps as needed]

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target <framework> <version> or later.
- <Key constraint 1>
- <Key constraint 2>

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary.
```

### Required SKILL.md Sections

1. **Frontmatter** — `name` and `description` (see `references/frontmatter.md`).
2. **Purpose statement** — one line after the frontmatter describing what this skill does.
3. **Review process** — numbered list of steps, each referencing a specific reference file.
4. **Core Instructions** — non-negotiable rules, target version, key assumptions.
5. **Output Format** — how findings or results should be structured.

### Optional SKILL.md Sections

- **Example output** — a concrete example of what the skill's output looks like (helps agents calibrate).
- **References** — a trailing `## References` header is sometimes used but is not required since reference files are already mentioned in the review process.

## Validation Checklist

After creating or editing a skill, verify:

- [ ] Every reference file mentioned in SKILL.md exists in `references/`.
- [ ] No reference file in `references/` is unmentioned in SKILL.md.
- [ ] All code examples are syntactically valid.
- [ ] No duplicate rules across reference files.
- [ ] The `name` field matches the directory name.
- [ ] The `description` contains useful trigger keywords.
- [ ] No reference file is empty or contains only stubs.
