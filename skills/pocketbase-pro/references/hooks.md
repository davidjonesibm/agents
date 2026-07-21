# PocketBase JavaScript Hooks

Target: PocketBase v0.25+ JSVM (`pb_hooks/`)

## Overview

Hook files live in `pb_hooks/` and are loaded automatically. File names should end with `.pb.js` (e.g., `pb_hooks/main.pb.js`). Hooks run in the PocketBase JSVM — not Node.js — so no npm modules are available.

## Hook Lifecycle

PocketBase hooks follow a consistent pattern with `e.next()` to proceed through the middleware chain:

```js
onRecordCreate((e) => {
  // Before: runs BEFORE validation and DB INSERT
  e.record.set('status', 'pending');

  e.next(); // proceed to the actual create

  // After: runs AFTER validation and DB INSERT (but not necessarily committed)
}, 'posts');
```

**Critical:** Always call `e.next()` unless you intentionally want to stop the chain (e.g., to block an operation).

## Record CRUD Hooks

### Full Lifecycle

For each CRUD operation (create, update, delete), the full hook chain is:

1. `onRecord[Create|Update|Delete]` — wraps the entire operation
2. `onRecord[Create|Update|Delete]Execute` — after validation, before DB statement
3. `onRecordAfter[Create|Update|Delete]Success` — after successful DB persistence (delayed if in transaction)
4. `onRecordAfter[Create|Update|Delete]Error` — after failed DB persistence

### Create Hooks

```js
// Before validation and INSERT
onRecordCreate((e) => {
  e.record.set('slug', generateSlug(e.record.get('title')));
  e.next();
}, 'posts');

// After successful persistence — guaranteed committed
onRecordAfterCreateSuccess((e) => {
  console.log('Post created:', e.record.id);
  e.next();
}, 'posts');
```

### Update Hooks

```js
onRecordUpdate((e) => {
  // prevent changing the author after creation
  const original = e.record.original();
  if (original && e.record.get('author') !== original.get('author')) {
    throw new BadRequestError('Cannot change author');
  }
  e.next();
}, 'posts');
```

### Delete Hooks

```js
onRecordDelete((e) => {
  // prevent deleting published posts
  if (e.record.get('published')) {
    throw new BadRequestError('Cannot delete published posts');
  }
  e.next();
}, 'posts');
```

## Request Hooks

Request hooks intercept API requests specifically (not programmatic `$app.save()` calls):

```js
// Intercept create API request
onRecordCreateRequest((e) => {
  // e.collection, e.record, e.auth, etc.
  if (!e.auth) {
    throw new UnauthorizedError('Must be logged in');
  }
  e.record.set('author', e.auth.id);
  e.next();
}, 'posts');

// Intercept update API request
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    return e.next(); // superusers bypass
  }
  e.record.set('status', 'pending'); // force moderation
  e.next();
}, 'articles');

// Intercept delete API request
onRecordDeleteRequest((e) => {
  e.next();
}, 'posts');
```

## Model Hooks (Low-Level)

Model hooks fire for any model save/delete, including collections themselves:

```js
onModelCreate((e) => {
  e.next();
});
onModelUpdate((e) => {
  e.next();
});
onModelDelete((e) => {
  e.next();
});
onModelAfterCreateSuccess((e) => {
  e.next();
});
onModelAfterUpdateSuccess((e) => {
  e.next();
});
onModelAfterDeleteSuccess((e) => {
  e.next();
});
```

## Collection Hooks

```js
onCollectionCreate((e) => {
  e.next();
}, 'posts');
onCollectionUpdate((e) => {
  e.next();
}, 'posts');
onCollectionDelete((e) => {
  e.next();
}, 'posts');
onCollectionAfterCreateSuccess((e) => {
  e.next();
}, 'posts');
```

## Auth Hooks

```js
// After successful authentication (any method)
onRecordAuthRequest((e) => {
  console.log('User logged in:', e.record.email());
  console.log('Auth method:', e.authMethod);
  e.next();
}, 'users');

// OAuth2 sign-in/sign-up (after token exchange, before linking)
onRecordAuthWithOAuth2Request((e) => {
  // e.record may be null for new sign-ups
  // e.oAuth2User contains provider data
  // e.isNewRecord
  if (e.isNewRecord) {
    e.record.set('name', e.oAuth2User.name);
  }
  e.next();
}, 'users');

// OTP authentication
onRecordAuthWithOTPRequest((e) => {
  e.next();
}, 'users');
```

## Mailer Hooks

```js
onMailerRecordVerificationSend((e) => {
  e.message.subject = 'Please verify your email';
  e.next();
});

// Also available:
// onMailerRecordPasswordResetSend
// onMailerRecordEmailChangeSend
// onMailerRecordOTPSend
```

## File Token Hook

```js
onFileTokenRequest((e) => {
  // e.record, e.token
  e.next();
}, 'users');
```

## Record Enrich Hook

Use `onRecordEnrich` to add computed fields or hide sensitive data before sending records to the client:

```js
onRecordEnrich((e) => {
  // Hide sensitive fields
  e.record.hide('internalNotes');

  // Add computed field (requires explicit opt-in)
  if (e.requestInfo.auth) {
    e.record.withCustomData(true);
    e.record.set('score', e.record.get('baseScore') * 2);
  }

  e.next();
}, 'posts');
```

## Custom Routes

```js
// Public route
routerAdd('GET', '/hello/{name}', (e) => {
  const name = e.request.pathValue('name');
  return e.json(200, { message: 'Hello ' + name });
});

// Authenticated route
routerAdd(
  'POST',
  '/api/myapp/settings',
  (e) => {
    return e.json(200, { success: true });
  },
  $apis.requireAuth(),
);
```

## Global Middleware

```js
routerUse((e) => {
  console.log('Request:', e.request.method, e.request.url.path);
  return e.next();
});
```

## Cron Jobs

```js
cronAdd('cleanup', '0 3 * * *', () => {
  // Runs at 3 AM daily
  const records = $app.findRecordsByFilter(
    'logs',
    'created < @now - 30d',
    '-created',
    0,
    0,
  );
  for (const record of records) {
    $app.delete(record);
  }
});
```

## Hook Best Practices

- Always call `e.next()` unless intentionally blocking an operation.
- Use `onRecordAfterCreateSuccess` / `onRecordAfterUpdateSuccess` for side effects that depend on committed data (sending emails, webhooks).
- Use `onRecordCreate` / `onRecordUpdate` (pre-hooks) only for modifying or validating the record before persistence.
- Filter hooks to specific collections using the optional tags parameter — avoid global hooks when collection-specific ones suffice.

  ```js
  // Before — runs for ALL record creates
  onRecordCreate((e) => { ... });

  // After — only runs for "posts"
  onRecordCreate((e) => { ... }, "posts");
  ```

- Remember: request hooks (`onRecord*Request`) only fire for HTTP API requests. Programmatic `$app.save()` calls trigger model hooks only.
