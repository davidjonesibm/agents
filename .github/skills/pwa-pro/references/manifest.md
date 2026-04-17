# Web App Manifest

Rules for web app manifest configuration, icons, display modes, and installability. Applies to both inline manifests (via vite-plugin-pwa) and standalone `.webmanifest` files.

## Required Fields for Installability

- Chrome requires: `name` (or `short_name`), `icons` (192×192 + 512×512), `start_url`, and `display` (`standalone`, `fullscreen`, or `minimal-ui`).

  ```json
  // Before — missing fields, not installable
  {
    "name": "My App"
  }

  // After — meets Chrome installability criteria
  {
    "name": "My App",
    "short_name": "App",
    "start_url": "/",
    "display": "standalone",
    "icons": [
      { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
  ```

- Always include the `id` field to decouple app identity from `start_url`. Without it, changing `start_url` may cause the browser to treat the app as a new install.

  ```json
  // Before — identity tied to start_url
  {
    "name": "My App",
    "start_url": "/"
  }

  // After — stable identity
  {
    "name": "My App",
    "id": "/",
    "start_url": "/?source=pwa"
  }
  ```

## Icons

- Provide separate icon entries for `"purpose": "any"` and `"purpose": "maskable"`. The combined `"any maskable"` value is deprecated.

  ```json
  // Before — deprecated combined purpose
  {
    "icons": [
      { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
    ]
  }

  // After — separate entries
  {
    "icons": [
      { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
      { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
    ]
  }
  ```

- Maskable icons must keep critical content within the **center 80%** (a circle with 40% radius centered in the image). Test with [maskable.app](https://maskable.app/).

- Use non-transparent backgrounds for icons. iOS, iPadOS, and Android 8+ fill transparency with an uncontrollable background color.

  ```
  // Before — transparent PNG causes white background on iOS
  icon-512.png (transparent background)

  // After — solid background matching theme
  icon-512.png (solid #570df8 background)
  ```

- Minimum recommended icon set: 192×192, 512×512, and 512×512 maskable. Legacy sizes (48, 72, 96, 144, 168) are no longer necessary.

- Generate all icon sizes from a single SVG source using `@vite-pwa/assets-generator`:

  ```bash
  # Before — manually creating multiple icon sizes
  # (error-prone, inconsistent)

  # After — automated generation
  pnpm dlx @vite-pwa/assets-generator --preset minimal-2023 public/logo.svg
  ```

## Display Modes

- Use `standalone` for most apps. It provides a native app-like experience without browser UI.
- Use `minimal-ui` when you want a minimal back/reload button.
- Use `fullscreen` for immersive experiences (games, media players).
- iOS Safari only supports `standalone`. `minimal-ui` falls back to a browser shortcut; `fullscreen` falls back to `standalone`.

  ```json
  // Before — fullscreen on iOS just falls back, confusing
  { "display": "fullscreen" }

  // After — standalone works consistently across platforms
  { "display": "standalone" }
  ```

## Theme and Background Colors

- `theme_color` controls the status bar and title bar color. Match it to your app's primary brand color.
- `background_color` is shown on the Android splash screen. Match it to your app's actual background to prevent a flash of wrong color.

  ```json
  // Before — color flash: white splash → dark app
  {
    "theme_color": "#570df8",
    "background_color": "#ffffff"
  }

  // After — matches dark app background
  {
    "theme_color": "#570df8",
    "background_color": "#1d232a"
  }
  ```

- Use CSS named colors, hex, or `rgb()` — never use transparency (`rgba()`), CSS variables, or gradients in manifest color fields.

- Override manifest `theme_color` per page with a `<meta>` tag. Supports dark mode:

  ```html
  <!-- Before — no dark mode support for theme color -->
  <meta name="theme-color" content="#570df8" />

  <!-- After — adapts to color scheme -->
  <meta
    name="theme-color"
    content="#570df8"
    media="(prefers-color-scheme: light)"
  />
  <meta
    name="theme-color"
    content="#1d232a"
    media="(prefers-color-scheme: dark)"
  />
  ```

## Shortcuts

- Define app shortcuts for quick access to frequently used sections. Order by priority — Chrome on Android shows the first 3, desktop shows up to 10.

  ```json
  // Before — no shortcuts
  { "name": "Chat" }

  // After — quick access to common actions
  {
    "name": "Chat",
    "shortcuts": [
      {
        "name": "New Message",
        "short_name": "New",
        "url": "/compose",
        "icons": [{ "src": "/icons/compose.png", "sizes": "96x96" }]
      },
      {
        "name": "Settings",
        "url": "/settings",
        "icons": [{ "src": "/icons/settings.png", "sizes": "96x96" }]
      }
    ]
  }
  ```

  **Note:** Shortcuts require the app to be installed. They cannot be updated after installation without triggering the manifest update algorithm.

## Screenshots for Richer Install UI

- Include `screenshots` with `form_factor` to unlock the richer Chrome install dialog on Android and desktop.

  ```json
  // Before — basic "Add to Home Screen" bar
  { "name": "Chat" }

  // After — app-store-like install dialog
  {
    "name": "Chat",
    "description": "Real-time group chat",
    "screenshots": [
      {
        "src": "/screenshots/mobile.png",
        "sizes": "1080x1920",
        "type": "image/png",
        "form_factor": "narrow"
      },
      {
        "src": "/screenshots/desktop.png",
        "sizes": "1920x1080",
        "type": "image/png",
        "form_factor": "wide"
      }
    ]
  }
  ```

## Scope

- Set `scope` to control which URLs open inside the PWA window vs. an in-app browser. URLs outside the scope open in the system browser.

  ```json
  // Default — scope matches start_url directory
  { "start_url": "/" }

  // Explicit scope
  { "start_url": "/", "scope": "/" }
  ```

## Analytics Tip

- Append a query parameter to `start_url` to distinguish PWA launches from browser visits in analytics.

  ```json
  // Before — can't distinguish PWA vs browser launches
  { "start_url": "/" }

  // After — trackable
  { "start_url": "/?source=pwa" }
  ```

## Linking

- Every HTML page of your PWA must link to the manifest via `<link rel="manifest">`. See also `references/ios-safari.md` for Apple-specific tags.

  ```html
  <link rel="manifest" href="/manifest.webmanifest" />
  ```

  **Note:** When using vite-plugin-pwa, the manifest link is injected automatically. See `references/vite-plugin-pwa.md`.
