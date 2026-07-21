# Configuration — xunit.runner.json and Parallelization Settings

Covers `xunit.runner.json` configuration options, parallelism settings, culture overrides, output display, and common misconfigurations.

## File Setup

Create `xunit.runner.json` in the test project root and set it to copy to output:

```xml
<!-- In .csproj -->
<ItemGroup>
  <Content Include="xunit.runner.json" CopyToOutputDirectory="PreserveNewest" />
</ItemGroup>
```

```json
// xunit.runner.json — add JSON Schema for IDE support
{
  "$schema": "https://xunit.net/schema/current/xunit.runner.schema.json"
}
```

The `$schema` property enables autocomplete and validation in editors.

## Parallelization

```json
{
  "$schema": "https://xunit.net/schema/current/xunit.runner.schema.json",
  "parallelizeTestCollections": true,
  "maxParallelThreads": "2x",
  "parallelAlgorithm": "conservative"
}
```

| Property                     | Default          | Values                                            |
| ---------------------------- | ---------------- | ------------------------------------------------- |
| `parallelizeTestCollections` | `true`           | `true` / `false`                                  |
| `maxParallelThreads`         | CPU count        | integer, `"unlimited"`, or multiplier like `"2x"` |
| `parallelAlgorithm`          | `"conservative"` | `"conservative"` / `"aggressive"`                 |

- `"conservative"` (default): tests from one collection complete before threads start another collection's tests.
- `"aggressive"`: threads grab any available test regardless of collection boundary — higher throughput, less predictable ordering.
- `"unlimited"` for `maxParallelThreads` removes the thread cap — use only for I/O-bound tests.
- Use `"2x"` to set threads to twice the CPU count for I/O-heavy test suites.

```json
// Before (explicit 0 — meaning "unlimited" in v2, may not apply in v3)
{ "maxParallelThreads": 0 }

// After (use the string "unlimited" in v3)
{ "maxParallelThreads": "unlimited" }
```

### Disabling Parallelism Per-Collection

```csharp
// Disable parallel execution for a specific collection
[CollectionDefinition(DisableParallelization = true)]
public class SequentialCollection : ICollectionFixture<SequentialFixture> { }
```

## Culture Settings

Override the test run culture to surface culture-sensitive bugs:

```json
{
  "culture": "tr-TR"
}
```

- `"culture": "invariant"` uses `CultureInfo.InvariantCulture`.
- Omitting `culture` uses the system default.
- Useful for catching `string.ToUpper()` / Turkish-I bugs, decimal separator differences, etc.

## Method Display Options

Control how test names appear in output and test explorers:

```json
{
  "methodDisplay": "method",
  "methodDisplayOptions": "replaceUnderscoreWithSpace, useOperatorMonikers"
}
```

| `methodDisplay`      | Example output                   |
| -------------------- | -------------------------------- |
| `"method"` (default) | `Add_ReturnsSum`                 |
| `"classAndMethod"`   | `CalculatorTests.Add_ReturnsSum` |

`methodDisplayOptions` flags (comma-separated):

- `replaceUnderscoreWithSpace` → `Add_ReturnsSum` displays as `Add Returns Sum`
- `useOperatorMonikers` → `Equals__Expected__Actual` displays with operator symbols
- `useEscapeSequences` → allows escape sequences in display names

## Failure and Skip Behavior

```json
{
  "stopOnFail": false,
  "failSkips": false,
  "failWarns": false
}
```

- `"stopOnFail": true` — abort the test run on the first failure; useful for fast feedback on CI.
- `"failSkips": true` — treat skipped tests as failures (enforce no pending skips in CI).
- `"failWarns": true` — treat tests that called `TestContext.Current.AddWarning()` as failures.

## Output and Diagnostics

```json
{
  "showLiveOutput": false,
  "diagnosticMessages": false,
  "longRunningTestSeconds": 60
}
```

- `"showLiveOutput": true` — print `ITestOutputHelper` output as tests run (not just on failure).
- `"diagnosticMessages": true` — enable verbose diagnostic output from the runner (useful for debugging parallelism or runner issues).
- `"longRunningTestSeconds": 60` — emit a diagnostic message for any test exceeding this threshold (does not fail the test; use `[Fact(Timeout = ...)]` for hard limits).

## Print Formatting

Control how complex objects are rendered in assertion failure messages:

```json
{
  "printMaxEnumerableLength": 5,
  "printMaxStringLength": 200,
  "printMaxObjectDepth": 3,
  "printMaxObjectMemberCount": 5
}
```

- Increase these for richer diffs at the cost of longer output.
- The defaults are conservative to avoid flooding output for large collections.

## Complete Example

```json
{
  "$schema": "https://xunit.net/schema/current/xunit.runner.schema.json",
  "parallelizeTestCollections": true,
  "maxParallelThreads": "2x",
  "parallelAlgorithm": "conservative",
  "methodDisplay": "method",
  "methodDisplayOptions": "replaceUnderscoreWithSpace",
  "stopOnFail": false,
  "failSkips": false,
  "showLiveOutput": false,
  "longRunningTestSeconds": 30
}
```
