# Valid Tools Reference

Use ONLY the identifiers below when specifying tools in `tools:` arrays. Any other identifier produces "unknown tool… Will be ignored" in VS Code.

## Category Wildcards

Grant ALL tools in a category (including future additions): `search`, `edit`, `read`, `execute`, `vscode`, `web`, `agent`.

Prefer wildcards when an agent needs most tools in a group — this future-proofs as new tools ship.

## Tool Tables by Category

### `search` (wildcard: `search`)

| Identifier              | Description                                   |
| ----------------------- | --------------------------------------------- |
| `search/codebase`       | Semantic code search across workspace         |
| `search/changes`        | Source control changes (git diffs)            |
| `search/fileSearch`     | Find files by glob pattern                    |
| `search/listDirectory`  | List contents of a directory                  |
| `search/textSearch`     | Find text/regex in files                      |
| `search/usages`         | Find references, implementations, definitions |
| `search/searchSubagent` | Search via subagent                           |

### `edit` (wildcard: `edit`)

| Identifier                   | Description                   |
| ---------------------------- | ----------------------------- |
| `edit/editFiles`             | Apply edits to existing files |
| `edit/createFile`            | Create a new file             |
| `edit/createDirectory`       | Create a new directory        |
| `edit/createJupyterNotebook` | Create a Jupyter notebook     |
| `edit/editNotebook`          | Edit notebook cells           |
| `edit/rename`                | Rename a file or symbol       |

### `read` (wildcard: `read`)

| Identifier                 | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `read/readFile`            | Read file contents                                |
| `read/problems`            | Get workspace errors/warnings from Problems panel |
| `read/terminalLastCommand` | Get last terminal command and output              |
| `read/terminalSelection`   | Get current terminal selection                    |
| `read/getNotebookSummary`  | List notebook cells                               |
| `read/viewImage`           | View an image file                                |

### `execute` (wildcard: `execute`)

| Identifier                  | Description                        |
| --------------------------- | ---------------------------------- |
| `execute/runInTerminal`     | Run a shell command                |
| `execute/getTerminalOutput` | Get output from a running terminal |
| `execute/sendToTerminal`    | Send text to a terminal            |
| `execute/killTerminal`      | Kill a terminal session            |
| `execute/createAndRunTask`  | Create and run a VS Code task      |
| `execute/testFailure`       | Get unit test failure details      |
| `execute/runNotebookCell`   | Run a notebook cell                |

### `vscode` (wildcard: `vscode`)

| Identifier                    | Description                     |
| ----------------------------- | ------------------------------- |
| `vscode/extensions`           | Search for VS Code extensions   |
| `vscode/getProjectSetupInfo`  | Get project scaffolding info    |
| `vscode/runCommand`           | Run a VS Code command           |
| `vscode/askQuestions`         | Ask clarifying questions via UI |
| `vscode/installExtension`     | Install a VS Code extension     |
| `vscode/memory`               | Access agent memory             |
| `vscode/newWorkspace`         | Create a new workspace          |
| `vscode/resolveMemoryFileUri` | Resolve memory file URIs        |
| `vscode/vscodeApi`            | Access VS Code API information  |

### `web` (wildcard: `web`)

| Identifier       | Description                          |
| ---------------- | ------------------------------------ |
| `web/fetch`      | Fetch content from a web page        |
| `web/githubRepo` | Access GitHub repository information |

### `agent` (wildcard: `agent`)

| Identifier          | Description            |
| ------------------- | ---------------------- |
| `agent/runSubagent` | Delegate to a subagent |

### Standalone Tools (no category wildcard)

| Identifier  | Description                                               |
| ----------- | --------------------------------------------------------- |
| `browser`   | Browser interaction                                       |
| `todo`      | Track progress with a todo list _(singular, not `todos`)_ |
| `selection` | Current editor selection                                  |

## MCP Tools

MCP server tools use the pattern `server-name/*` (e.g., `azure-mcp/search`, `io.github.upstash/context7/*`). MCP servers are project-specific and vary by workspace. When designing an agent, ask the user whether they need MCP tool access and instruct them to add the appropriate `server-name/*` entries.

## Invalid / Deprecated Tool Identifiers

These identifiers appear in older agent files but are NOT recognized. Using them produces "unknown tool… Will be ignored" warnings.

| Invalid Identifier                            | Use Instead            |
| --------------------------------------------- | ---------------------- |
| ~~`search/grep`~~                             | `search/textSearch`    |
| ~~`search/searchResults`~~                    | Does not exist         |
| ~~`edit/replaceFile`~~ / ~~`edit/multiEdit`~~ | `edit/editFiles`       |
| ~~`read/file`~~                               | `read/readFile`        |
| ~~`read/dir`~~                                | `search/listDirectory` |
| ~~`read/errors`~~                             | `read/problems`        |
| ~~`execute/awaitTerminal`~~                   | Does not exist         |
| ~~`vscode/listCodeUsages`~~                   | `search/usages`        |
| ~~`vscode/searchExtensions`~~                 | `vscode/extensions`    |
| ~~`web/open`~~                                | `web/githubRepo`       |
| ~~`agent/askQuestions`~~                      | `vscode/askQuestions`  |
| ~~`todos`~~                                   | `todo` (singular)      |

## Tool Selection Strategy

- **Read-only agents** (planning, research, review): `['search', 'read', 'web/fetch']`
- **Implementation agents** (coding, refactoring): `['search', 'read', 'edit', 'execute/runInTerminal']`
- **Testing agents**: `['search', 'read', 'edit', 'execute']` (grants `runInTerminal`, `testFailure`, `runNotebookCell`, etc.)
- **Deployment agents**: `['execute', 'read/problems', 'search']`
- **Full-power agents**: `['search', 'read', 'edit', 'execute', 'vscode', 'web', 'agent']`
- **Documentation agents**: `['search', 'read', 'edit/createFile', 'edit/editFiles']`
