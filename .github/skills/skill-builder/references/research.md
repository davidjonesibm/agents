# Research Methodology

Rules for gathering knowledge when building a skill. Use two or more complementary sources — never rely on just one.

## Source Priority

| Priority | Source                  | Best for                                    | Tool                                      |
| -------- | ----------------------- | ------------------------------------------- | ----------------------------------------- |
| 1        | Context7                | Libraries, frameworks, npm/PyPI packages    | `resolve-library-id` → `get-library-docs` |
| 2        | Direct documentation    | Platforms, SDKs, changelogs, release notes  | `web/fetch`, `web/githubRepo`             |
| 3        | User-provided docs      | Internal tools, proprietary APIs, overrides | Pasted/attached content                   |
| 4        | Existing workspace code | Current usage patterns, project conventions | `read_file`, `grep_search`                |

## Source A: Context7 (Primary)

Context7 is the primary source for any library or framework with an npm, PyPI, or similar package presence.

### How to use Context7

1. Call `resolve-library-id` with the library name to get the Context7-compatible ID.
2. Call `get-library-docs` with the resolved ID and `topic` set to the area of interest.
3. Page through results — if context is insufficient, request `page=2`, `page=3`, etc.
4. Use `mode='code'` (default) for API references and code examples.
5. Use `mode='info'` for conceptual guides, narrative docs, and architectural questions.

### What to extract from Context7

- **API surface** — function signatures, options, return types.
- **Breaking changes** — what was removed or renamed between versions.
- **Deprecations** — APIs marked deprecated and their modern replacements.
- **Recommended patterns** — idiomatic usage demonstrated in official docs.
- **Migration notes** — upgrade paths between major versions.

### When Context7 is insufficient

- The library is not indexed (resolve-library-id returns no matches).
- Results lack depth on a specific topic after paging through results.
- The skill targets a platform or SDK rather than a library (e.g., AWS, Azure, iOS).

In these cases, fall back to Source B.

## Source B: Direct Documentation

Use direct web fetches when Context7 lacks coverage or for platforms/SDKs.

### What to fetch

- Official documentation pages (API reference, guides).
- Changelogs and release notes (GitHub releases, CHANGELOG.md).
- Migration guides (official upgrade docs between versions).
- GitHub repository README and wiki pages.

### How to fetch

- Use `web/fetch` for documentation URLs.
- Use `web/githubRepo` for repository-specific content (release notes, issues, source code).
- Target specific pages rather than crawling entire sites — be surgical.

## Source C: User-Provided Documentation

When the user pastes or attaches documentation:

- Treat it as the **authoritative source** for the specific content it covers.
- Cross-reference with Context7 or web docs for completeness — user-provided docs may be partial.
- If user docs conflict with Context7, **prefer the user docs** and note the discrepancy.

## Source D: Existing Workspace Code

Read existing code in the workspace to understand:

- Current usage patterns that the skill should address.
- Project-specific conventions the skill should respect.
- Which APIs or patterns are actually in use (prioritize rules for these).

## Evaluating Source Quality

- **Prefer official docs** over blog posts, tutorials, or Stack Overflow.
- **Check version alignment** — ensure the docs match the target version for the skill.
- **Cross-validate** — if a pattern appears in only one source, verify it in another before including it.
- **Flag uncertainty** — if you can only find a pattern in one source, note this in the reference file.

## Resolving Conflicts Between Sources

1. User-provided docs win for content they explicitly cover.
2. Official docs (Context7 or web) win for API accuracy.
3. If two official sources conflict, prefer the more recent one.
4. Never silently pick one — note the conflict in the reference file if it affects a rule.

## Research Coverage Checklist

Before moving to Step 3 (Organize), verify you have gathered:

- [ ] **API surface** — current API, deprecated APIs, modern replacements.
- [ ] **Patterns** — idiomatic usage, common anti-patterns, common mistakes.
- [ ] **Performance** — known performance pitfalls, optimization techniques.
- [ ] **Security** — security-relevant APIs, common vulnerabilities, hardening practices.
- [ ] **Configuration** — recommended defaults, common misconfigurations.
- [ ] **Migration** — breaking changes from previous major versions (if applicable).
- [ ] **Testing** — testing utilities, mocking patterns, test helpers provided by the library.
- [ ] **TypeScript** — type patterns, generics usage, type narrowing (if the library has TS support).

Not every topic will apply. Skip topics with no substantive findings — do not pad reference files with generic advice.
