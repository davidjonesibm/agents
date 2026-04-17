# Caching Strategies

Rules for Workbox caching strategies, precaching, runtime caching, and cache management. Target: Workbox v7.x.

## Strategy Selection

| Strategy                   | When to Use                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| **Cache First**            | Versioned/hashed static assets (JS, CSS, fonts, images)                       |
| **Network First**          | Navigation requests, API data needing freshness — add `networkTimeoutSeconds` |
| **Stale While Revalidate** | Avatars, logos, non-critical API data where stale is acceptable               |
| **Cache Only**             | Fully offline, precached-only resources                                       |
| **Network Only**           | Analytics, mutations, real-time data                                          |

## Precaching

- Always use `self.__WB_MANIFEST` for precache injection — never hardcode the manifest in production.

  ```typescript
  // Before — hardcoded manifest, won't update with builds
  precacheAndRoute([
    { url: '/index.html', revision: 'abc123' },
    { url: '/app.js', revision: 'def456' },
  ]);

  // After — build tool injects the manifest automatically
  precacheAndRoute(self.__WB_MANIFEST);
  ```

- Always call `cleanupOutdatedCaches()` before `precacheAndRoute()`. Without it, stale precache entries from previous SW versions accumulate indefinitely.

  ```typescript
  // Before — old caches pile up
  precacheAndRoute(self.__WB_MANIFEST);

  // After
  cleanupOutdatedCaches();
  precacheAndRoute(self.__WB_MANIFEST);
  ```

- Precache only the **app shell** (HTML, critical JS/CSS bundles) — never precache large images or media. Use runtime caching with `ExpirationPlugin` for those instead.

  ```typescript
  // Before — bloated precache
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,jpg,mp4}'],
  }

  // After — only app shell assets
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  }
  ```

- Use `ignoreURLParametersMatching` to strip tracking parameters that cause cache misses.

  ```typescript
  precacheAndRoute(self.__WB_MANIFEST, {
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^gclid$/],
  });
  ```

## SPA Navigation Fallback

- For single-page apps, use `NavigationRoute` with `createHandlerBoundToURL` to serve the precached `index.html` for all navigation requests.

  ```typescript
  // Before — no SPA fallback, deep links 404 when offline
  precacheAndRoute(self.__WB_MANIFEST);

  // After
  import { createHandlerBoundToURL } from 'workbox-precaching';
  import { NavigationRoute, registerRoute } from 'workbox-routing';

  precacheAndRoute(self.__WB_MANIFEST);

  const navigationRoute = new NavigationRoute(
    createHandlerBoundToURL('/index.html'),
    { denylist: [/^\/api\//] },
  );
  registerRoute(navigationRoute);
  ```

  **Why:** Without a navigation fallback, refreshing or deep-linking into a SPA route while offline returns a network error.

- Always add `/api/` (or your API prefix) to the `denylist` so API requests are not intercepted by the navigation fallback.

## Runtime Caching

- Always add `ExpirationPlugin` to runtime caching routes to prevent unbounded cache growth.

  ```typescript
  // Before — cache grows forever
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({ cacheName: 'images' }),
  );

  // After
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'images',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          purgeOnQuotaError: true,
        }),
      ],
    }),
  );
  ```

- Use `CacheableResponsePlugin` for cross-origin/CDN resources. Opaque responses have `status: 0` and need to be explicitly allowed.

  ```typescript
  // Before — cross-origin responses silently fail to cache
  registerRoute(
    ({ url }) => url.origin === 'https://fonts.gstatic.com',
    new CacheFirst({ cacheName: 'google-fonts' }),
  );

  // After
  import { CacheableResponsePlugin } from 'workbox-cacheable-response';

  registerRoute(
    ({ url }) => url.origin === 'https://fonts.gstatic.com',
    new CacheFirst({
      cacheName: 'google-fonts',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        }),
      ],
    }),
  );
  ```

  **Note:** Use `statuses: [200]` (not `[0, 200]`) for same-origin resources you fully control. The `0` status is only needed for opaque (cross-origin) responses. See also `references/performance.md`.

- Add `networkTimeoutSeconds` to `NetworkFirst` strategies to set a maximum wait time before falling back to cache.

  ```typescript
  // Before — hangs on slow networks
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new NetworkFirst({ cacheName: 'api-cache' }),
  );

  // After — falls back to cache after 3 seconds
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 }),
      ],
    }),
  );
  ```

## Broadcast Cache Updates

- Use `BroadcastUpdatePlugin` with `StaleWhileRevalidate` to notify the main thread when cached content is refreshed in the background.

  ```typescript
  // Before — user sees stale data with no indication of update
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/feed'),
    new StaleWhileRevalidate({ cacheName: 'feed-cache' }),
  );

  // After — notifies when fresh data arrives
  import { BroadcastUpdatePlugin } from 'workbox-broadcast-update';

  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/feed'),
    new StaleWhileRevalidate({
      cacheName: 'feed-cache',
      plugins: [new BroadcastUpdatePlugin()],
    }),
  );

  // In the main thread
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.meta === 'workbox-broadcast-update') {
      const { updatedURL } = event.data.payload;
      showToast(`Updated content from ${updatedURL}`);
    }
  });
  ```

## Security

- Never cache redirects, 4xx, or 5xx responses.
- Never serve authenticated API responses from cache without very short TTLs or `NetworkOnly`.

  ```typescript
  // Before — cached auth response served to a different user session
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/me'),
    new CacheFirst({ cacheName: 'user-cache' }),
  );

  // After — authenticated data uses NetworkOnly
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/me'),
    new NetworkOnly(),
  );
  ```

- Cache names should be unique per app when hosting multiple apps on the same origin. Prefix cache names to avoid collisions.

## Workbox v7 Notes

- Workbox v7 removed `workbox-google-analytics` — use gtag.js directly.
- Workbox v7 requires Node 18+.
- Always import from specific Workbox package paths, not the monolithic `workbox-sw`.

  ```typescript
  // Before — imports entire Workbox bundle
  importScripts(
    'https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js',
  );

  // After — tree-shakeable imports
  import { registerRoute } from 'workbox-routing';
  import {
    CacheFirst,
    NetworkFirst,
    StaleWhileRevalidate,
  } from 'workbox-strategies';
  import { ExpirationPlugin } from 'workbox-expiration';
  ```
