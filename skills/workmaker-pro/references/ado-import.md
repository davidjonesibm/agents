# ADO Import Template

When the user asks to export, generate, or format work items for Azure DevOps (ADO) import, produce a CSV using the schema and rules below.

## CSV Column Schema

```
ID,Work Item Type,Title 1,Title 2,Title 3,State,Tags,Description,Area Path,Iteration Path
```

| Column           | Description                                                                   |
| ---------------- | ----------------------------------------------------------------------------- |
| `ID`             | Numeric ADO ID for existing items; leave blank for new items                  |
| `Work Item Type` | `Epic`, `Feature`, or `User Story`                                            |
| `Title 1`        | Title value when the row is an **Epic**                                       |
| `Title 2`        | Title value when the row is a **Feature**                                     |
| `Title 3`        | Title value when the row is a **User Story**                                  |
| `State`          | `New`, `Active`, `Resolved`, `Closed` — default to `New` unless specified     |
| `Tags`           | Semicolon-separated tag list (e.g. `my-project; q1`)                          |
| `Description`    | Plain text description of the work item; avoid commas or wrap field in quotes |
| `Area Path`      | ADO area path using backslash separators (e.g. `MyTeam\Sprint 1`)             |
| `Iteration Path` | ADO iteration path (e.g. `MyTeam`)                                            |

## Hierarchy and Indentation Rules

ADO derives the parent-child hierarchy from **which Title column is populated**:

- **Epic row**: populate `Title 1`, leave `Title 2` and `Title 3` blank.
- **Feature row**: populate `Title 2`, leave `Title 1` and `Title 3` blank. Appears after its parent Epic.
- **User Story row**: populate `Title 3`, leave `Title 1` and `Title 2` blank. Appears after its parent Feature.

Children must follow their parent in the CSV. The import tool uses row order + title column position to reconstruct the tree.

## Example

```csv
ID,Work Item Type,Title 1,Title 2,Title 3,State,Tags,Description,Area Path,Iteration Path
,Epic,<Epic title>,,,,<tag1>; <tag2>,,<Team>\<Area>,<Team>
,Feature,,<Feature title>,,New,<tag1>; <tag2>,,<Team>\<Area>,<Team>
,User Story,,,[P0] <Story title>,New,<tag1>; <tag2>,<Plain text description of the story.>,<Team>\<Area>,<Team>
,User Story,,,[P1] <Story title>,New,<tag1>; <tag2>,<Plain text description of the story.>,<Team>\<Area>,<Team>
```

## Generation Rules

1. **One header row** — always emit the header as the first row.
2. **Row order preserves hierarchy** — emit Epic, then each Feature directly beneath it, then each User Story beneath its Feature.
3. **Only one Title column populated per row** — never populate more than one of `Title 1`, `Title 2`, `Title 3` on the same row.
4. **Blank ID for new items** — leave the `ID` field empty for items being created; only include an ID to update an existing item.
5. **Quote fields containing commas or semicolons** — wrap `Description` and `Tags` in double quotes.
6. **No markdown in Description** — ADO does not render markdown in the CSV import path; use plain text only.
7. **Tags are semicolon-separated** — use `; ` (semicolon + space) between tags.
8. **Area Path and Iteration Path** — use backslash (`\`) as the path separator; do not quote unless the path contains a comma.
9. **Priority notation in titles** — when stories carry a priority prefix (e.g. `[P0]`, `[P1]`, `[High]`), preserve it in `Title 3` as-is.
10. **State defaults to `New`** — omit or set `New` unless the user specifies a different state.

## Prompting the User for Missing Values

Before generating the CSV, confirm any values the user has not provided:

| Required         | Ask if missing                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Area Path        | "What ADO area path should these items use? (e.g. `MyTeam\Sprint 1`)"                          |
| Iteration Path   | "What iteration path? (e.g. `MyTeam`)"                                                         |
| Tags             | "Any tags to apply to all items? (semicolon-separated)"                                        |
| Existing Epic ID | "Is there an existing Epic ID to attach features/stories to, or should a new Epic be created?" |

## Output Format

Emit the CSV in a fenced code block with the `csv` language identifier so it renders correctly:

````
```csv
ID,Work Item Type,Title 1,Title 2,Title 3,State,Tags,Description,Area Path,Iteration Path
...rows...
```
````

Follow the CSV with a short summary: total item counts by type (e.g. "1 Epic · 2 Features · 12 User Stories").
