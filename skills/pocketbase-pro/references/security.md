# PocketBase Security & API Rules

Target: PocketBase v0.25+

## API Rule Basics

Every collection has 5 access rules:

| Rule         | Controls                                | Default                 |
| ------------ | --------------------------------------- | ----------------------- |
| `listRule`   | `GET /api/collections/X/records`        | Locked (superuser only) |
| `viewRule`   | `GET /api/collections/X/records/:id`    | Locked                  |
| `createRule` | `POST /api/collections/X/records`       | Locked                  |
| `updateRule` | `PATCH /api/collections/X/records/:id`  | Locked                  |
| `deleteRule` | `DELETE /api/collections/X/records/:id` | Locked                  |

Auth collections also have `manageRule` — allows one user to fully manage another user's data (email, password, etc.).

### Rule Values

| Value           | Meaning                                         |
| --------------- | ----------------------------------------------- |
| `null` (locked) | Only superusers can perform the action          |
| `""` (empty)    | Anyone can perform the action (public)          |
| Filter string   | Only requests satisfying the filter can proceed |

- **Never leave `createRule`, `updateRule`, or `deleteRule` as `""` (empty string) unless the collection is intentionally public-write.** This is the most common security mistake.

  ```js
  // DANGEROUS — anyone can create records
  collection.createRule = '';

  // SAFE — only authenticated users
  collection.createRule = "@request.auth.id != ''";
  ```

## API Rules Also Filter Records

- API rules act as **both** access control **and** data filters. A `listRule` of `active = true` means only active records are returned — unauthenticated requests get a 200 with empty items, not a 403.
- `listRule` returns 200 empty on mismatch. `createRule` returns 400. `viewRule`, `updateRule`, `deleteRule` return 404.
- Rules are **ignored** when the request is from an authorized superuser.

## Filter Syntax

```
OPERAND OPERATOR OPERAND
```

**Operators:** `=`, `!=`, `>`, `>=`, `<`, `<=`, `~` (contains), `!~` (not contains)

**Any-of operators:** `?=`, `?!=`, `?>`, `?>=`, `?<`, `?<=`, `?~`, `?!~`

**Logical:** `&&` (AND), `||` (OR), parentheses `()` for grouping

## Common Rule Patterns

- **Authenticated users only:**

  ```
  @request.auth.id != ''
  ```

- **Record owner only:**

  ```
  @request.auth.id != '' && author = @request.auth.id
  ```

- **Role-based access:**

  ```
  @request.auth.role = "staff"
  ```

- **Owner OR staff:**

  ```
  @request.auth.id != '' && (@request.auth.role = "staff" || author = @request.auth.id)
  ```

- **Prevent users from changing ownership on update:**

  ```
  @request.auth.id != '' && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)
  ```

  **Why:** Without the `@request.body.user` check, a user could reassign the record to someone else.

- **Cross-collection lookups** (`@collection`):

  ```
  @request.auth.id != '' && @collection.members.user = @request.auth.id && @collection.members.group = id
  ```

- **Back-relation lookups** (nested relation fields):
  ```
  someRelField.anotherRelField.owner = @request.auth.id
  ```

## Security Anti-Patterns

- Never use empty string `""` for `deleteRule` without careful consideration — it means anyone can delete any record.

- Never trust `@request.body.*` alone for authorization. Always verify against `@request.auth.*`.

  ```js
  // DANGEROUS — trusts client-submitted userId
  collection.createRule = "@request.body.user != ''";

  // SAFE — validates against authenticated identity
  collection.createRule =
    "@request.auth.id != '' && @request.body.user = @request.auth.id";
  ```

- Always set `emailVisibility` to `false` by default on auth collections. Only expose emails when explicitly needed.

## Superuser Security

- Never expose superuser credentials in client-side code or environment variables accessible to the frontend.
- Never use the `_superusers` collection for regular application authentication — create a separate `users` auth collection.
- Enable settings encryption in production using the `--encryptionEnv` flag.

  ```bash
  export PB_ENCRYPTION_KEY="your-random-32-character-string"
  pocketbase serve --encryptionEnv=PB_ENCRYPTION_KEY
  ```

## Realtime Security

- When subscribing to a **single record**, PocketBase uses the collection's `viewRule` to determine access.
- When subscribing to an **entire collection** (`*`), PocketBase uses the collection's `listRule`.
- If a subscribed user no longer satisfies the rule (e.g., role changes), they stop receiving events.

## File Access Security

- Protected files require a short-lived file token obtained via `POST /api/files/token`.
- Use file tokens for sensitive uploads — do not rely on obscure URLs alone.

  ```ts
  const token = await pb.files.getToken();
  const url = pb.files.getURL(record, record.avatar, { token });
  ```
