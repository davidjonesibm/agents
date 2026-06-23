<!-- ============================================================
  .github/copilot-instructions.md — TOKEN-OPTIMIZED TEMPLATE
  ============================================================

  WHY THIS STRUCTURE EXISTS (read before editing):

  This file loads on EVERY Copilot request. Every token here multiplies
  across the lifetime of the project. Keep it lean.

  Cache-friendly ordering rule: STABLE content FIRST, volatile LAST.
  Both Claude (Anthropic) and GPT (OpenAI) implement prefix-based prompt
  caching. When the beginning of a prompt is identical turn-to-turn, it
  receives a ~90% token cost discount. Changing anything near the top
  (even a space) invalidates the entire cache.

  Token budget: target ≤ 2,000 tokens (≈ 8 KB).
  1 token ≈ 4 characters — use `wc -c .github/copilot-instructions.md`
  and divide by 4 to estimate your current spend.

  WHAT BELONGS HERE vs. SCOPED FILES:
  - HERE: project identity, stack, top-level conventions, file structure
  - SCOPED (.instructions.md with applyTo): testing rules, API patterns,
    architecture context, anything only relevant to a subset of files
  - NOT HERE: framework-specific rules (let skills handle those),
    dynamic content (dates/usernames break caching), per-PR context

  See instruction-templates/README.md for the full setup guide.
  See docs/token-optimization.md for the theory behind this structure.
============================================================ -->

# Project: [YOUR PROJECT NAME]

<!-- CUSTOMIZE: Replace with your actual project name. Keep it short — this
     line anchors the cache prefix. Don't change it mid-session. -->

## Tech Stack

<!-- CUSTOMIZE: List your actual stack. One line per layer. Be specific about
     versions only when they affect generated code (e.g., Node 22 matters;
     Ubuntu 22.04 doesn't). Remove rows that don't apply. -->

- Backend: [runtime + framework + version, e.g. "Node.js 22, Fastify 5"]
- Frontend: [framework + version, e.g. "React 19, TypeScript 5.5, Vite 6"]
- Database: [engine + version, e.g. "PostgreSQL 16"]
- Testing: [test runner + e2e tool, e.g. "Vitest, Playwright"]
- Deploy: [platform, e.g. "Docker, Railway" or "AWS ECS"]

## Project Structure

<!-- CUSTOMIZE: Replace with your actual top-level source directories.
     One line per directory, brief purpose. This is the most-referenced
     section — keep it accurate as the project evolves. -->

```
src/
  [dir]/        # [one-line purpose]
  [dir]/        # [one-line purpose]
  [dir]/        # [one-line purpose]
```

## Coding Conventions

### Style

<!-- CUSTOMIZE: Fill in your actual style settings. Aim for 4–6 lines max.
     Specifics like indent size and quote style prevent constant debate. -->

- Indentation: [2 spaces / 4 spaces / tabs]
- Quotes: [single / double]
- Semicolons: [yes / no]
- Max line length: [80 / 100 / 120] characters
- Imports: [e.g. "stdlib → third-party → internal, blank line between groups"]

### Naming

<!-- CUSTOMIZE: One line per convention. These anchor generated symbol names. -->

- Files: [e.g. "kebab-case for all files"]
- Types/Classes: [e.g. "PascalCase"]
- Functions/Variables: [e.g. "camelCase"]
- Constants: [e.g. "SCREAMING_SNAKE_CASE"]
- [DB columns / API fields if different from code]

### Error Handling

<!-- CUSTOMIZE: Where errors are caught and what shape they take.
     Prevents agents from inventing ad-hoc error patterns. -->

- Errors are caught at: [e.g. "route handler boundary only"]
- Client error shape: [e.g. `{ error: string, code: string }`]
- Logging: [e.g. "use the logger at `src/lib/logger.ts`, never `console.log`"]

### Environment & Config

<!-- CUSTOMIZE: How env vars and config are accessed in this codebase. -->

- Environment variables: [e.g. "accessed only via `src/config.ts` — never `process.env` directly"]
- Secrets: [e.g. "never committed; use `.env.example` for documentation"]

## What Lives Where

<!-- CUSTOMIZE: A quick lookup table prevents agents from placing code in
     the wrong layer. Keep to 5–8 rows. -->

| Concern               | Location               |
| --------------------- | ---------------------- |
| [e.g. HTTP routing]   | [e.g. `src/routes/`]   |
| [e.g. Business logic] | [e.g. `src/services/`] |
| [e.g. Data access]    | [e.g. `src/db/`]       |
| [e.g. Shared types]   | [e.g. `src/types/`]    |
| [e.g. Tests]          | [e.g. `tests/`]        |
| [e.g. Config]         | [e.g. `src/config.ts`] |
