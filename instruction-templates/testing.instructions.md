---
# CUSTOMIZE: Adjust globs to match your project's test file conventions.
# This pattern covers the most common test file locations and extensions.
# applyTo loads this file ONLY when one of the matched files is open —
# zero token cost while editing non-test source files.
#
# Token budget: target ≤ 1,500 tokens (≈ 6 KB) for this file.
# Estimate: wc -c .github/instructions/testing.instructions.md | awk '{print $1/4 " tokens"}'
applyTo: '**/*.test.*,**/*.spec.*,**/__tests__/**,**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx'
---

# Testing Conventions

## Framework & Runner

<!-- CUSTOMIZE: Replace with your actual test framework setup. -->

- Test runner: [e.g. "Vitest 2" / "Jest 29" / "xUnit v3" / "pytest 8"]
- E2E runner: [e.g. "Playwright 1.45" / "Cypress 13" / "none"]
- Test command: `[e.g. npm test / dotnet test / go test ./...]`
- Watch mode: `[e.g. npm run test:watch]`

## File Organization

<!-- CUSTOMIZE: Describe how test files map to source files in this project. -->

- Unit tests: [e.g. "co-located at `src/**/*.test.ts`" / "mirrored at `tests/unit/`"]
- Integration tests: [e.g. "`tests/integration/`"]
- E2E tests: [e.g. "`tests/e2e/`"]
- Fixtures / helpers: [e.g. "`tests/helpers/`"]
- File naming: [e.g. "source file `auth.ts` → test file `auth.test.ts`"]

## Test Structure

<!-- CUSTOMIZE: Describe the block/naming conventions your team uses. -->

- Grouping: [e.g. "one `describe` per module, nested `describe` for methods"]
- Naming: [e.g. "`it('should [action] when [condition]')`"]
- Arrange-Act-Assert: [e.g. "separate with blank lines; no comments needed"]
- One assertion focus per test: [e.g. "split multi-behavior tests into separate `it` blocks"]

## Mocking & Stubs

<!-- CUSTOMIZE: Describe your mocking approach and utilities. -->

- Mocking library: [e.g. "Vitest's built-in `vi.mock()`" / "Mockito" / "`unittest.mock`"]
- External services: [e.g. "always mock HTTP clients; never call real endpoints in unit tests"]
- Database: [e.g. "use in-memory SQLite for unit tests; real DB via Testcontainers for integration"]
- Time: [e.g. "use `vi.useFakeTimers()` for anything time-dependent"]
- Filesystem: [e.g. "use temp directories via `os.tmpdir()`"]

## Assertions

<!-- CUSTOMIZE: Preferred assertion style and common patterns. -->

- Assertion library: [e.g. "Vitest built-in `expect`" / "FluentAssertions" / "pytest assertions"]
- Object equality: [e.g. "use `toEqual` (deep) not `toBe` (reference)"]
- Async: [e.g. "always `await expect(fn()).resolves.toEqual(...)` for async assertions"]
- Error cases: [e.g. "use `expect(fn).toThrow(ErrorClass)` not try/catch in tests"]

## Fixtures & Test Data

<!-- CUSTOMIZE: How test data and state is managed. -->

- Builders / factories: [e.g. "use factory functions in `tests/helpers/factories.ts`"]
- Seed data: [e.g. "use `beforeEach` hooks; never depend on pre-existing DB state"]
- Cleanup: [e.g. "roll back transactions in `afterEach`; Respawn for integration suites"]

## Coverage

<!-- CUSTOMIZE: Your team's coverage requirements. -->

- Minimum threshold: [e.g. "80% line coverage enforced in CI"]
- Exclusions: [e.g. "generated files, `*.d.ts`, config files excluded"]
- Report command: `[e.g. npm run coverage]`

## What NOT to Test

<!-- CUSTOMIZE: Boundaries that prevent over-testing and slow suites. -->

- [e.g. "Don't test third-party library internals"]
- [e.g. "Don't test generated code (migrations, proto output)"]
- [e.g. "Don't assert on log output unless logging is the feature under test"]
