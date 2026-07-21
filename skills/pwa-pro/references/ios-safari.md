# iOS Safari PWA Quirks

Rules for iOS Safari PWA limitations, workarounds, required meta tags, and platform-specific behavior. These quirks apply to Safari on iOS and iPadOS.

## Feature Support Matrix

| Feature                     | iOS Status                                                    |
| --------------------------- | ------------------------------------------------------------- |
| Push Notifications          | iOS 16.4+ — installed home screen apps only, NOT browser tabs |
| `beforeinstallprompt`       | Not supported — must guide users manually                     |
| Background Sync API         | Not supported                                                 |
| Manifest icons              | Ignored — use `<link rel="apple-touch-icon">`                 |
| Manifest `background_color` | Ignored — use `apple-touch-startup-image`                     |
| `display: fullscreen`       | Falls back to `standalone`                                    |
| `display: minimal-ui`       | Falls back to browser shortcut (not standalone!)              |
| Navigation Preload          | Not supported                                                 |
| Periodic Background Sync    | Not supported                                                 |
| Badging API                 | Not supported                                                 |
| App Shortcuts               | Not supported (manifest `shortcuts` ignored)                  |
| Multiple installs           | Allowed — each has isolated storage                           |
| `navigator.standalone`      | Supported — detects if running as installed PWA               |

## Required `<head>` Tags

- Always include `apple-touch-icon` — iOS Safari ignores manifest icons entirely.

  ```html
  <!-- Before — no icon on iOS home screen (uses screenshot instead) -->
  <!-- only manifest icons defined -->

  <!-- After — proper iOS icon -->
  <link
    rel="apple-touch-icon"
    sizes="180x180"
    href="/icons/apple-touch-icon.png"
  />
  ```

- Add `apple-mobile-web-app-capable` to enable standalone mode:

  ```html
  <!-- Before — opens as browser tab, not standalone -->
  <!-- (relies on manifest alone) -->

  <!-- After — iOS recognizes it as a web app -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  ```

- Complete required iOS head tags:

  ```html
  <!-- Before — incomplete iOS support -->
  <link rel="manifest" href="/manifest.webmanifest" />

  <!-- After — full iOS PWA support -->
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <link
    rel="apple-touch-icon"
    sizes="180x180"
    href="/icons/apple-touch-icon.png"
  />
  ```

## Status Bar Styles

- `default` — standard status bar (gray background, dark text).
- `black` — black background, light text.
- `black-translucent` — transparent background overlaying your content. Your `[0,0]` pixel is now the physical top-left of the screen.

  ```html
  <!-- Before — default gray status bar with dead space -->
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />

  <!-- After — fullscreen feel with transparent status bar -->
  <meta
    name="apple-mobile-web-app-status-bar-style"
    content="black-translucent"
  />
  ```

  **Warning:** With `black-translucent`, the status bar icons are always white. Ensure your header background contrasts with white text. Also use CSS safe area insets:

  ```css
  /* Before — content hidden behind status bar */
  .header {
    padding-top: 0;
  }

  /* After — respects safe area */
  .header {
    padding-top: env(safe-area-inset-top);
  }

  /* Full safe area support */
  body {
    padding: env(safe-area-inset-top) env(safe-area-inset-right)
      env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  ```

## Splash Screens

- iOS Safari does NOT generate splash screens from manifest values (unlike Android). You must provide `apple-touch-startup-image` links with exact device dimensions.

  ```html
  <!-- Before — white flash while loading on iOS -->
  <!-- (no startup images) -->

  <!-- After — branded splash screen -->
  <link
    rel="apple-touch-startup-image"
    href="/splash/iphone-1170x2532.png"
    media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  />
  <link
    rel="apple-touch-startup-image"
    href="/splash/iphone-1284x2778.png"
    media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  />
  ```

  **Note:** There are 25+ device/orientation/multitask combinations. Use a tool like [pwa-asset-generator](https://github.com/nicedoc/pwa-asset-generator) to automate creation, or use the [PWA Compat](https://github.com/nicedoc/pwacompat) library for client-side generation.

## Installation UX

- iOS has no `beforeinstallprompt` event. Detect iOS and show manual instructions.

  ```typescript
  // Before — install button never appears on iOS
  window.addEventListener('beforeinstallprompt', (e) => {
    showInstallButton();
  });

  // After — detect iOS and show manual guide
  function isIOS(): boolean {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }

  function isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  }

  if (isIOS() && !isStandalone()) {
    showIOSInstallBanner(); // "Tap Share → Add to Home Screen"
  }
  ```

  ```vue
  <!-- iOS install instructions component -->
  <template>
    <div v-if="showIOSGuide" class="alert">
      <p>
        To install: tap
        <span class="icon">⬆️</span> Share then
        <strong>"Add to Home Screen"</strong>
      </p>
      <button @click="showIOSGuide = false">Dismiss</button>
    </div>
  </template>
  ```

## Detecting PWA Mode on iOS

- Use `navigator.standalone` (non-standard, WebKit-only) to detect if the PWA is running from the home screen.

  ```typescript
  // Before — no iOS detection
  const isPWA = window.matchMedia('(display-mode: standalone)').matches;

  // After — handles both Chromium and iOS
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;
  ```

  Values of `navigator.standalone`:
  - `undefined` → not iOS/iPadOS
  - `false` → iOS, running in browser
  - `true` → iOS, running as installed PWA

## Push Notification Workarounds

- Push on iOS requires: iOS 16.4+, installed to home screen, and Permission granted from within the installed app.
- If the user opens your site in Safari (not installed), push subscription will fail silently. Detect and guide:

  ```typescript
  // Before — push subscribe fails silently on iOS Safari
  await registration.pushManager.subscribe(options);

  // After — check platform first
  if (isIOS() && !isStandalone()) {
    showMessage('Install this app to your home screen to enable notifications');
    return;
  }
  await registration.pushManager.subscribe(options);
  ```

## Background Sync Workaround

- iOS does not support the Background Sync API. Implement a manual retry on app resume:

  ```typescript
  // Before — BackgroundSyncPlugin, does nothing on iOS
  const bgSync = new BackgroundSyncPlugin('queue', { maxRetentionTime: 1440 });

  // After — manual retry for iOS alongside BackgroundSync for others
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      await replayPendingMutations(); // read from IndexedDB, POST to server
    }
  });
  ```

## Cookie and Storage Limitations

- iOS Safari may **evict all PWA storage** (IndexedDB, Cache Storage, cookies) after 7 days of inactivity if the user has not installed the PWA.
- Installing the PWA to the home screen makes storage more persistent, but each installation has **isolated storage** — the browser and home screen app do NOT share cookies, IndexedDB, or cache.

  ```typescript
  // Before — assumes shared auth between browser and PWA
  // (user must re-login after install on iOS)

  // After — handle re-authentication gracefully
  // Detect fresh install with no stored session
  const session = await get('auth-session');
  if (!session && isStandalone()) {
    router.push('/login'); // redirect to re-authenticate
  }
  ```

## `theme-color` on iOS

- iOS Safari supports the `theme-color` meta tag (iOS 15+) in Safari browser tabs, but **ignores it in standalone PWA mode**. Use `apple-mobile-web-app-status-bar-style` instead for installed PWAs.

  ```html
  <!-- Both needed for cross-platform support -->
  <meta name="theme-color" content="#570df8" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  ```

## Manifest Loading Reliability

- On iOS < 15.4, the manifest is only fetched when the user opens the Share sheet, not on page load. If the manifest fails to load at that moment, "Add to Home Screen" creates a plain bookmark, not a PWA.
- Ensure your manifest URL is fast and reliable. Avoid redirects on the manifest URL.
