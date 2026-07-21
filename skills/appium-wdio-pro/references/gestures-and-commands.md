# Gestures and Mobile Commands

How to perform touch gestures and use mobile-specific driver commands with WDIO v9 + Appium 3.x.

## W3C Actions API (Required)

WDIO v9 deprecates `touchPerform` / `multiTouchPerform`. Use the W3C Actions API exclusively.

### Tap at Coordinates

```typescript
await browser
  .action('pointer', { parameters: { pointerType: 'touch' } })
  .move({ x: 200, y: 400 })
  .down()
  .up()
  .perform();
```

### Swipe / Scroll

```typescript
// Swipe UP (scroll down to reveal more content)
async function swipeUp() {
  const { width, height } = await browser.getWindowSize();
  const startX = Math.floor(width / 2);
  const startY = Math.floor(height * 0.8);
  const endY = Math.floor(height * 0.2);

  await browser
    .action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: startX, y: startY })
    .down()
    .move({ x: startX, y: endY, duration: 800 })
    .up()
    .perform();
}

// Swipe DOWN (scroll up)
async function swipeDown() {
  const { width, height } = await browser.getWindowSize();
  const startX = Math.floor(width / 2);
  const startY = Math.floor(height * 0.2);
  const endY = Math.floor(height * 0.8);

  await browser
    .action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: startX, y: startY })
    .down()
    .move({ x: startX, y: endY, duration: 800 })
    .up()
    .perform();
}

// Swipe LEFT (e.g., carousel)
async function swipeLeft() {
  const { width, height } = await browser.getWindowSize();
  const startX = Math.floor(width * 0.8);
  const endX = Math.floor(width * 0.2);
  const y = Math.floor(height / 2);

  await browser
    .action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: startX, y })
    .down()
    .move({ x: endX, y, duration: 800 })
    .up()
    .perform();
}
```

### Long Press

```typescript
async function longPress(x: number, y: number, durationMs = 2000) {
  await browser
    .action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x, y })
    .down()
    .pause(durationMs)
    .up()
    .perform();
}

// Long press on an element
async function longPressElement(selector: string) {
  const el = await $(selector);
  await el.waitForDisplayed();
  const { x, y } = await el.getLocation();
  const { width, height } = await el.getSize();
  await longPress(x + width / 2, y + height / 2);
}
```

### Double Tap

```typescript
async function doubleTap(x: number, y: number) {
  await browser
    .action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x, y })
    .down()
    .up()
    .pause(100)
    .down()
    .up()
    .perform();
}
```

### Pinch / Zoom (Multi-Touch)

```typescript
// Pinch to zoom out
async function pinch() {
  const { width, height } = await browser.getWindowSize();
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  await browser.actions([
    browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: centerX - 100, y: centerY })
      .down()
      .move({ x: centerX - 10, y: centerY, duration: 500 })
      .up(),
    browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: centerX + 100, y: centerY })
      .down()
      .move({ x: centerX + 10, y: centerY, duration: 500 })
      .up(),
  ]);
}

// Zoom in (spread fingers)
async function zoom() {
  const { width, height } = await browser.getWindowSize();
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  await browser.actions([
    browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: centerX - 10, y: centerY })
      .down()
      .move({ x: centerX - 150, y: centerY, duration: 500 })
      .up(),
    browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: centerX + 10, y: centerY })
      .down()
      .move({ x: centerX + 150, y: centerY, duration: 500 })
      .up(),
  ]);
}
```

## Scroll to Element

```typescript
// Generic scroll-to-find helper
async function scrollToElement(
  selector: string,
  maxScrolls = 5,
  direction: 'up' | 'down' = 'down',
): Promise<void> {
  for (let i = 0; i < maxScrolls; i++) {
    const el = await $(selector);
    if (await el.isDisplayed()) return;

    const { width, height } = await browser.getWindowSize();
    const centerX = Math.floor(width / 2);
    const startY =
      direction === 'down'
        ? Math.floor(height * 0.8)
        : Math.floor(height * 0.2);
    const endY =
      direction === 'down'
        ? Math.floor(height * 0.2)
        : Math.floor(height * 0.8);

    await browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: centerX, y: startY })
      .down()
      .move({ x: centerX, y: endY, duration: 500 })
      .up()
      .perform();
  }
  throw new Error(`Element ${selector} not found after ${maxScrolls} scrolls`);
}
```

### Android UiScrollable (Faster)

On Android, prefer `UiScrollable` — it uses the native scroll mechanism and is significantly faster:

```typescript
// Android only — scrolls until element found
const el = await $(
  'android=new UiScrollable(new UiSelector().scrollable(true))' +
    '.scrollIntoView(new UiSelector().text("Terms and Conditions"))',
);
```

## Device / App Lifecycle Commands

```typescript
// Keyboard
await driver.hideKeyboard();
const isShown = await driver.isKeyboardShown();

// Lock / unlock
await driver.lock(); // lock screen
await driver.unlock(); // unlock

// App lifecycle
await driver.activateApp('com.example.myapp');
await driver.terminateApp('com.example.myapp');
const state = await driver.queryAppState('com.example.myapp');
// State values: 0=not installed, 1=not running, 2=bg suspended, 3=bg, 4=foreground

// Background the app
await driver.background(5); // put in background for 5 seconds

// Orientation
await driver.setOrientation('LANDSCAPE');
await driver.setOrientation('PORTRAIT');
const orientation = await driver.getOrientation();

// Geolocation (emulators/simulators)
await driver.setGeoLocation({
  latitude: 37.7749,
  longitude: -122.4194,
  altitude: 0,
});

// Clipboard
await driver.setClipboard(
  Buffer.from('hello world').toString('base64'),
  'plaintext',
);

// Screenshot
const base64Screenshot = await browser.takeScreenshot();

// Screen recording (video)
await driver.startRecordingScreen();
// ... run test ...
const base64Video = await driver.stopRecordingScreen();
```

## Gesture Helper Module

Consolidate all gesture utilities into a single importable module:

```typescript
// test/helpers/gestures.ts
export async function swipeUp(duration = 800) {
  /* ... */
}
export async function swipeDown(duration = 800) {
  /* ... */
}
export async function swipeLeft(duration = 800) {
  /* ... */
}
export async function swipeRight(duration = 800) {
  /* ... */
}
export async function longPressElement(selector: string, ms?: number) {
  /* ... */
}
export async function scrollToElement(selector: string, maxScrolls?: number) {
  /* ... */
}
export async function doubleTapElement(selector: string) {
  /* ... */
}
```

Import in page objects and specs — never duplicate gesture code.

## Common Gesture Mistakes

| Mistake                            | Why It Breaks                                           | Fix                                  |
| ---------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| Using `touchPerform`               | Deprecated in WDIO v9                                   | Use `browser.action('pointer', ...)` |
| Swipe `duration` too short         | Gesture ignored or interpreted as tap                   | Use 500-1000ms                       |
| Swipe start/end too close to edge  | OS intercepts the gesture (notification shade, nav bar) | Use 20-80% of screen dimensions      |
| Missing `{ pointerType: 'touch' }` | Defaults to mouse pointer — wrong for mobile            | Always specify `'touch'`             |
| Not calling `.perform()`           | Actions queued but never executed                       | Always end chain with `.perform()`   |

## Cross-Reference

- For element selector strategies, see `references/selectors-and-patterns.md`.
- For debugging gesture failures, see `references/debugging.md`.
