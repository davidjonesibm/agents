# PocketBase Performance Best Practices

Target: PocketBase v0.25+

## Query Optimization

- Use `expand` to load relations in a single request instead of making N+1 queries.

  ```ts
  // Before — N+1 queries
  const posts = await pb.collection('posts').getFullList();
  for (const post of posts) {
    const author = await pb.collection('users').getOne(post.author);
  }

  // After — single request
  const posts = await pb.collection('posts').getFullList({
    expand: 'author',
  });
  ```

- Use the `fields` parameter to select only needed fields and reduce payload size.

  ```ts
  // Before — fetches all fields
  const posts = await pb.collection('posts').getFullList();

  // After — only needed fields
  const posts = await pb.collection('posts').getFullList({
    fields: 'id,title,created,expand.author.name',
    expand: 'author',
  });
  ```

- Use `getList()` with pagination instead of `getFullList()` for large collections. `getFullList()` fetches everything in memory.

  ```ts
  // Before — loads ALL records
  const all = await pb.collection('logs').getFullList();

  // After — paginated
  const page = await pb.collection('logs').getList(1, 50, { sort: '-created' });
  ```

## Indexing

- Add indexes for all fields used in API rules, `filter`, and `sort` parameters.

  ```js
  // Migration
  collection.indexes = [
    'CREATE INDEX idx_posts_author ON posts (author)',
    'CREATE INDEX idx_posts_created ON posts (created)',
    'CREATE INDEX idx_posts_status ON posts (status)',
  ];
  ```

- Use composite indexes for commonly combined filter/sort patterns.

  ```js
  'CREATE INDEX idx_posts_author_created ON posts (author, created DESC)';
  ```

- Add `UNIQUE` indexes to enforce uniqueness at the database level — much faster than application-level checks.

## Realtime Efficiency

- Subscribe to specific records when possible instead of entire collections.
- Apply deltas from realtime events instead of re-fetching the full list (see `references/realtime.md`).
- Unsubscribe from realtime topics when components unmount to prevent unnecessary processing.

## Batch Operations

- Use the batch API (`POST /api/batch`) for multi-record operations to reduce HTTP round trips and ensure atomicity.

## Server-Side Performance (JSVM)

- Use `findRecordsByFilter` with limit parameters to avoid loading all records.

  ```js
  // Before — loads all matching records
  const records = $app.findRecordsByFilter(
    'posts',
    "status = 'draft'",
    '-created',
    0,
    0,
  );

  // After — limited result set
  const records = $app.findRecordsByFilter(
    'posts',
    "status = 'draft'",
    '-created',
    10,
    0,
  );
  ```

- Use raw SQL for complex data migrations instead of loading and saving records one by one.

  ```js
  // Before — slow record-by-record update
  const records = $app.findRecordsByFilter('posts', "status = ''", '', 0, 0);
  for (const r of records) {
    r.set('status', 'draft');
    $app.save(r);
  }

  // After — bulk SQL update
  $app
    .db()
    .newQuery("UPDATE posts SET status = 'draft' WHERE status = ''")
    .execute();
  ```

## Cron Cleanup

- Schedule periodic cleanup of stale data (expired tokens, old logs) using cron jobs to keep the database lean.

  ```js
  cronAdd('cleanupOldLogs', '0 3 * * *', () => {
    $app
      .db()
      .newQuery("DELETE FROM logs WHERE created < datetime('now', '-30 days')")
      .execute();
  });
  ```

## SQLite-Specific Considerations

- PocketBase uses SQLite — write operations are serialized by default. Minimize long-running transactions in hooks.
- For read-heavy workloads, PocketBase handles concurrency well; for write-heavy workloads, batch writes when possible.
- PocketBase runs periodic `OPTIMIZE` and `VACUUM` automatically via internal cron jobs.
