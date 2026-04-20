# PocketBase JavaScript Migrations

Target: PocketBase v0.25+ JSVM

## Overview

Migration files live in `pb_migrations/` and are executed in alphabetical order by filename. Use timestamped filenames: `pb_migrations/1700000001_create_posts.js`.

## Migration Structure

Every migration uses the `migrate()` function with an up function and an optional down (revert) function.

```js
// pb_migrations/1700000001_create_posts.js
migrate(
  (app) => {
    // UP: apply changes
    const collection = new Collection({
      type: 'base',
      name: 'posts',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && author = @request.auth.id",
      deleteRule: "@request.auth.id != '' && author = @request.auth.id",
      fields: [
        { type: 'text', name: 'title', required: true, max: 200 },
        { type: 'editor', name: 'content' },
        { type: 'bool', name: 'published' },
        {
          type: 'relation',
          name: 'author',
          collectionId: 'users_collection_id',
          required: true,
        },
      ],
      indexes: ['CREATE INDEX idx_posts_author ON posts (author)'],
    });
    app.save(collection);
  },
  (app) => {
    // DOWN: revert changes
    const collection = app.findCollectionByNameOrId('posts');
    app.delete(collection);
  },
);
```

## Creating Collections

- Use `new Collection({...})` to create collections. System fields (`id`, `created`, `updated`) are auto-generated — do not include them.
- For `auth` type collections, auth-specific fields (`email`, `password`, etc.) are also auto-generated.

  ```js
  migrate(
    (app) => {
      const collection = new Collection({
        type: 'auth',
        name: 'clients',
        listRule: 'id = @request.auth.id',
        viewRule: 'id = @request.auth.id',
        fields: [
          { type: 'text', name: 'company', required: true, max: 100 },
          { type: 'url', name: 'website', presentable: true },
        ],
        passwordAuth: { enabled: false },
        otp: { enabled: true },
        indexes: ['CREATE INDEX idx_clients_company ON clients (company)'],
      });
      app.save(collection);
    },
    (app) => {
      const collection = app.findCollectionByNameOrId('clients');
      app.delete(collection);
    },
  );
  ```

## Modifying Existing Collections

- Always find the collection first, modify it, then save.

  ```js
  migrate((app) => {
    const collection = app.findCollectionByNameOrId('posts');

    // Add a new field
    collection.fields.add(
      new Field({ type: 'text', name: 'subtitle', max: 200 }),
    );

    // Update a rule
    collection.updateRule =
      "@request.auth.id != '' && author = @request.auth.id";

    app.save(collection);
  });
  ```

## Raw SQL in Migrations

- Use `app.db().newQuery()` for data migrations or operations not covered by the collection API.

  ```js
  migrate((app) => {
    app
      .db()
      .newQuery("UPDATE posts SET status = 'draft' WHERE status = ''")
      .execute();
  });
  ```

## Snapshot Migrations

- Generate a full collections snapshot with: `./pocketbase migrate collections`
- This creates a migration capturing the current state of all collections — useful for baselining.

## Migration Best Practices

- Always provide a `down` function for reversibility, especially for collection creation/deletion.

  ```js
  // Before — no revert
  migrate((app) => {
    const c = new Collection({ name: "tasks", type: "base", fields: [...] });
    app.save(c);
  });

  // After — reversible
  migrate((app) => {
    const c = new Collection({ name: "tasks", type: "base", fields: [...] });
    app.save(c);
  }, (app) => {
    const c = app.findCollectionByNameOrId("tasks");
    app.delete(c);
  });
  ```

- Never modify a migration file that has already been applied in production. Create a new migration instead.

- Always set API rules in the migration — do not leave them as `null` (locked) accidentally when records need client access.

- Use `app.findCollectionByNameOrId()` to reference collections by name for readability, or by ID for stability across environments.

- When adding a `relation` field, the referenced collection must already exist (earlier migration or pre-existing).

## Running Migrations

```bash
./pocketbase migrate up       # apply all pending
./pocketbase migrate down 1   # revert last 1
./pocketbase migrate collections  # generate snapshot
```
