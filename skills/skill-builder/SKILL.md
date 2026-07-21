---
name: skill-builder
description: >-
  Builds, rebuilds, edits, and maintains SKILL.md skill packages (reference files,
  frontmatter, research methodology). Use when creating new skills, updating existing
  skills, or reviewing skill file quality. Trigger keywords: skill, SKILL.md, build skill,
  create skill, skill package, reference files, skill foundry.
---

Build high-quality VS Code agent skills (`SKILL.md` + reference files) by distilling platform, library, or framework knowledge into structured, actionable skill packages.

## Workflow

Follow these five steps in order when building or rebuilding a skill:

1. **Identify the target** — determine the technology, version, scope, and placement. See `references/frontmatter.md` for naming and frontmatter conventions.
2. **Gather knowledge** — research the target using Context7, web docs, and user-provided sources. See `references/research.md` for methodology and source priority.
3. **Organize into reference files** — split knowledge into focused topic files. See `references/structure.md` for directory layout, topic table, and cross-referencing rules.
4. **Write the SKILL.md** — create the entry point with frontmatter, review process, core instructions, and output format. See `references/structure.md` for the template.
5. **Validate** — verify reference file existence, code example validity, no duplicate rules, and trigger keywords in the description.

When editing an existing skill, load only the relevant reference files for the change being made.

## Quality Standards

- **Density over length** — a 50-line file with 20 actionable rules beats a 500-line file with 5 buried in prose.
- **Every rule has an example** — no rule without a before/after code snippet.
- **No hallucinated APIs** — if Context7 or docs don't confirm it exists, don't include it.
- **Version-pinned** — always state which version the skill targets.
- **Cross-referenced** — if a pattern in `patterns.md` has performance implications, mention "see also `references/performance.md`".

## Constraints

- **Never invent APIs or features** that aren't confirmed by documentation.
- **Never include rules you aren't confident about** — omit rather than guess.
- **Never create a monolithic single-file skill** — always split into reference files.
- **Never duplicate the same rule in multiple reference files** — cross-reference instead.
- **Always use Context7 first** for library/framework skills — fall back to web fetch only when Context7 lacks coverage.

## Output Format

When reporting on a skill build or review, organize by file:

1. State the file path.
2. Summarize what was added, changed, or flagged.
3. For review findings, show before/after code fixes.

End with a validation checklist confirming all five workflow steps were completed.
