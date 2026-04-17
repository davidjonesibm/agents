# Performance

Rules for Core Web Vitals, asset optimization, resource hints, and PWA performance best practices.

## Core Web Vitals

- **INP** (Interaction to Next Paint) replaced FID as a Core Web Vital in March 2024. Good: ≤ 200ms. Poor: > 500ms.
- Lighthouse cannot measure INP (it requires real user interaction). Use **TBT** (Total Blocking Time) as a lab proxy for INP.
- Measure CWVs in production and send to analytics:

  ```typescript
  // Before — no real-user metrics
  // (only Lighthouse lab data)

  // After — production CWV measurement
  import { onLCP, onINP, onCLS } from 'web-vitals';

  const send = (metric: { name: string; value: number }) =>
    navigator.sendBeacon('/analytics', JSON.stringify(metric));

  onLCP(send);
  onINP(send);
  onCLS(send);
  ```

## App Shell Pattern

- Precache the minimum HTML/CSS/JS needed to render the UI shell. Serve content dynamically via runtime-cached API requests.

  ```typescript
  // Before — precache everything, including large images
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff2,ico}'],
  }

  // After — only the shell; images use runtime caching
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,woff2}'],
  }
  ```

  **Why:** Precaching large assets bloats the initial install, wastes bandwidth, and slows the first service worker activation. See also `references/caching.md`.

## Code Splitting

- Use dynamic `import()` for route-level code splitting. This reduces the precache size and speeds up initial load.

  ```typescript
  // Before — monolithic bundle
  import ChatView from './views/ChatView.vue';
  import SettingsView from './views/SettingsView.vue';

  const routes = [
    { path: '/chat', component: ChatView },
    { path: '/settings', component: SettingsView },
  ];

  // After — lazy-loaded routes
  const routes = [
    { path: '/chat', component: () => import('./views/ChatView.vue') },
    { path: '/settings', component: () => import('./views/SettingsView.vue') },
  ];
  ```

- Use `<link rel="prefetch">` or router-level prefetching for non-critical route chunks to speed up subsequent navigations.

  ```html
  <!-- Before — chunks loaded on demand only -->
  <!-- (slower navigation to settings) -->

  <!-- After — prefetch likely next routes -->
  <link rel="prefetch" href="/assets/SettingsView-abc123.js" />
  ```

## Navigation Preload

- Enable Navigation Preload to fetch navigation requests concurrently with service worker boot, reducing Time to First Byte.

  ```typescript
  // Before — SW must fully boot before fetch begins
  registerRoute(new NavigationRoute(handler));

  // After — fetch starts during SW boot
  import * as navigationPreload from 'workbox-navigation-preload';

  navigationPreload.enable();

  const handler = new NetworkFirst({
    cacheName: 'navigations',
    networkTimeoutSeconds: 3,
  });

  registerRoute(
    new NavigationRoute(handler, {
      denylist: [/^\/api\//],
    }),
  );
  ```

  **Note:** Navigation Preload is not supported on iOS Safari. It's a progressive enhancement — the app works without it.

## Resource Hints

- Use `<link rel="preconnect">` for critical third-party origins (CDNs, font servers, API servers).

  ```html
  <!-- Before — cold TCP+TLS connection on first request -->
  <!-- (adds ~100-300ms latency) -->

  <!-- After — connection established early -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  ```

- Use `<link rel="dns-prefetch">` as a fallback for browsers that don't support `preconnect`.

  ```html
  <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
  ```

## Font Loading

- Preload critical fonts to prevent layout shifts (CLS).

  ```html
  <!-- Before — font loaded late, causes FOUT/FOIT -->
  <link rel="stylesheet" href="/styles.css" />

  <!-- After — font loaded early -->
  <link
    rel="preload"
    href="/fonts/inter.woff2"
    as="font"
    type="font/woff2"
    crossorigin
  />
  <link rel="stylesheet" href="/styles.css" />
  ```

- Cache fonts aggressively with Cache First — fonts rarely change.

  ```typescript
  // Before — font re-downloaded on every visit
  // (no caching)

  // After
  registerRoute(
    ({ request }) => request.destination === 'font',
    new CacheFirst({
      cacheName: 'fonts',
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

## Image Optimization

- Use modern formats (WebP, AVIF) with `<picture>` fallbacks.

  ```html
  <!-- Before — large PNG only -->
  <img src="photo.png" alt="Photo" />

  <!-- After — modern formats with fallback -->
  <picture>
    <source srcset="photo.avif" type="image/avif" />
    <source srcset="photo.webp" type="image/webp" />
    <img src="photo.png" alt="Photo" loading="lazy" />
  </picture>
  ```

- Use `loading="lazy"` on below-the-fold images. Never lazy-load the LCP (Largest Contentful Paint) image.

  ```html
  <!-- Before — all images load eagerly -->
  <img src="hero.png" alt="Hero" />
  <img src="thumbnail.png" alt="Thumbnail" />

  <!-- After — LCP image eager, others lazy -->
  <img src="hero.png" alt="Hero" fetchpriority="high" />
  <img src="thumbnail.png" alt="Thumbnail" loading="lazy" />
  ```

## Lighthouse PWA Audit

- Run Lighthouse PWA audits in **incognito mode** to avoid extension interference.
- Key audit checks: HTTPS, valid manifest, registered SW with fetch handler, offline fallback, icons, `theme-color` meta tag.

## Service Worker Impact on Performance

- Service workers add a small boot overhead on cold starts. Use Navigation Preload (see above) to mitigate.
- The `install` event should complete quickly. Precache only essential assets — precaching too much delays SW activation and blocks the update flow.

  ```typescript
  // Before — precaching 50MB of assets
  injectManifest: {
    globPatterns: ['**/*'],
    maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
  }

  // After — only essential shell (~500KB-2MB)
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,woff2}'],
  }
  ```

- Use `purgeOnQuotaError: true` in `ExpirationPlugin` to automatically clean up caches when storage is under pressure, preventing storage quota errors from breaking the SW. See also `references/caching.md`.
