---
name: pwa-pro
description: >-
  Comprehensively reviews PWA code for best practices on service workers, caching strategies,
  offline support, push notifications, and web app manifests. Use when reading, writing, or
  reviewing Progressive Web App code, Workbox configuration, vite-plugin-pwa setup, or
  iOS Safari PWA compatibility.
---

Review Progressive Web App code for correctness, modern API usage, and adherence to best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Validate service worker lifecycle and registration using `references/service-workers.md`.
2. Check caching strategies and Workbox configuration using `references/caching.md`.
3. Verify web app manifest completeness and correctness using `references/manifest.md`.
4. Validate offline support patterns using `references/offline.md`.
5. Check push notification implementation using `references/push.md`.
6. Review vite-plugin-pwa configuration using `references/vite-plugin-pwa.md`.
7. Audit performance best practices using `references/performance.md`.
8. Verify iOS Safari compatibility using `references/ios-safari.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **Workbox v7.x** and **vite-plugin-pwa v1.x** or later.
- Service workers must be treated as **optional progressive enhancement** — core features must work without them.
- Never hardcode precache manifests — always use `self.__WB_MANIFEST` injection from the build tool.
- Always call `cleanupOutdatedCaches()` to prevent stale cache accumulation.
- Never change the service worker filename after initial deployment — breaks update detection.
- Never use `'unsafe-eval'` in Content Security Policy headers.
- Always provide both `192x192` and `512x512` PNG icons for installability.
- Always include `<link rel="apple-touch-icon">` in HTML — iOS Safari ignores manifest icons.
- Push notification permission must never be requested on page load — always use a user-initiated flow.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated.
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary of the most impactful changes to make first.

Example output:

### service-worker.ts

**Line 8: Always call `cleanupOutdatedCaches()` before `precacheAndRoute()`.**

```typescript
// Before
precacheAndRoute(self.__WB_MANIFEST);

// After
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
```

**Line 22: Add `ExpirationPlugin` to prevent unbounded cache growth.**

```typescript
// Before
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
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);
```

### vite.config.mts

**Line 45: Provide separate maskable icon entry instead of combined `"any maskable"` purpose.**

```typescript
// Before
{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }

// After
{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
{ src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
```

### Summary

1. **Cache growth (high):** Unbounded image cache on line 22 can exhaust device storage.
2. **Stale caches (high):** Missing `cleanupOutdatedCaches()` causes indefinite cache accumulation.
3. **Manifest icons (medium):** Combined `"any maskable"` purpose is deprecated.

End of example.

## References

- `references/service-workers.md` — Service worker lifecycle, registration, update flow, scope.
- `references/caching.md` — Caching strategies, Workbox patterns, precaching, runtime caching.
- `references/manifest.md` — Web app manifest fields, icons, display modes, shortcuts.
- `references/offline.md` — Offline-first patterns, Background Sync, IndexedDB, fallback pages.
- `references/push.md` — Push notifications, VAPID, subscription flow, notification API.
- `references/vite-plugin-pwa.md` — vite-plugin-pwa configuration, injectManifest, generateSW.
- `references/performance.md` — Core Web Vitals, asset optimization, resource hints.
- `references/ios-safari.md` — iOS Safari PWA quirks, workarounds, limitations.
