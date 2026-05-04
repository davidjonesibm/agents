# Scripting

Pre-request and after-response scripts in Insomnia 12.5+: the full `insomnia.*` API surface, available libraries, common patterns, testing assertions, and migration from deprecated unit tests.

## Script Types

| Script             | When it runs                   | Common use                                              |
| ------------------ | ------------------------------ | ------------------------------------------------------- |
| **Pre-request**    | Before the request is sent     | Set dynamic headers, compute signatures, refresh tokens |
| **After-response** | After the response is received | Extract tokens, run assertions, chain requests          |

Scripts are JavaScript (async/await supported). Each script runs in a sandboxed Node-like environment.

## `insomnia` API Reference

### Environment

```javascript
// Set / get / unset collection-level environment variable
insomnia.environment.set('token', 'abc123');
const token = insomnia.environment.get('token');
insomnia.environment.unset('token');

// Set / get base environment variable (persists across sub-env switches)
insomnia.baseEnvironment.set('base_url', 'https://api.example.com');
const url = insomnia.baseEnvironment.get('base_url');

// Set / get collection-scoped variable (alias for environment in most cases)
insomnia.collectionVariables.set('page', 1);

// Set / get a variable that exists only for the current script execution
insomnia.variables.set('temp', 'value');
const temp = insomnia.variables.get('temp');
```

### Request (pre-request scripts only)

```javascript
// Read request properties
const method = insomnia.request.method; // 'GET', 'POST', etc.
const url = insomnia.request.url;

// Add query params
insomnia.request.url.addQueryParams([{ key: 'page', value: '1' }]);

// Add / remove headers
insomnia.request.addHeader({ key: 'X-Trace-Id', value: 'abc' });
insomnia.request.removeHeader('X-Trace-Id');

// Update body (JSON example)
insomnia.request.body.update({
  mimeType: 'application/json',
  text: JSON.stringify({ key: 'val' }),
});

// Update auth
insomnia.request.auth.update({
  type: 'bearer',
  bearer: [{ key: 'token', value: myToken }],
});
```

### Response (after-response scripts only)

```javascript
// Status properties
const status = insomnia.response.status; // 'OK'
const code = insomnia.response.code; // 200
const time = insomnia.response.responseTime; // ms

// Body
const body = insomnia.response.json(); // parsed JSON
const text = insomnia.response.text(); // raw string

// Headers and cookies
const contentType = insomnia.response.headers.find(
  (h) => h.key === 'Content-Type',
);
const sessionCookie = insomnia.response.cookies.find(
  (c) => c.name === 'session',
);
```

### Vault

```javascript
// Read a Vault secret by display name (requires Settings → Enable Vault)
const secret = await insomnia.vault.get('MY_API_KEY');
```

### Iteration Data (Collection Runner)

```javascript
const username = insomnia.iterationData.get('username');
```

### Sending Requests from Scripts

```javascript
// Chain a request from within a script
const response = await insomnia.sendRequest({
  url: 'https://auth.example.com/token',
  method: 'POST',
  headers: [
    { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
  ],
  body: {
    mimeType: 'application/x-www-form-urlencoded',
    params: [
      { name: 'grant_type', value: 'client_credentials' },
      { name: 'client_id', value: insomnia.environment.get('client_id') },
      {
        name: 'client_secret',
        value: insomnia.environment.get('client_secret'),
      },
    ],
  },
});
insomnia.environment.set('access_token', response.json().access_token);
```

## Testing Assertions

Use `insomnia.test()` and `insomnia.expect()` (Chai-style) in after-response scripts:

```javascript
// Basic status check
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
```

## Available Libraries

These libraries are available globally in scripts without `require()`:

| Library         | Usage                                                    |
| --------------- | -------------------------------------------------------- |
| `ajv`           | JSON Schema validation                                   |
| `atob` / `btoa` | Base64 encode/decode                                     |
| `chai`          | Assertion library (also available via `insomnia.expect`) |
| `cheerio`       | HTML parsing                                             |
| `crypto-js`     | Cryptographic functions (HMAC, SHA, AES)                 |
| `csv-parse`     | CSV parsing                                              |
| `lodash`        | Utility functions                                        |
| `moment`        | Date/time formatting                                     |
| `tv4`           | JSON Schema v4 validation                                |
| `uuid`          | UUID generation                                          |
| `xml2js`        | XML parsing                                              |
| Node built-ins  | `Buffer`, `URL`, `querystring`, etc.                     |

```javascript
// Example: HMAC signature in pre-request script
const timestamp = Date.now().toString();
const secret = await insomnia.vault.get('SIGNING_SECRET');
const signature = CryptoJS.HmacSHA256(timestamp, secret).toString();
insomnia.request.addHeader({ key: 'X-Timestamp', value: timestamp });
insomnia.request.addHeader({ key: 'X-Signature', value: signature });
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
    // ...
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
}
```

## Migrating from Deprecated Unit Tests

Unit test suites (Collection Tests tab) are planned for deprecation. Migrate to after-response scripts:

```javascript
// Before — unit test (DEPRECATED, Tests tab)
const response = await insomnia.send();
expect(response.status).to.equal(200);

// After — after-response script (recommended)
insomnia.test('Status is 200', () => {
  insomnia.expect(insomnia.response.code).to.equal(200);
});
```

**Critical:** After-response scripts run automatically when the request is executed. They cannot reference `insomnia.send()` — the response is already available as `insomnia.response`.

See also `references/environments.md` for how scripts interact with the environment scoping system. See also `references/cli.md` for running scripts in CI via `inso run collection`.
