# Service Workers

Rules for service worker lifecycle, registration, update flow, and scope. Target: Workbox v7.x.

## Registration

- Register the service worker inside the `load` event to avoid competing with page-critical resources.

  ```typescript
  // Before — blocks initial page load
  navigator.serviceWorker.register('/sw.js');

  // After — defers until page is loaded
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
  ```

- Always feature-detect before registration.

  ```typescript
  // Before — crashes on unsupported browsers
  navigator.serviceWorker.register('/sw.js');

  // After
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }
  ```

- Never change the service worker filename after initial deployment — all browsers rely on the URL to detect updates.

  ```typescript
  // Before — breaks update detection
  navigator.serviceWorker.register('/sw-v2.js');

  // After — always use the same filename
  navigator.serviceWorker.register('/sw.js');
  ```

## Lifecycle

- Always call `event.waitUntil()` inside `install` and `activate` handlers to signal lifecycle completion. Without it, the browser may terminate the service worker before async work finishes.

  ```typescript
  // Before — browser may kill SW mid-operation
  self.addEventListener('install', () => {
    caches.open('v1').then((cache) => cache.addAll(['/']));
  });

  // After
  self.addEventListener('install', (event) => {
    event.waitUntil(caches.open('v1').then((cache) => cache.addAll(['/'])));
  });
  ```

- Use `skipWaiting()` and `clients.claim()` together when you want immediate takeover — but always pair with a user-visible reload prompt.

  ```typescript
  // Before — silent takeover, pages may break mid-session
  self.addEventListener('install', () => {
    self.skipWaiting();
  });
  self.addEventListener('activate', () => {
    // no claim, no user notification
  });

  // After — controlled takeover with user notification
  self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });
  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });
  ```

  **Why:** `skipWaiting()` without a reload prompt can silently break pages mid-session if the new SW changes API contracts or cached resources.

## Update Flow

- Service workers are byte-compared on each navigation. If even one byte differs, the browser installs the new SW. Do not add random cache-busting — the build tool handles content hashing.

  ```typescript
  // Before — prevents caching of the SW file itself
  navigator.serviceWorker.register('/sw.js?v=' + Date.now());

  // After — let the browser's built-in byte-comparison handle updates
  navigator.serviceWorker.register('/sw.js');
  ```

- Handle the "waiting" state by prompting users to update. A new SW entering the `waiting` state is normal — do NOT bypass without informing the user.

  ```typescript
  // Before — no update UI
  navigator.serviceWorker.register('/sw.js');

  // After — detect waiting SW and prompt
  const registration = await navigator.serviceWorker.register('/sw.js');
  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    newWorker?.addEventListener('statechange', () => {
      if (
        newWorker.state === 'installed' &&
        navigator.serviceWorker.controller
      ) {
        showUpdateBanner(); // "New version available — reload?"
      }
    });
  });
  ```

- After `skipWaiting()`, reload all controlled clients so they use the new SW's resources. See also `references/vite-plugin-pwa.md` for the `registerType: 'prompt'` pattern.

  ```typescript
  // In the main thread, after the user clicks "Update"
  navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
  ```

## Scope

- Place the service worker file at the root of your app so it can control all navigation requests. Never put it inside a subdirectory like `/scripts/`.

  ```
  // Before — only controls /scripts/* paths
  /scripts/sw.js → scope: /scripts/

  // After — controls entire origin
  /sw.js → scope: /
  ```

- To widen scope beyond the SW file's directory, set the `Service-Worker-Allowed` HTTP response header on the SW file. Only do this when intentionally needed.

## Communication

- Use `clients.matchAll({ type: 'window', includeUncontrolled: true })` to communicate with all open tabs, including those not yet controlled by this SW.

  ```typescript
  // Before — misses tabs opened before SW activation
  const clients = await self.clients.matchAll({ type: 'window' });

  // After — includes all tabs
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  ```

- Use `postMessage` for SW-to-client communication (e.g., navigation after notification click). See also `references/push.md`.

  ```typescript
  // In the service worker
  client.postMessage({ type: 'NAVIGATE', url: '/chat/123' });

  // In the main thread
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NAVIGATE') {
      router.push(event.data.url);
    }
  });
  ```

## Service Worker Lifespan

- Service workers run on their own thread and are terminated after being idle for a few seconds. Never store in-memory state that must survive between runs — use IndexedDB or Cache Storage instead. See also `references/offline.md`.

  ```typescript
  // Before — state lost when SW is terminated
  let messageCount = 0;
  self.addEventListener('push', () => {
    messageCount++;
  });

  // After — persist state in IndexedDB
  import { get, set } from 'idb-keyval';
  self.addEventListener('push', async () => {
    const count = (await get('messageCount')) || 0;
    await set('messageCount', count + 1);
  });
  ```

## TypeScript

- Add `/// <reference lib="webworker" />` at the top of your service worker file and declare `self` to get proper typings.

  ```typescript
  // Before — no type safety for SW globals
  precacheAndRoute(self.__WB_MANIFEST);

  // After
  /// <reference lib="webworker" />
  declare const self: ServiceWorkerGlobalScope;

  precacheAndRoute(self.__WB_MANIFEST);
  ```

- Include `"WebWorker"` in your `tsconfig.json` `lib` array for the service worker file. See also `references/vite-plugin-pwa.md`.
