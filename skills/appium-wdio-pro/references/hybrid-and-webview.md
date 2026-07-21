# Hybrid Apps and WebView Testing

How to test apps that embed web content (WebViews) alongside native UI.

## How Contexts Work

Appium sessions have one or more "contexts":

- `NATIVE_APP` — the default context for interacting with native UI elements
- `WEBVIEW_<package>` — one context per active WebView, named after the app package/bundle

When in native context, you use mobile selectors (accessibility ID, UiAutomator, etc.). When in a WebView context, you use web selectors (CSS, XPath on DOM elements). **You must switch contexts to interact with the correct layer.**

## Context Switching (WDIO v9)

```typescript
// Get all available contexts
const contexts = await driver.getAppiumContexts();
// Returns: ['NATIVE_APP', 'WEBVIEW_com.example.myapp']

// Switch to WebView
const webviewContext = contexts.find((c) => c.includes('WEBVIEW'));
if (webviewContext) {
  await driver.switchAppiumContext(webviewContext);
}

// Now use web selectors (CSS selectors, standard DOM)
const heading = await $('h1.title');
const email = await $('input[type="email"]');

// Switch back to native
await driver.switchAppiumContext('NATIVE_APP');
```

**WDIO v9 API change:** Use `driver.getAppiumContexts()` / `driver.switchAppiumContext()`. The legacy `getContexts()` / `setContext()` are deprecated.

## Wait for WebView Context

WebViews don't appear instantly — always wait:

```typescript
async function switchToWebView(timeout = 15_000): Promise<void> {
  await browser.waitUntil(
    async () => {
      const contexts = await driver.getAppiumContexts();
      return contexts.some((c) => c.includes('WEBVIEW'));
    },
    {
      timeout,
      timeoutMsg: `No WEBVIEW context found after ${timeout}ms`,
      interval: 1_000,
    },
  );

  const contexts = await driver.getAppiumContexts();
  const webview = contexts.find((c) => c.includes('WEBVIEW'))!;
  await driver.switchAppiumContext(webview);
}

async function switchToNative(): Promise<void> {
  await driver.switchAppiumContext('NATIVE_APP');
}
```

## Full Hybrid Test Example

```typescript
describe('Hybrid App', () => {
  it('should interact with WebView content', async () => {
    // 1. Tap native button that opens a WebView screen
    const openWebBtn = await $('~open-webview');
    await openWebBtn.waitForDisplayed();
    await openWebBtn.click();

    // 2. Wait for and switch to WebView context
    await switchToWebView();

    // 3. Interact with web elements using CSS selectors
    const emailInput = await $('input#email');
    await emailInput.waitForDisplayed();
    await emailInput.setValue('user@example.com');

    const submitBtn = await $('button[type="submit"]');
    await submitBtn.click();

    // 4. Switch back to native to verify result
    await switchToNative();

    const successMsg = await $('~success-message');
    await expect(successMsg).toBeDisplayed();
    await expect(successMsg).toHaveText('Form submitted');
  });
});
```

## Enabling WebView Debugging

WebView inspection requires debugging to be enabled in the app:

### Android

The app must call `WebView.setWebContentsDebuggingEnabled(true)` — this is typically done in debug builds. Production builds often disable this. Ask the dev team to enable it in test builds.

Set capability to enable Chrome DevTools:

```typescript
capabilities: [
  {
    // ... other caps
    'appium:chromeOptions': {
      w3c: true,
    },
    'appium:showChromedriverLog': true,
  },
];
```

### iOS

For iOS simulators, Safari's WebView debugging works automatically. For real devices:

```bash
# Install the proxy
brew install ios-webkit-debug-proxy

# Start it
ios_webkit_debug_proxy -c <udid>:27753 -d
```

Set capability:

```typescript
capabilities: [
  {
    // ... other caps
    'appium:webviewConnectTimeout': 10_000,
    'appium:includeSafariInWebviews': true,
    'appium:fullContextList': true, // returns detailed context info
  },
];
```

## Multiple WebViews

Some apps have multiple WebViews. Use `fullContextList` to distinguish:

```typescript
// Enable detailed context info
// Capability: 'appium:fullContextList': true

const contexts = await driver.getAppiumContexts();
// With fullContextList, contexts include page details
// Switch to the one you need based on URL or title
```

## Context Helper Module

```typescript
// test/helpers/contexts.ts
export async function switchToWebView(timeout = 15_000): Promise<void> {
  await browser.waitUntil(
    async () => {
      const contexts = await driver.getAppiumContexts();
      return contexts.some((c) => c.includes('WEBVIEW'));
    },
    { timeout, timeoutMsg: 'WEBVIEW context not found', interval: 1_000 },
  );

  const contexts = await driver.getAppiumContexts();
  await driver.switchAppiumContext(
    contexts.find((c) => c.includes('WEBVIEW'))!,
  );
}

export async function switchToNative(): Promise<void> {
  await driver.switchAppiumContext('NATIVE_APP');
}

export async function getCurrentContext(): Promise<string> {
  const contexts = await driver.getAppiumContexts();
  // The first in the list is typically the active one
  return contexts[0];
}

export async function getAvailableContexts(): Promise<string[]> {
  return driver.getAppiumContexts();
}
```

## Common WebView Problems

| Problem                                 | Cause                                | Fix                                                                                 |
| --------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| `WEBVIEW` context never appears         | Debugging not enabled in app         | Ask dev team to set `WebView.setWebContentsDebuggingEnabled(true)`                  |
| Context appears then disappears         | WebView navigated away or closed     | Wait for stable context before switching                                            |
| Elements not found after context switch | Page hasn't loaded in WebView yet    | Add `waitForDisplayed` after switching context                                      |
| `chrome not reachable` on Android       | Chromedriver version mismatch        | Match Chromedriver version to device Chrome version (see `references/debugging.md`) |
| CSS selectors fail on iOS WebView       | Safari WebView uses different engine | Verify using Safari DevTools; some selectors behave differently                     |
| `Cannot call non W3C standard command`  | Using old context APIs               | Use `getAppiumContexts()` / `switchAppiumContext()`                                 |

## Cross-Reference

- For native element selectors, see `references/selectors-and-patterns.md`.
- For debugging WebView issues, see `references/debugging.md`.
