# CLI (Inso)

Inso CLI for Insomnia 12.5+: all commands and flags, `.insorc` configuration, CI/CD integration via GitHub Actions and Docker, and automation patterns.

## Installation

```bash
# npm (global)
npm install -g insomnia-inso

# macOS via Homebrew
brew install insomnia-inso

# Verify
inso --version
```

## Commands

### `inso run collection`

Execute all requests in a collection in order. Each request's pre-request and after-response scripts run during execution — this is the primary way to run a test suite. After-response scripts containing `insomnia.test()` assertions produce pass/fail results. Request order matters: earlier requests can store data in environment variables that later requests consume.

```bash
inso run collection "My Collection" -w ./insomnia-export.json
```

| Flag                      | Description                                                              |
| ------------------------- | ------------------------------------------------------------------------ |
| `-w, --workingDir`        | Directory containing the export file                                     |
| `--env`                   | Environment name to use                                                  |
| `--reporter`              | Output format: `dot`, `list`, `min`, `progress`, `spec` (default), `tap` |
| `--delay-request`         | Delay between requests in ms                                             |
| `--iteration-count`       | Number of iterations to run                                              |
| `-d, --iteration-data`    | Path to CSV/JSON data file for iterations                                |
| `--bail`                  | Stop on first failure (non-200 or failed test assertion)                 |
| `--item`                  | Specific request or folder to run                                        |
| `--globals`               | Path to globals JSON file                                                |
| `--env-var`               | Override environment variable (`key=value`)                              |
| `--requestNamePattern`    | Regex pattern to filter requests by name                                 |
| `--requestTimeout`        | Request timeout in ms                                                    |
| `--disableCertValidation` | Disable SSL certificate validation                                       |
| `--output`                | Output file path for results                                             |
| `--includeFullData`       | Include full request/response data (`redact` or `plaintext`)             |
| `--verbose`               | Full request/response output                                             |
| `--ci`                    | Non-interactive mode (no prompts, exits with code on failure)            |

### `inso run test`

Runs legacy unit test suites (named tests written in the Tests tab). Both commands are valid but serve different purposes: `inso run test` targets unit test suites, while `inso run collection` runs collection requests with their after-response script assertions. **Prefer `inso run collection` for new automation** — after-response script testing is the current recommended pattern.

### `inso lint spec`

Lint an OpenAPI design document against Spectral rules.

```bash
inso lint spec "My API Spec" -w ./export.json
# or lint a raw OpenAPI file directly
inso lint spec ./openapi.yaml
```

Exits with non-zero code when linting errors are found — use in CI to gate merges.

### `inso export spec`

Export the OpenAPI spec from a design document.

```bash
inso export spec "My API Spec" -w ./export.json --output ./openapi.yaml
```

## Global Flags

| Flag               | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| `-w, --workingDir` | Root directory of the Insomnia export (default: current dir) |
| `--verbose`        | Log request/response details                                 |
| `--ci`             | CI mode — disables interactive prompts, strict exit codes    |
| `--config`         | Path to `.insorc` config file                                |
| `--printOptions`   | Print resolved config and exit (useful for debugging)        |

## `.insorc` Configuration

Inso uses [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) — place config in any of:

- `.insorc.yaml` (recommended)
- `.insorc.json`
- `.insorc.js`
- `"inso"` key in `package.json`

```yaml
# .insorc.yaml
options:
  workingDir: ./insomnia-exports
  ci: true
  verbose: false

scripts:
  test:ci: inso run collection "API Tests" --env Staging --reporter tap --bail
  lint:spec: inso lint spec "My API" --output ./openapi.yaml
```

```json
// package.json alternative
{
  "inso": {
    "options": {
      "workingDir": "./insomnia",
      "ci": true
    }
  }
}
```

**Critical:** Always commit `.insorc.yaml` to source control alongside your collection export. This ensures every CI run uses identical options.

## GitHub Actions Integration

Use the official `kong/setup-inso` action:

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Inso CLI
        uses: kong/setup-inso@v2
        with:
          inso-version: latest # pin to a specific version in production

      - name: Export Insomnia collection
        run: inso export spec "My API" --output openapi.yaml

      - name: Lint OpenAPI spec
        run: inso lint spec ./openapi.yaml

      - name: Run API tests
        run: inso run collection "API Tests" --env CI --reporter tap --bail
        env:
          # Inject secrets as environment variables; reference via Insomnia env or scripts
          API_KEY: ${{ secrets.API_KEY }}
```

**Best practice:** Pin `inso-version` to a specific version tag (e.g., `v3.4.0`) in production pipelines to prevent unexpected breakage from CLI updates.

## Docker

```bash
# Lint spec using Docker (no local install required)
docker run -it --rm \
  -v $(pwd):/var/temp \
  kong/inso:latest lint spec -w /var/temp/export.json

# Run collection tests
docker run -it --rm \
  -v $(pwd):/var/temp \
  kong/inso:latest run collection "API Tests" \
    -w /var/temp/export.json \
    --env Staging \
    --ci
```

## Export Format for CLI

The CLI operates on an **Insomnia export file** (JSON v4 or v5). Export from the app:

```
File → Export Data → Current Workspace → Insomnia JSON v4 (or v5)
```

Commit this export file to your repository alongside `.insorc.yaml`.

```bash
# Before — CI fails because export file is not committed
inso run collection "Tests"
# Error: Could not find workspace

# After — export file committed at ./insomnia/export.json
# .insorc.yaml has workingDir: ./insomnia
inso run collection "Tests"
# ✓ All requests passed
```

## Exit Codes

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| `0`  | All tests/lint passed                                           |
| `1`  | Failure (test failures, lint errors, CLI errors, missing files) |

Use `--ci` flag in all non-interactive contexts to ensure proper exit codes and no interactive prompts.

## `inso script`

Runs a named script defined in the `scripts` section of `.insorc` config — useful for aliasing common commands.

```bash
# Run a named script from .insorc config
inso script test:ci
```

```yaml
# .insorc.yaml
scripts:
  test:ci: inso run collection "API Tests" --env Staging --reporter tap --bail
```

This keeps CI command invocations short and centralizes flag management in `.insorc.yaml`.

See also `references/design-first.md` for `inso lint spec` in the OpenAPI design workflow. See also `references/scripting.md` for how collection scripts are executed during `inso run collection`.
