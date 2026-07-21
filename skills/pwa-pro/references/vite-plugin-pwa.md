# vite-plugin-pwa Configuration

Rules for vite-plugin-pwa setup, `injectManifest` vs `generateSW`, development mode, TypeScript service workers, and update handling. Target: vite-plugin-pwa v1.x with Workbox v7.x.

## Strategy Selection

- **`generateSW`** (default) — Workbox generates the entire service worker. Use when you only need precaching and runtime caching config. Zero boilerplate.
- **`injectManifest`** — Write a custom service worker; Workbox injects the precache manifest at `self.__WB_MANIFEST`. Use when you need push notifications, Background Sync, custom routing, or any logic beyond config.

  ```typescript
  // generateSW — config-only, no custom SW file needed
  VitePWA({
    registerType: 'autoUpdate',
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api\//],
      cleanupOutdatedCaches: true,
    },
  });

  // injectManifest — custom SW file with full control
  VitePWA({
    registerType: 'autoUpdate',
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'service-worker.ts',
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    },
  });
  ```

  **Rule of thumb:** If you need `addEventListener('push', ...)` or `BackgroundSyncPlugin`, you need `injectManifest`.

## Register Type

- `registerType: 'autoUpdate'` — new SW activates immediately (via `skipWaiting`). Simple but can break pages mid-session if the SW changes.
- `registerType: 'prompt'` — new SW waits; your app shows a "New version available" prompt. Safer for production.

  ```typescript
  // Before — silent update, can break mid-session
  VitePWA({ registerType: 'autoUpdate' });

  // After — user-controlled update
  VitePWA({ registerType: 'prompt' });
  ```

  See the "Update Handling" section below for the Vue implementation.

## TypeScript Service Worker

- With `injectManifest`, point `srcDir` and `filename` to your `.ts` service worker file. vite-plugin-pwa compiles it with Vite's bundler.

  ```typescript
  VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'service-worker.ts',
  });
  ```

- Add the WebWorker lib reference at the top of your service worker file and declare `self`:

  ```typescript
  // Before — no type safety
  precacheAndRoute(self.__WB_MANIFEST);

  // After — full type safety
  /// <reference lib="webworker" />
  declare const self: ServiceWorkerGlobalScope;

  import { precacheAndRoute } from 'workbox-precaching';
  precacheAndRoute(self.__WB_MANIFEST);
  ```

- Ensure your `tsconfig.json` (or a separate SW-specific tsconfig) includes `"WebWorker"` in the `lib` array:

  ```json
  // Before — TS errors for ServiceWorkerGlobalScope
  { "compilerOptions": { "lib": ["ESNext", "DOM"] } }

  // After
  { "compilerOptions": { "lib": ["ESNext", "DOM", "WebWorker"] } }
  ```

## Manifest Configuration

- Define the web app manifest inline via the `manifest` option. vite-plugin-pwa generates the `manifest.webmanifest` file and injects the `<link>` tag automatically.

  ```typescript
  VitePWA({
    manifest: {
      name: 'Chat PWA',
      short_name: 'Chat',
      description: 'Real-time group chat',
      theme_color: '#570df8',
      background_color: '#1d232a',
      display: 'standalone',
      scope: '/',
      start_url: '/',
      icons: [
        { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/icons/icon-512x512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
  });
  ```

  See also `references/manifest.md` for manifest field best practices.

- Set `manifest: false` to disable manifest generation if you provide your own `.webmanifest` file.

## Glob Patterns

- Configure `globPatterns` to control which build output files are precached. Only include app shell assets.

  ```typescript
  // Before — precaches everything including large images
  injectManifest: {
    globPatterns: ['**/*'],
  }

  // After — only essential assets
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  }
  ```

- Exclude large files from precache. If you need to cache large assets, use runtime caching with `ExpirationPlugin` instead. See `references/caching.md`.

## Development Mode

- Enable dev mode to test the service worker during development:

  ```typescript
  VitePWA({
    devOptions: {
      enabled: true,
      type: 'module',
    },
  });
  ```

- **Always set `type: 'module'`** in dev mode when using `injectManifest` with a TypeScript service worker. This enables ES module imports in the dev SW.

  ```typescript
  // Before — import errors in dev mode
  devOptions: { enabled: true }

  // After — module imports work correctly
  devOptions: { enabled: true, type: 'module' }
  ```

- The dev service worker uses a different registration path (`/dev-sw.js?dev-sw`) than production (`/sw.js`). This is handled automatically by vite-plugin-pwa.

## Update Handling (Vue)

- Use `useRegisterSW` from `virtual:pwa-register/vue` to handle SW updates reactively in Vue components.

  ```vue
  <!-- Before — no update UI -->
  <script setup lang="ts">
  // SW just auto-updates silently
  </script>

  <!-- After — prompt user to update -->
  <script setup lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/vue';

  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW();

  async function onUpdate() {
    await updateServiceWorker();
  }

  function onDismiss() {
    needRefresh.value = false;
    offlineReady.value = false;
  }
  </script>

  <template>
    <div v-if="needRefresh" class="toast toast-end">
      <div class="alert alert-info">
        <span>New version available!</span>
        <button class="btn btn-sm" @click="onUpdate">Update</button>
        <button class="btn btn-sm btn-ghost" @click="onDismiss">Later</button>
      </div>
    </div>
    <div v-else-if="offlineReady" class="toast toast-end">
      <div class="alert alert-success">
        <span>App ready for offline use</span>
        <button class="btn btn-sm btn-ghost" @click="onDismiss">OK</button>
      </div>
    </div>
  </template>
  ```

- For non-Vue frameworks, use `registerSW` from `virtual:pwa-register`:

  ```typescript
  import { registerSW } from 'virtual:pwa-register';

  const updateSW = registerSW({
    onNeedRefresh() {
      // Show update UI
    },
    onOfflineReady() {
      // Show offline-ready toast
    },
  });
  ```

## Icon Generation

- Generate all required icon sizes from a single source SVG:

  ```bash
  # Before — manually resizing icons in an image editor

  # After — automated, consistent generation
  pnpm dlx @vite-pwa/assets-generator --preset minimal-2023 public/logo.svg
  ```

- The generated icons include all sizes needed for both the manifest and `apple-touch-icon`. See also `references/ios-safari.md`.

## Build and Preview

- After making PWA changes, always build and preview to verify:

  ```bash
  pnpm build
  pnpm preview
  ```

- Check the Chrome DevTools → Application tab to verify: manifest fields, SW registration, precached assets, and push subscription.

## Common Pitfalls

- If the SW doesn't register in dev mode, ensure `devOptions.enabled` is `true` and `devOptions.type` is `'module'` for `injectManifest`.
- If precache is missing assets, check `globPatterns` — the patterns match against the build output directory, not the source.
- If the manifest link is missing from HTML, ensure `manifest` is not set to `false` unless you're providing your own.
