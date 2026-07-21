# PocketBase Idiomatic Patterns

Target: PocketBase v0.25+

## Server-Side vs Client-Side API Distinction

The PocketBase JSVM (`pb_hooks/`, `pb_migrations/`) and the PocketBase JS SDK (client-side) are **different environments**. Do not mix their APIs.

```js
// WRONG — using SDK syntax in pb_hooks
import PocketBase from 'pocketbase';
const pb = new PocketBase('http://...');
await pb.collection('posts').getList();

// CORRECT — using JSVM globals in pb_hooks
const records = $app.findRecordsByFilter(
  'posts',
  'active = true',
  '-created',
  10,
  0,
);
```

```ts
// WRONG — using JSVM globals in client code
const records = $app.findRecordsByFilter('posts', '');

// CORRECT — using JS SDK in client code
const records = await pb.collection('posts').getFullList();
```

## Request Data Access in Hooks

```js
// Access request info in hooks
onRecordCreateRequest((e) => {
  const auth = e.auth; // authenticated record (or null)
  const body = e.request.body; // request body
  const query = e.request.url.query(); // query params

  // Set values from auth context
  e.record.set('author', auth?.id);

  e.next();
}, 'posts');
```

## Request-Scoped Data Sharing

Share data between middlewares and the route handler using `e.set()` / `e.get()`:

```js
// Middleware
routerUse((e) => {
  e.set('requestTime', Date.now());
  return e.next();
});

// Route handler
routerAdd('GET', '/timing', (e) => {
  const start = e.get('requestTime');
  return e.json(200, { elapsed: Date.now() - start });
});
```

## Preventing Field Overwrite on Update

Always guard against users changing fields they shouldn't:

```js
onRecordUpdateRequest((e) => {
  // Prevent changing the author
  const original = e.record.original();
  if (original) {
    e.record.set('author', original.get('author'));
  }
  e.next();
}, 'posts');
```

Or use API rules (preferred when possible — see `references/security.md`):

```
@request.auth.id != '' && author = @request.auth.id && (@request.body.author:isset = false || @request.body.author = @request.auth.id)
```

## Checking Record Access Programmatically

```js
// In custom routes, verify access using collection rules
routerAdd(
  'GET',
  '/api/custom/post/{id}',
  (e) => {
    const id = e.request.pathValue('id');
    const record = $app.findRecordById('posts', id);

    const requestInfo = e.requestInfo();
    const canAccess = $app.canAccessRecord(
      record,
      requestInfo,
      record.collection().viewRule,
    );
    if (!canAccess) {
      throw new ForbiddenError('Access denied');
    }

    return e.json(200, record);
  },
  $apis.requireAuth(),
);
```

## Auto-Generate Fields

Use the `:autogenerate` modifier for fields like slugs:

```js
// JSVM
record.set("slug:autogenerate", "post-"); // generates "post-abc123..."

// In migration field config
{ type: "text", name: "slug", autogeneratePattern: "[a-z0-9]{10}" }
```

## Standardized Auth Response

When building custom auth routes, use `$apis.recordAuthResponse()` for consistent response format:

```js
routerAdd('POST', '/custom-login', (e) => {
  const data = new DynamicModel({ phone: '', code: '' });
  e.bindBody(data);

  const record = $app.findFirstRecordByData('users', 'phone', data.phone);
  // ... validate code ...

  return $apis.recordAuthResponse(e, record, 'phone');
});
```

## Template Rendering

```js
routerAdd('GET', '/page/{name}', (e) => {
  const name = e.request.pathValue('name');
  const html = $template
    .loadFiles(`${__hooks}/views/layout.html`, `${__hooks}/views/page.html`)
    .render({ name });

  return e.html(200, html);
});
```

## Anti-Patterns

- **Querying the DB from client code** — Always go through the REST API; never try to access SQLite directly.

- **Creating a new PocketBase SDK instance per request** — Reuse a single instance (see `references/api.md`).

- **Ignoring error responses** — Always handle `ClientResponseError` from the SDK.

- **Using `getFullList()` for large datasets** — Use paginated `getList()` instead.

- **Not filtering hooks by collection** — Use collection tags to prevent hooks from running on every collection.

- **Modifying applied migration files** — Always create new migration files for changes.

- **Using `_superusers` collection for regular users** — Create a separate `users` auth collection.

- **Relying on client validation alone** — Always enforce constraints via API rules and field configuration.
