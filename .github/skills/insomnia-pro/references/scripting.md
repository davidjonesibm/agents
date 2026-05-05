# Scripting

Pre-request and after-response scripts in Insomnia 12.5+: the full `insomnia.*` API surface, available libraries, common patterns, testing assertions, and migration from deprecated unit tests.

## Script Types

| Script             | When it runs                   | `insomnia.info.eventName` | Common use                                              |
| ------------------ | ------------------------------ | ------------------------- | ------------------------------------------------------- |
| **Pre-request**    | Before the request is sent     | `'prerequest'`            | Set dynamic headers, compute signatures, refresh tokens |
| **After-response** | After the response is received | `'test'`                  | Extract tokens, run assertions, chain requests          |

Scripts are JavaScript (async/await supported). Each script runs in a sandboxed Node-like environment.

## Global Aliases

| Global       | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| `$`          | Alias for the `insomnia` object (`$.environment.get('x')` works) |
| `_`          | `es-toolkit/compat` — lodash-compatible utility library          |
| `console`    | Standard console for logging                                     |
| `setTimeout` | Standard timer                                                   |

## `insomnia` API Reference

### Environment

```javascript
// environment = selected sub-env; if no sub-env selected, same as baseEnvironment
insomnia.environment.set('token', 'abc123');
insomnia.environment.get('token'); // 'abc123'
insomnia.environment.has('token'); // true
insomnia.environment.unset('token');
insomnia.environment.clear();
insomnia.environment.replaceIn('Bearer {{token}}'); // template substitution
insomnia.environment.toObject(); // plain JS object of all entries

// baseEnvironment — always the base env, unaffected by sub-env selection
insomnia.baseEnvironment.set('base_url', 'https://api.example.com');
insomnia.baseEnvironment.get('base_url');

// collectionVariables — EXACT ALIAS of baseEnvironment (same object reference)
insomnia.collectionVariables.set('page', 1); // same as baseEnvironment.set(...)
```

### Variables (full precedence chain)

`insomnia.variables` resolves values from highest to lowest priority:
`local → folder → iterationData → environment → collectionVariables/baseEnvironment → globals → baseGlobals`

```javascript
insomnia.variables.has('key');
insomnia.variables.get('key'); // resolves from highest-priority scope that has the key
insomnia.variables.set('key', value); // sets in local (transient) scope
insomnia.variables.replaceIn('Hello {{name}}');
insomnia.variables.toObject();
```

### Globals and Iteration Data

```javascript
insomnia.globals.set('shared_key', 'value'); // global variables
insomnia.baseGlobals.get('key');

// iterationData — values from Collection Runner CSV/JSON data file
const username = insomnia.iterationData.get('username');
```

### Request

Available in both pre-request and after-response scripts.

```javascript
insomnia.request.name; // request name string
insomnia.request.method; // 'GET', 'POST', etc.

// url is a Url OBJECT, not a string
insomnia.request.url.toString(); // full URL string
insomnia.request.url.getHost(); // hostname
insomnia.request.url.getPath(); // path only
insomnia.request.url.getPathWithQuery(); // path + query string
insomnia.request.url.getQueryString(); // query string only
insomnia.request.url.addQueryParams('page=1&limit=10');
insomnia.request.url.removeQueryParams(['page']);
insomnia.request.url.update('https://newhost.example.com/path');

// headers — HeaderList (PropertyList-backed, use list methods not Array.find)
insomnia.request.addHeader({ key: 'X-Trace-Id', value: 'abc' });
insomnia.request.upsertHeader({ key: 'X-Trace-Id', value: 'xyz' }); // add or update
insomnia.request.removeHeader('X-Trace-Id');
insomnia.request.getHeaders(); // all headers
insomnia.request.forEachHeader((h) => console.log(h.key, h.value));

// query params (shorthand on request — also available via request.url)
insomnia.request.addQueryParams([{ key: 'foo', value: 'bar' }]);
insomnia.request.removeQueryParams(['foo']);

// body
insomnia.request.body.mode; // 'raw', 'formdata', 'urlencoded', 'graphql', etc.
insomnia.request.body.raw; // raw body string
insomnia.request.body.update({
  mode: 'raw',
  raw: JSON.stringify({ key: 'val' }),
});
insomnia.request.body.isEmpty(); // true if no body
insomnia.request.body.toString();

// auth — supported types: noauth, basic, bearer, jwt, digest, oauth1, oauth2,
//        hawk, awsv4, ntlm, apikey, edgegrid, asap, netrc
insomnia.request.auth.use('bearer');
insomnia.request.auth.update({ token: myToken }, 'bearer');
// authorizeUsing is a shorthand on the request object itself
insomnia.request.authorizeUsing('bearer', { token: myToken });

// misc
insomnia.request.clone();
insomnia.request.size();
insomnia.request.toJSON();
insomnia.request.update(options);
insomnia.request.pathParameters; // path parameter values
```

### Response

Only available in after-response scripts; `undefined` in pre-request.

```javascript
// IMPORTANT: .code is the numeric status (e.g. 200); .status is the text (e.g. 'OK')
insomnia.response.code; // 200  ← use this for numeric comparisons
insomnia.response.status; // 'OK' ← status text, NOT a number
insomnia.response.responseTime; // response time in ms

// body
insomnia.response.json(); // parsed JSON
insomnia.response.text(); // raw string
insomnia.response.reason(); // status reason phrase
insomnia.response.size(); // response size
insomnia.response.dataURI(); // data URI (note: known typo in encoding label)

// headers — HeaderList (PropertyList-backed), NOT a plain array
// Use .get(key) / .one(key) — NOT .find()
// Both .get() and .one() are aliases — they scan backward → return LAST match
insomnia.response.headers.get('Content-Type'); // last matching value (scans backward)
insomnia.response.headers.one('Content-Type'); // last matching value (scans backward)
insomnia.response.headers.toObject(); // [{key, value}, ...]

// cookies — CookieList (PropertyList-backed), NOT a plain array
// Both .get() and .one() are aliases — they scan backward → return LAST match
insomnia.response.cookies.get('session'); // last matching value (scans backward)
insomnia.response.cookies.one('session'); // last matching value (scans backward)
insomnia.response.cookies.toObject(); // [{key, value, ...}, ...]

// chai-style .to assertion getter
insomnia.response.to.have.status(200); // chai assertion directly on response

insomnia.response.originalRequest; // the request that generated this response
```

### Cookies (workspace cookie jar)

```javascript
const jar = insomnia.cookies.jar(); // access the mutable CookieJar for the workspace
```

### Info

```javascript
insomnia.info.eventName; // 'prerequest' or 'test' (NOT 'afterresponse')
insomnia.info.iteration; // current iteration index (0-based)
insomnia.info.iterationCount; // total number of iterations
insomnia.info.requestName; // name of the current request
insomnia.info.requestId; // ID of the current request
```

### Execution (flow control)

```javascript
// Pre-request only: skip sending the request (creates synthetic 'Cancelled' response)
insomnia.execution.skipRequest();

// Control runner flow — accepts request ID or trimmed request name
insomnia.execution.setNextRequest('POST /auth/token'); // jump to named request
insomnia.execution.setNextRequest(insomnia.info.requestName); // re-run current (loop)
insomnia.execution.setNextRequest(''); // stop runner after this request

insomnia.execution.location.current; // current execution location (via proxy)
```

**Branching example:**

```javascript
// Pre-request: skip protected request if no token
if (!insomnia.environment.has('access_token')) {
  insomnia.execution.skipRequest();
}
```

**Looping example (retry on 429):**

```javascript
// After-response: retry the same request if rate-limited
if (insomnia.response.code === 429) {
  insomnia.execution.setNextRequest(insomnia.info.requestName);
}
```

### Vault

```javascript
// Vault is READ-ONLY from scripts.
// get() works only when Settings → Enable Vault in Scripts is ON.
const secret = await insomnia.vault.get('MY_API_KEY'); // display name as argument

// set(), unset(), clear() ALWAYS throw — do not call them.
// await insomnia.vault.set(...)   // ❌ throws unconditionally
```

### Parent Folders

```javascript
// Access ancestor folder environments and metadata
insomnia.parentFolders.get('folder-id-or-name'); // get specific folder by ID or name (throws if not found)
insomnia.parentFolders.getById('folder-id');
insomnia.parentFolders.getByName('Auth');
insomnia.parentFolders.findValue('base_url'); // find env value up the folder chain
insomnia.parentFolders.toObject();
insomnia.parentFolders.getEnvironments(); // folder-level environment objects
// Mutations to folder environments via parentFolders persist back to request groups
```

### clientCertificates

```javascript
insomnia.clientCertificates; // raw list of client certificates from settings/workspace
```

### Testing

```javascript
// test() — async supported; results collected as passed/failed/skipped
insomnia.test('name', async () => {
  /* ... */
});
insomnia.test.skip('skipped test', () => {
  /* ... */
});

insomnia.expect(value).to.equal(200); // Chai expect
```

### sendRequest

Accepts a URL string, a Request instance, or a RequestOptions object. Supports **both callback and promise** styles.

```javascript
// Promise style (preferred with async/await)
const resp = await insomnia.sendRequest({
  url: 'https://auth.example.com/token',
  method: 'POST',
  body: {
    mode: 'urlencoded',
    urlencoded: [
      { key: 'grant_type', value: 'client_credentials' },
      { key: 'client_id', value: insomnia.environment.get('client_id') },
      {
        key: 'client_secret',
        value: insomnia.environment.get('client_secret'),
      },
    ],
  },
});
// sendRequest response uses .code (NOT .status) for numeric status
insomnia.environment.set('access_token', resp.json().access_token);

// Callback style (equivalent)
insomnia.sendRequest(
  { url: 'https://example.com', method: 'GET' },
  (err, resp) => {
    if (err) throw err;
    console.log(resp.code); // numeric status
    console.log(resp.json()); // parsed body
    console.log(resp.text()); // raw string
    console.log(resp.headers); // response headers
  },
);

// URL string shorthand
const resp2 = await insomnia.sendRequest('https://example.com');
```

## Folder-Level Scripts

Both pre-request and after-response scripts can be placed on **request groups (folders)**.

**Execution order** — ancestor scripts run BEFORE the request's own script:

```
Outermost Folder pre-request
  → Inner Folder pre-request
    → Request pre-request
      → [HTTP request sent]
Outermost Folder after-response
  → Inner Folder after-response
    → Request after-response
```

Folder environment mutations made in scripts are persisted back to the request group. Use `insomnia.parentFolders` to read ancestor folder environments from within a request's script.

## Testing Assertions

Use `insomnia.test()` and `insomnia.expect()` (Chai-style) in after-response scripts:

```javascript
// Status check — use .code for numeric comparisons
insomnia.test('Status is 200', () => {
  insomnia.expect(insomnia.response.code).to.equal(200);
});

// Response body validation
insomnia.test('Response has user id', () => {
  const body = insomnia.response.json();
  insomnia.expect(body).to.have.property('id');
  insomnia.expect(body.id).to.be.a('string');
});

// Response time SLA
insomnia.test('Response under 500ms', () => {
  insomnia.expect(insomnia.response.responseTime).to.be.below(500);
});

// Header check — use HeaderList methods, NOT .find()
insomnia.test('Content-Type is JSON', () => {
  const ct = insomnia.response.headers.get('Content-Type');
  insomnia.expect(ct).to.include('application/json');
});

// Array response
insomnia.test('Response is a non-empty array', () => {
  const body = insomnia.response.json();
  insomnia.expect(body).to.be.an('array').with.length.above(0);
});

// Nested object
insomnia.test('Response has expected structure', () => {
  const body = insomnia.response.json();
  insomnia.expect(body).to.have.property('data').that.is.an('array');
});

// Exact value
insomnia.test('User email matches', () => {
  insomnia.expect(insomnia.response.json().email).to.eql('user@example.com');
});

// Multiple assertions
insomnia.test('Pagination metadata is valid', () => {
  const body = insomnia.response.json();
  insomnia.expect(body).to.have.all.keys('data', 'total', 'page', 'per_page');
  insomnia.expect(body.page).to.be.a('number');
  insomnia.expect(body.total).to.be.at.least(0);
});

// Skipped test
insomnia.test.skip('flaky test', () => {
  /* ... */
});
```

## Running Tests

### Individual Request Execution

Send a single request normally. Its after-response script runs automatically and assertion results appear in the **Tests** tab of the response pane.

### Collection Runner

1. Open the collection → click the collection name → **Run Collection**
2. Use the **Request Order** tab to drag-and-drop requests into sequence — order matters for data dependencies
3. Configure **Iterations** (run N times) and **Delay** (ms between requests; applied before every request including the first)
4. Click **Run** — after-response scripts execute on each request
5. Results appear in the **Console** tab

**Runner internals:**

- `transientVariables` is created once and shared across all requests and iterations in the run
- `--bail` stops the runner on first thrown error
- `setNextRequest` controls branching and looping (see Execution section)
- Iteration data wraps around when rows are exhausted

### Request Ordering and Data Flow

```javascript
// After-response script on "POST /users" (runs first)
insomnia.test('User created', () => {
  insomnia.expect(insomnia.response.code).to.equal(201);
});
insomnia.environment.set('user_id', insomnia.response.json().id);
```

```javascript
// After-response script on "GET /users/{{ user_id }}" (runs second)
insomnia.test('Created user can be fetched', () => {
  insomnia.expect(insomnia.response.code).to.equal(200);
  insomnia
    .expect(insomnia.response.json().id)
    .to.eql(insomnia.environment.get('user_id'));
});
```

### CI Execution

Use `inso run collection` to execute the full collection with all scripts and assertions. Pass `--bail` to stop on first failure. See `references/cli.md` for full options.

## Available Libraries

Libraries available via `require()` in scripts:

| Library                                      | Actual Package        | Version     | Notes                                                                                                                         |
| -------------------------------------------- | --------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ajv`                                        | ajv                   | 8.12.0      | JSON Schema validation                                                                                                        |
| `atob` / `btoa`                              | pseudo-modules        | —           | Base64 encode/decode                                                                                                          |
| `chai`                                       | chai                  | 4.3.4       | Also available as `insomnia.expect`                                                                                           |
| `cheerio`                                    | cheerio               | 1.0.0-rc.12 | HTML parsing                                                                                                                  |
| `crypto-js`                                  | crypto-js             | 4.2.0       | HMAC, SHA, AES, etc.                                                                                                          |
| `csv-parse`                                  | csv-parse/lib/sync    | 5.5.5       | **Sync API only** — `require('csv-parse/lib/sync')`                                                                           |
| `lodash`                                     | **es-toolkit/compat** | 1.39.8      | NOT actual lodash — API-compatible shim                                                                                       |
| `moment`                                     | moment                | 2.30.1      | Date/time formatting                                                                                                          |
| `tv4`                                        | tv4                   | 1.3.0       | JSON Schema v4 validation                                                                                                     |
| `uuid`                                       | uuid                  | 9.0.1       | UUID generation                                                                                                               |
| `xml2js`                                     | xml2js                | 0.6.2       | XML parsing                                                                                                                   |
| Node built-ins                               | —                     | —           | `path`, `assert`, `url`, `punycode`, `querystring`, `string_decoder`, `stream`, `events`; `buffer`/`util`/`timers` restricted |
| `insomnia-collection` / `postman-collection` | local                 | —           | Collection model (same module)                                                                                                |

```javascript
// HMAC signature in pre-request script
const CryptoJS = require('crypto-js');
const timestamp = Date.now().toString();
const secret = await insomnia.vault.get('SIGNING_SECRET');
const signature = CryptoJS.HmacSHA256(timestamp, secret).toString();
insomnia.request.addHeader({ key: 'X-Timestamp', value: timestamp });
insomnia.request.addHeader({ key: 'X-Signature', value: signature });

// csv-parse — must use the /lib/sync path
const parse = require('csv-parse/lib/sync');
const records = parse(csvString, { columns: true });

// lodash (es-toolkit/compat)
const _ = require('lodash'); // or use the global _
const grouped = _.groupBy(items, 'category');

// uuid
const { v4: uuidv4 } = require('uuid');
insomnia.request.addHeader({ key: 'X-Request-Id', value: uuidv4() });
```

## Common Patterns

### Token Extraction and Refresh

```javascript
// After-response script on "POST /auth/token"
const body = insomnia.response.json();
insomnia.environment.set('access_token', body.access_token);
insomnia.environment.set('token_expiry', Date.now() + body.expires_in * 1000);
```

```javascript
// Pre-request script on protected requests — auto-refresh if expired
const expiry = insomnia.environment.get('token_expiry');
if (!expiry || Date.now() > expiry) {
  const resp = await insomnia.sendRequest({
    url: insomnia.environment.get('base_url') + '/auth/token',
    method: 'POST',
    body: {
      mode: 'urlencoded',
      urlencoded: [{ key: 'grant_type', value: 'client_credentials' }],
    },
  });
  insomnia.environment.set('access_token', resp.json().access_token);
  insomnia.environment.set(
    'token_expiry',
    Date.now() + resp.json().expires_in * 1000,
  );
}
```

### Dynamic Pagination

```javascript
// After-response script on a paginated list endpoint
const body = insomnia.response.json();
if (body.next_cursor) {
  insomnia.environment.set('cursor', body.next_cursor);
} else {
  // stop the runner — no more pages
  insomnia.execution.setNextRequest('');
}
```

### Conditional Request Skipping

```javascript
// Pre-request: skip if feature flag is off
const flag = insomnia.environment.get('run_cleanup');
if (!flag) {
  insomnia.execution.skipRequest();
}
```

## Migrating from Deprecated Unit Tests

Unit test suites (Collection Tests tab) are deprecated. **Never use the deprecated syntax for new code** — always use after-response scripts.

```javascript
// Before — unit test (DEPRECATED, Tests tab)
// response.status was the deprecated numeric status accessor (e.g. 200)
const response = await insomnia.send();
expect(response.status).to.equal(200); // .status = numeric in old API

// After — after-response script (correct)
insomnia.test('Status is 200', () => {
  insomnia.expect(insomnia.response.code).to.equal(200); // .code (numeric), not .status
});
```

**Critical:** After-response scripts run automatically when the request is executed. They cannot reference `insomnia.send()` — the response is already available as `insomnia.response`. The deprecated patterns (`insomnia.send()`, bare `expect()`, `JSON.parse(response.data)`) still appear in some Kong how-to guides but must not be used.

See also `references/environments.md` for how scripts interact with the environment scoping system. See also `references/cli.md` for running scripts in CI via `inso run collection`.
