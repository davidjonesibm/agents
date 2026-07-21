# Offline Support

Rules for offline-first patterns, Background Sync, IndexedDB, offline fallback pages, and storage management.

## Offline Fallback Page

- Always provide a precached offline fallback page for failed navigation requests. Never let the browser show its default "no internet" error.

  ```typescript
  // Before — browser shows "ERR_INTERNET_DISCONNECTED"
  precacheAndRoute(self.__WB_MANIFEST);

  // After — shows a branded offline page
  import { setCatchHandler, matchPrecache } from 'workbox-routing';
  import { precacheAndRoute } from 'workbox-precaching';

  precacheAndRoute(self.__WB_MANIFEST);

  setCatchHandler(async ({ event }) => {
    if (event.request.destination === 'document') {
      return matchPrecache('/offline.html') || Response.error();
    }
    return Response.error();
  });
  ```

  **Why:** If you publish to the Google Play Store via TWA, rendering a browser HTTP error can cause penalization in store listings.

## SPA Offline Navigation

- For SPAs using navigation fallback, the precached `index.html` already serves as the offline shell. Ensure your app detects offline state and shows appropriate UI. See also `references/caching.md` for the `NavigationRoute` setup.

  ```typescript
  // In the Vue app — detect offline and show inline UI
  const isOnline = ref(navigator.onLine);
  window.addEventListener('online', () => {
    isOnline.value = true;
  });
  window.addEventListener('offline', () => {
    isOnline.value = false;
  });
  ```

  ```vue
  <!-- Before — no offline indicator -->
  <template>
    <RouterView />
  </template>

  <!-- After — offline banner -->
  <template>
    <div v-if="!isOnline" class="alert alert-warning">
      You are offline. Some features may be unavailable.
    </div>
    <RouterView />
  </template>
  ```

## Background Sync

- Use `BackgroundSyncPlugin` from `workbox-background-sync` to queue failed POST/PUT/DELETE requests and replay them when connectivity returns.

  ```typescript
  // Before — failed POST is lost when offline
  registerRoute(
    ({ url, request }) =>
      request.method === 'POST' && url.pathname.startsWith('/api/'),
    new NetworkOnly(),
  );

  // After — queued and retried automatically
  import { BackgroundSyncPlugin } from 'workbox-background-sync';

  const bgSyncPlugin = new BackgroundSyncPlugin('mutation-queue', {
    maxRetentionTime: 24 * 60, // 24 hours in minutes
  });

  registerRoute(
    ({ url, request }) =>
      request.method === 'POST' && url.pathname.startsWith('/api/'),
    new NetworkOnly({ plugins: [bgSyncPlugin] }),
    'POST',
  );
  ```

- Background Sync retries only on **network-failure exceptions** — NOT on 4xx/5xx responses. To handle application-level failures, add a `fetchDidSucceed` plugin:

  ```typescript
  // Before — 5xx responses are not retried
  new NetworkOnly({ plugins: [bgSyncPlugin] });

  // After — requeue on server errors
  new NetworkOnly({
    plugins: [
      {
        fetchDidSucceed: async ({ response }) => {
          if (response.status >= 500) {
            throw new Error('Server error, retry via background sync');
          }
          return response;
        },
      },
      bgSyncPlugin,
    ],
  });
  ```

- iOS Safari does **not** support the Background Sync API. Implement a manual retry queue for iOS. See also `references/ios-safari.md`.

## IndexedDB for Structured Data

- Use the `idb` (or `idb-keyval`) library for IndexedDB operations — it provides a clean Promise-based API over the raw callback-based IndexedDB API.

  ```typescript
  // Before — raw IndexedDB with callbacks
  const request = indexedDB.open('mydb', 1);
  request.onsuccess = (event) => {
    /* ... */
  };
  request.onerror = (event) => {
    /* ... */
  };

  // After — Promise-based with idb-keyval
  import { get, set, del } from 'idb-keyval';

  await set('draft-message', { text: 'hello', channelId: '123' });
  const draft = await get('draft-message');
  await del('draft-message');
  ```

- Use IndexedDB for structured app data (drafts, user preferences, offline message queue). Use Cache Storage for network resources (HTML, CSS, JS, images). See also `references/caching.md`.

  ```
  IndexedDB → structured data (JSON objects, user state, drafts)
  Cache Storage → network resources (URLs you'd fetch)
  ```

- IndexedDB is available from the main thread, web workers, and service workers — making it ideal for sharing state between your app and SW.

## Storage Persistence

- Request persistent storage to prevent the browser from evicting your cached data under storage pressure.

  ```typescript
  // Before — browser may evict data silently
  // (no protection)

  // After — request persistence (Chrome grants it automatically for installed PWAs)
  if (navigator.storage?.persist) {
    const granted = await navigator.storage.persist();
    console.log(`Persistent storage: ${granted ? 'granted' : 'denied'}`);
  }
  ```

  **Note:** Chrome automatically grants persistence for installed PWAs. Firefox prompts the user.

- Check storage quota before large operations:

  ```typescript
  // Before — write fails silently when storage is full

  // After — check quota first
  if (navigator.storage?.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    const remainingMB = ((quota! - usage!) / (1024 * 1024)).toFixed(1);
    console.log(`${remainingMB} MB available`);
  }
  ```

## Offline-First Architecture Patterns

- **App Shell + Dynamic Content:** Precache the HTML/CSS/JS shell; fetch content dynamically via API with `NetworkFirst` caching. Best for SPAs.

  ```typescript
  // Precache the shell
  precacheAndRoute(self.__WB_MANIFEST);

  // Runtime-cache API data with NetworkFirst
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new NetworkFirst({
      cacheName: 'api-data',
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 }),
      ],
    }),
  );
  ```

- **Queue + Sync:** Store mutations locally (IndexedDB) while offline, replay when online. Best for chat apps and forms.

  ```typescript
  // Before — message lost when offline
  async function sendMessage(content: string) {
    await fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // After — queue locally, sync when online
  async function sendMessage(content: string) {
    if (!navigator.onLine) {
      await set(`pending-${Date.now()}`, { content, timestamp: Date.now() });
      return; // SW BackgroundSync or manual retry handles the rest
    }
    await fetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }
  ```

## Storage Scoping

- All storage (IndexedDB, Cache Storage, service worker registration) is scoped to the **origin**, not the PWA. If you deploy multiple PWAs to one origin, they share storage and quotas. Prefix cache names and IndexedDB database names to avoid collisions.
