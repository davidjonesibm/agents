# Plugins

Insomnia 12.5+ plugin system: extension points, package.json structure, template tags, hooks, actions, themes, the context API, and publishing to Plugin Hub.

## Plugin Package Structure

Every Insomnia plugin is an npm package with the `insomnia-plugin-` prefix:

```
insomnia-plugin-my-plugin/
├── package.json      # Must declare "insomnia" field
├── index.js          # Entry point — exports extension objects
└── README.md
```

```json
// package.json — required fields
{
  "name": "insomnia-plugin-my-plugin",
  "version": "1.0.0",
  "main": "index.js",
  "insomnia": {
    "name": "My Plugin",
    "description": "Short description for Plugin Hub listing",
    "images": {
      "icon": "icon.svg"
    },
    "unlisted": false
  }
}
```

**Critical:** The package name **must** start with `insomnia-plugin-` to appear on Plugin Hub and be installable by name.

## Plugin Installation Directories

| Platform | Path                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| macOS    | `~/Library/Application Support/Insomnia/plugins/`                              |
| Windows  | `%APPDATA%\Insomnia\plugins\`                                                  |
| Linux    | `$XDG_CONFIG_HOME/Insomnia/plugins/` (fallback: `~/.config/Insomnia/plugins/`) |

For local development, symlink or copy the plugin directory into the plugins folder, then reload plugins in **Settings → Plugins**.

## Extension Points

### `requestHooks` — Modify Requests Before Sending

```javascript
// index.js
module.exports.requestHooks = [
  async (context) => {
    // Add a timestamp header to every request
    context.request.setHeader('X-Request-Time', Date.now().toString());
  },
];
```

### `responseHooks` — Process Responses After Receipt

```javascript
module.exports.responseHooks = [
  async (context) => {
    const status = context.response.getStatusCode();
    if (status >= 500) {
      // Log server errors to a custom store entry
      await context.store.setItem('last_error_status', status.toString());
    }
  },
];
```

### `requestActions` — Add Items to Request Context Menu

```javascript
module.exports.requestActions = [
  {
    label: 'Copy as Fetch',
    action: async (context, { request }) => {
      const fetchCode = `fetch('${request.getUrl()}', { method: '${request.getMethod()}' })`;
      await context.app.clipboard.writeText(fetchCode);
      context.app.alert('Copied!', 'Fetch snippet copied to clipboard.');
    },
  },
];
```

### `requestGroupActions` — Add Items to Folder Context Menu

```javascript
module.exports.requestGroupActions = [
  {
    label: 'Export Folder as cURL',
    action: async (context, { requestGroup, requests }) => {
      // requests is an array of requests in the folder
      const lines = requests.map(
        (r) => `curl -X ${r.getMethod()} '${r.getUrl()}'`,
      );
      await context.app.clipboard.writeText(lines.join('\n'));
    },
  },
];
```

### `workspaceActions` — Add Items to Collection/Document Menu

```javascript
module.exports.workspaceActions = [
  {
    label: 'Generate Mock Data',
    icon: 'fa-magic',
    action: async (context, { workspace, requestGroups, requests }) => {
      // workspace.type === 'collection' | 'design'
      context.app.alert('Done', `Found ${requests.length} requests.`);
    },
  },
];
```

### `documentActions` — Add Items to Design Document Menu

```javascript
module.exports.documentActions = [
  {
    label: 'Validate Schema',
    action: async (context, { apiSpec }) => {
      const spec = apiSpec.contents; // raw OpenAPI YAML/JSON string
      // validate and alert
    },
  },
];
```

### `themes` — Custom Color Themes

```javascript
module.exports.themes = [
  {
    name: 'my-dark-theme',
    displayName: 'My Dark Theme',
    theme: {
      background: { default: '#1a1a2e', success: '#16213e' },
      foreground: { default: '#e0e0e0' },
      highlight: { default: '#0f3460' },
    },
  },
];
```

## Template Tags

Template tags add custom `{{ tag_name }}` interpolation to any value field:

```javascript
module.exports.templateTags = [
  {
    name: 'unixTimestamp',
    displayName: 'Unix Timestamp',
    description: 'Returns current Unix timestamp in seconds',
    args: [],
    async run(context) {
      return Math.floor(Date.now() / 1000);
    },
  },
];
```

Template tag with arguments:

```javascript
module.exports.templateTags = [
  {
    name: 'hmacSha256',
    displayName: 'HMAC SHA-256',
    description: 'Sign a message with HMAC-SHA256',
    args: [
      {
        displayName: 'Message',
        type: 'string',
        placeholder: 'message to sign',
      },
      {
        displayName: 'Secret',
        type: 'string',
        placeholder: 'signing secret',
      },
    ],
    async run(context, message, secret) {
      const CryptoJS = require('crypto-js');
      return CryptoJS.HmacSHA256(message, secret).toString();
    },
  },
];
```

Use in any value field: `{{ hmacSha256 'my-message' 'my-secret' }}`

## Context API

| Object             | Methods                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `context.request`  | `getUrl()`, `setUrl()`, `getMethod()`, `setMethod()`, `getHeaders()`, `setHeader()`, `getHeader()`, `removeHeader()`, `getBody()`, `setBody()`, `getEnvironmentVariable()`, `setEnvironmentVariable()` |
| `context.response` | `getStatusCode()`, `getStatusMessage()`, `getHeader()`, `getHeaders()`, `getBody()`, `setBody()`, `getResponseTime()`                                                                                  |
| `context.app`      | `alert(title, msg)`, `dialog(title, body)`, `clipboard.writeText(text)`, `getExportFormats()`                                                                                                          |
| `context.store`    | `hasItem(key)`, `getItem(key)`, `setItem(key, value)`, `removeItem(key)`, `clear()`, `all()`                                                                                                           |
| `context.data`     | `import(options)`, `export(options)`                                                                                                                                                                   |
| `context.network`  | `sendRequest(request)`                                                                                                                                                                                 |

```javascript
// context.store example — persist data between hook invocations
module.exports.responseHooks = [
  async (context) => {
    const count = parseInt(
      (await context.store.getItem('request_count')) || '0',
      10,
    );
    await context.store.setItem('request_count', (count + 1).toString());
  },
];
```

## Publishing to Plugin Hub

1. Name the package `insomnia-plugin-<your-name>`.
2. Add the `"insomnia"` metadata field to `package.json`.
3. Publish to npm: `npm publish --access public`.
4. Plugin Hub indexes npm packages with the `insomnia-plugin-` prefix automatically.

**Unlisted plugins:** Set `"unlisted": true` in the `"insomnia"` field to publish to npm without appearing in Plugin Hub search.

See also `references/scripting.md` for the `insomnia.*` API available inside collection scripts (distinct from the plugin `context.*` API).
