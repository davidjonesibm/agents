# Element Selectors and Patterns

Best practices for locating elements and structuring test code with the Page Object Model in Appium/WDIO.

## Selector Strategy Priority

Use the highest-priority selector that works. Each step down is slower and more brittle.

| Priority | Strategy             | Syntax                                          | Speed    | Cross-Platform    |
| -------- | -------------------- | ----------------------------------------------- | -------- | ----------------- |
| 1        | Accessibility ID     | `$('~myId')`                                    | Fast     | Yes               |
| 2        | Android UiAutomator  | `$('android=new UiSelector()...')`              | Fast     | Android only      |
| 2        | iOS Predicate String | `$('-ios predicate string:...')`                | Fast     | iOS only          |
| 2        | iOS Class Chain      | `$('-ios class chain:...')`                     | Fast     | iOS only          |
| 3        | Resource ID          | `$('id=com.app:id/name')`                       | Medium   | Android only      |
| 4        | Class Name           | `$('android.widget.Button')`                    | Medium   | Platform-specific |
| 5        | XPath                | `$('//android.widget.TextView[@text="Login"]')` | **Slow** | Avoid             |

### Accessibility ID (Recommended)

```typescript
// Best — works on both platforms, fast, stable
const loginBtn = await $('~login-button');
const emailField = await $('~email-input');
```

**Requires** the app to set accessibility identifiers:

- **Android**: `android:contentDescription="login-button"` or `ViewCompat.setAccessibilityDelegate`
- **iOS**: `accessibilityIdentifier = "login-button"` (SwiftUI: `.accessibilityIdentifier("login-button")`)
- **React Native**: `testID="login-button"` (maps to both platforms)
- **Flutter**: `Semantics(identifier: 'login-button')` or `Key('login-button')`

### Android UiAutomator

```typescript
// By text
const el = await $('android=new UiSelector().text("Sign In")');

// By text + class
const el = await $(
  'android=new UiSelector().text("Sign In").className("android.widget.Button")',
);

// By description
const el = await $('android=new UiSelector().description("menu icon")');

// Scrollable — scroll to find element (powerful!)
const el = await $(
  'android=new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().text("Terms"))',
);
```

### iOS Predicate String

```typescript
// By name
const el = await $('-ios predicate string:name == "Sign In"');

// By type + name
const el = await $(
  `-ios predicate string:type == 'XCUIElementTypeButton' AND name CONTAINS 'Sign'`,
);

// By label (visible text)
const el = await $('-ios predicate string:label BEGINSWITH "Welcome"');
```

### iOS Class Chain

```typescript
// Direct child
const el = await $(
  '-ios class chain:**/XCUIElementTypeButton[`name == "Sign In"`]',
);

// Nested chain
const el = await $(
  `-ios class chain:**/XCUIElementTypeCell[\`name BEGINSWITH "Item"\`]/**/XCUIElementTypeButton`,
);
```

### XPath (Last Resort)

```typescript
// BAD — slow, brittle, breaks easily
const el = await $('//android.widget.LinearLayout/android.widget.Button[2]');

// Less bad — at least uses attribute matching
const el = await $('//android.widget.TextView[@text="Welcome"]');
```

**Why XPath is bad on mobile:**

- Full page source must be computed (expensive on mobile)
- No index stability — changes when UI changes
- Significantly slower than native strategies (3-10x)
- Different syntax needed per platform

## Page Object Model

### Base Page

```typescript
// test/pageobjects/base.page.ts
export default class BasePage {
  async waitAndTap(selector: string, timeout = 10_000) {
    const el = await $(selector);
    await el.waitForDisplayed({ timeout });
    await el.click();
  }

  async waitAndType(selector: string, value: string, timeout = 10_000) {
    const el = await $(selector);
    await el.waitForDisplayed({ timeout });
    await el.clearValue();
    await el.setValue(value);
  }

  async isDisplayed(selector: string, timeout = 5_000): Promise<boolean> {
    try {
      const el = await $(selector);
      await el.waitForDisplayed({ timeout });
      return true;
    } catch {
      return false;
    }
  }

  async getText(selector: string, timeout = 10_000): Promise<string> {
    const el = await $(selector);
    await el.waitForDisplayed({ timeout });
    return el.getText();
  }
}
```

### Feature Page

```typescript
// test/pageobjects/login.page.ts
import BasePage from './base.page.js';

class LoginPage extends BasePage {
  // Selectors — single source of truth
  get usernameField() {
    return $('~username-input');
  }
  get passwordField() {
    return $('~password-input');
  }
  get loginButton() {
    return $('~login-button');
  }
  get errorMessage() {
    return $('~error-message');
  }

  async login(username: string, password: string) {
    await this.usernameField.waitForDisplayed();
    await this.usernameField.setValue(username);
    await this.passwordField.setValue(password);
    await this.loginButton.click();
  }

  async getError(): Promise<string> {
    await this.errorMessage.waitForDisplayed();
    return this.errorMessage.getText();
  }
}

export default new LoginPage();
```

### Spec File

```typescript
// test/specs/login/login.spec.ts
import LoginPage from '../../pageobjects/login.page.js';

describe('Login', () => {
  it('should show error with invalid credentials', async () => {
    await LoginPage.login('bad_user', 'bad_pass');
    await expect(LoginPage.errorMessage).toHaveText('Invalid credentials');
  });

  it('should navigate to home on valid login', async () => {
    await LoginPage.login('valid_user', 'valid_pass');
    // Assert navigation to home page
    const homeTitle = await $('~home-title');
    await expect(homeTitle).toBeDisplayed();
  });
});
```

## Platform-Specific Selectors Pattern

When accessibility IDs aren't available, use platform-branching:

```typescript
// test/helpers/selectors.ts
const isAndroid = driver.isAndroid;

export const selectors = {
  loginButton: isAndroid
    ? 'android=new UiSelector().text("Sign In")'
    : '-ios predicate string:name == "Sign In"',

  emailField: isAndroid
    ? 'android=new UiSelector().resourceId("com.app:id/email")'
    : '-ios predicate string:name == "email-field"',
} as const;
```

```typescript
// In Page Object — prefer over inline branching
import { selectors } from '../helpers/selectors.js';

class LoginPage extends BasePage {
  get loginButton() {
    return $(selectors.loginButton);
  }
  get emailField() {
    return $(selectors.emailField);
  }
}
```

## Wait Strategies

### Explicit Waits (Correct)

```typescript
// Wait for visibility
const el = await $('~submit');
await el.waitForDisplayed({ timeout: 15_000 });

// Wait for clickability
await el.waitForEnabled({ timeout: 10_000 });

// Wait for existence in DOM (even if not visible)
await el.waitForExist({ timeout: 10_000 });

// Wait for element to disappear
await el.waitForDisplayed({ timeout: 10_000, reverse: true });

// Custom condition
await browser.waitUntil(
  async () => (await $('~loading').isDisplayed()) === false,
  {
    timeout: 30_000,
    timeoutMsg: 'Loading spinner still visible after 30s',
    interval: 1_000,
  },
);
```

### Anti-Patterns

```typescript
// BAD — hardcoded delay, hides real timing issues
await browser.pause(3000);
await $('~submit').click();

// GOOD — explicit wait
const submit = await $('~submit');
await submit.waitForDisplayed({ timeout: 10_000 });
await submit.click();

// BAD — no wait, element might not be ready
await $('~submit').click();

// GOOD — getter with built-in wait
const el = await $('~submit');
await el.waitForDisplayed();
await el.click();
```

## Working with Element Collections

```typescript
// Get all list items
const items = await $$('~list-item');

// Get count
const count = items.length;

// Iterate
for (const item of items) {
  const text = await item.getText();
  console.log(text);
}

// Find specific element in collection
const target = await items.find(
  async (item) => (await item.getText()) === 'Settings',
);
if (target) await target.click();
```

## Cross-Reference

- For scrolling to find elements, see `references/gestures-and-commands.md`.
- For WebView-specific selectors (CSS, DOM), see `references/hybrid-and-webview.md`.
