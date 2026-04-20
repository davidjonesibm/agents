# PocketBase TypeScript Patterns

Target: PocketBase JS SDK v0.25+

## Typed Record Models

Define interfaces matching your collection schema and pass them as generics to SDK methods:

```ts
interface Post {
  id: string;
  title: string;
  content: string;
  published: boolean;
  author: string;
  created: string;
  updated: string;
}

// Typed list
const result = await pb.collection('posts').getList<Post>(1, 20);
// result.items is Post[]

// Typed single record
const post = await pb.collection('posts').getOne<Post>('RECORD_ID');
// post is Post

// Typed first item
const post = await pb
  .collection('posts')
  .getFirstListItem<Post>('slug="hello"');
```

## Expanded Relations

Type expanded relations using optional `expand` property:

```ts
interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface PostWithExpand extends Post {
  expand?: {
    author?: User;
    comments?: Comment[];
  };
}

const post = await pb.collection('posts').getOne<PostWithExpand>('ID', {
  expand: 'author,comments',
});

// Access expanded data
const authorName = post.expand?.author?.name;
```

## Type Generation with pocketbase-typegen

Use [pocketbase-typegen](https://github.com/patmood/pocketbase-typegen) to auto-generate TypeScript types from your PocketBase schema:

```bash
npx pocketbase-typegen --db ./pb_data/data.db --out src/types/pocketbase.ts
```

This generates types like:

```ts
// Auto-generated
export interface PostsRecord {
  id: string;
  title: string;
  content: string;
  published: boolean;
  author: string;
  created: string;
  updated: string;
}

export type PostsResponse<Texpand = unknown> = Required<PostsRecord> & {
  collectionId: string;
  collectionName: string;
  expand?: Texpand;
};
```

## Typed PocketBase Instance (SvelteKit Example)

```ts
// src/app.d.ts
import PocketBase from 'pocketbase';

declare global {
  namespace App {
    interface Locals {
      pb: PocketBase;
    }
  }
}
```

## Collection Name Constants

Avoid magic strings by defining collection names as constants:

```ts
// Before — magic strings scattered everywhere
await pb.collection('posts').getList();
await pb.collection('posts').create(data);

// After — centralized constants
export const Collections = {
  POSTS: 'posts',
  USERS: 'users',
  COMMENTS: 'comments',
} as const;

await pb.collection(Collections.POSTS).getList<Post>();
```

## Type-Safe Auth Store

```ts
// Access typed auth record
const user = pb.authStore.record as User | null;

// Type-safe auth check
function requireAuth(): User {
  if (!pb.authStore.isValid || !pb.authStore.record) {
    throw new Error('Not authenticated');
  }
  return pb.authStore.record as User;
}
```

## Handling File URLs with Types

```ts
interface PostWithFiles {
  id: string;
  title: string;
  image: string; // single file field — filename string
  documents: string[]; // multi-file field — array of filename strings
}

function getImageUrl(
  record: PostWithFiles,
  options?: { thumb?: string },
): string {
  return pb.files.getURL(record, record.image, options);
}

function getDocumentUrls(record: PostWithFiles): string[] {
  return record.documents.map((filename) => pb.files.getURL(record, filename));
}
```

## TypeScript Best Practices

- Keep type definitions in sync with your PocketBase schema. Run `pocketbase-typegen` as part of your CI/CD pipeline after migrations.
- Define separate types for "record" (what you send) vs "response" (what you receive) when needed — responses always include `id`, `created`, `updated`, `collectionId`, `collectionName`.
- Use generic type parameters on all SDK CRUD methods — never use untyped `any`.

  ```ts
  // Before
  const post = await pb.collection('posts').getOne('ID');
  // post is RecordModel (untyped)

  // After
  const post = await pb.collection('posts').getOne<Post>('ID');
  // post is Post
  ```

- Type the `expand` object explicitly — expanded relations are always optional since they depend on query params.
- Use `as const` for select field value unions:

  ```ts
  const PostStatus = ['draft', 'published', 'archived'] as const;
  type PostStatus = (typeof PostStatus)[number]; // 'draft' | 'published' | 'archived'
  ```
