# PocketBase Collection Design

Target: PocketBase v0.25+

## Collection Types

PocketBase has three collection types:

| Type   | Purpose                                | Has auth fields? |
| ------ | -------------------------------------- | ---------------- |
| `base` | Generic data (posts, products, etc.)   | No               |
| `auth` | User/account records with auth support | Yes              |
| `view` | Read-only SQL view over other tables   | No               |

- Use `auth` collections for any entity that needs to log in (users, admins, API keys).
- Use `view` collections for computed/aggregated data instead of duplicating fields.

## Field Types

| Type       | Use case                      | Key options                                    |
| ---------- | ----------------------------- | ---------------------------------------------- |
| `text`     | Strings, slugs, names         | `min`, `max`, `pattern`, `autogeneratePattern` |
| `number`   | Integers, floats              | `min`, `max`, `noDecimal`                      |
| `bool`     | Flags, toggles                | —                                              |
| `email`    | Email addresses               | `exceptDomains`, `onlyDomains`                 |
| `url`      | URLs                          | `exceptDomains`, `onlyDomains`                 |
| `date`     | Date/time values              | `min`, `max`                                   |
| `select`   | Enum-like single/multi values | `values`, `maxSelect`                          |
| `relation` | FK to another collection      | `collectionId`, `cascadeDelete`, `max`         |
| `file`     | File uploads                  | `maxSelect`, `maxSize`, `mimeTypes`            |
| `json`     | Arbitrary JSON data           | `maxSize`                                      |
| `autodate` | Auto-set timestamps           | `onCreate`, `onUpdate`                         |
| `editor`   | Rich text (HTML)              | `maxSize`, `convertUrls`                       |

## Schema Design Rules

- Always set `required: true` on fields that must have a value. PocketBase does not require fields by default.

  ```js
  // Before — field allows empty values
  { type: "text", name: "title" }

  // After
  { type: "text", name: "title", required: true, max: 200 }
  ```

- Use `select` fields with defined `values` for enum-like data instead of free-text fields.

  ```js
  // Before — free text allows typos
  { type: "text", name: "status" }

  // After — constrained options
  { type: "select", name: "status", values: ["draft", "published", "archived"], required: true }
  ```

- Use `relation` fields with `cascadeDelete: true` when child records should be deleted with the parent.

  ```js
  {
    type: "relation",
    name: "author",
    collectionId: usersCollection.id,
    required: true,
    cascadeDelete: true,
  }
  ```

- Use `autodate` fields for `created` and `updated` timestamps — they are added automatically to new collections but verify they exist.

- Set sensible `max` limits on `text`, `file`, `json`, and `editor` fields to prevent abuse.

  ```js
  { type: "text", name: "bio", max: 500 }
  { type: "file", name: "avatar", maxSelect: 1, maxSize: 5242880 } // 5MB
  { type: "json", name: "metadata", maxSize: 2000000 } // ~2MB
  ```

- Use `presentable: true` on the field that best represents the record in the admin UI (e.g., `name`, `title`).

- Multi-relation fields: set `maxSelect` to limit the number of related records.

## Indexes

- Always add indexes for fields used in API rules, filters, or sort operations.

  ```js
  // In a migration
  collection.indexes = [
    'CREATE INDEX idx_posts_author ON posts (author)',
    'CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)',
  ];
  ```

- Use unique indexes to enforce uniqueness at the database level, not just in application code.

## System Fields

Every collection automatically has these system fields:

- `id` — 15-character auto-generated alphanumeric string
- `created` — autodate set on create
- `updated` — autodate set on create and update

Auth collections additionally have: `email`, `emailVisibility`, `verified`, `username`, `password`, `tokenKey`.

- Never redefine system fields in your schema — they are managed by PocketBase.
- Do not rely on sequential or time-sortable IDs — PocketBase IDs are random strings.
