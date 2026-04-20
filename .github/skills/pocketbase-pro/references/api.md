# PocketBase SDK API Reference

Target: PocketBase JS SDK v0.25+

## Client Initialization

- Always create a single `PocketBase` instance and reuse it across the application.

  ```ts
  // Before — creating multiple instances
  async function getPost(id: string) {
    const pb = new PocketBase('http://127.0.0.1:8090');
    return pb.collection('posts').getOne(id);
  }

  // After — single shared instance
  import PocketBase from 'pocketbase';
  export const pb = new PocketBase('http://127.0.0.1:8090');
  ```

## CRUD Operations

- Use `getList()` for paginated results, `getFullList()` for fetching all records (batched automatically, 200 per request by default), and `getFirstListItem()` for single-record lookups by filter.

  ```ts
  // Paginated list
  const result = await pb.collection('posts').getList(1, 50, {
    filter: 'created >= "2024-01-01 00:00:00"',
    sort: '-created',
  });

  // All records (auto-batched)
  const all = await pb.collection('posts').getFullList({ sort: '-created' });

  // First matching record
  const record = await pb
    .collection('posts')
    .getFirstListItem('slug="hello-world"', { expand: 'author' });
  ```

- Use `getOne()` only when you have the record ID. Use `getFirstListItem()` when querying by field value.

  ```ts
  // Before — fetching by ID when you have a slug
  const list = await pb
    .collection('posts')
    .getList(1, 1, { filter: `slug="${slug}"` });
  const post = list.items[0];

  // After
  const post = await pb.collection('posts').getFirstListItem(`slug="${slug}"`);
  ```

## Relation Modifiers

- Use `+field` / `field+` to prepend/append to multi-relation fields without replacing the entire value. Use `field-` to remove specific IDs.

  ```ts
  // Append tags without replacing existing ones
  await pb.collection('posts').update('POST_ID', {
    'tags+': ['TAG_ID1', 'TAG_ID2'],
  });

  // Remove a specific tag
  await pb.collection('posts').update('POST_ID', {
    'tags-': 'TAG_ID1',
  });
  ```

## Expand Relations

- Always use the `expand` query parameter to load related records in a single request instead of making separate queries.

  ```ts
  // Before — N+1 queries
  const post = await pb.collection('posts').getOne(id);
  const author = await pb.collection('users').getOne(post.author);

  // After — single request with expand
  const post = await pb.collection('posts').getOne(id, { expand: 'author' });
  const author = post.expand?.author;
  ```

- `expand` supports up to 6 levels of nested relations: `expand: 'author,comments.user'`.

## Batch API

- Use `POST /api/batch` for atomic multi-record operations (create, update, delete in a single transaction).

  ```ts
  await pb.send('/api/batch', {
    method: 'POST',
    body: {
      requests: [
        {
          method: 'POST',
          url: '/api/collections/posts/records',
          body: { title: 'A' },
        },
        {
          method: 'PATCH',
          url: '/api/collections/posts/records/ID',
          body: { title: 'B' },
        },
        { method: 'DELETE', url: '/api/collections/posts/records/ID2' },
      ],
    },
  });
  ```

## Custom Routes (Client-Side)

- Use `pb.send()` to call custom server-side routes registered with `routerAdd`.

  ```ts
  const result = await pb.send('/hello', {
    query: { name: 'world' },
  });
  ```

## Error Handling

- PocketBase SDK throws `ClientResponseError` with a `response` property containing structured validation errors. Always handle it.

  ```ts
  import { ClientResponseError } from 'pocketbase';

  try {
    await pb.collection('posts').create({ title: '' });
  } catch (err) {
    if (err instanceof ClientResponseError) {
      console.error('Status:', err.status);
      console.error('Validation:', err.response.data);
    }
  }
  ```

## Fields Filtering

- Use the `fields` query parameter to select only needed fields, reducing payload size.

  ```ts
  const posts = await pb.collection('posts').getList(1, 50, {
    fields: 'id,title,created',
  });
  ```
