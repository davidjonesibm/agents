# Push Notifications

Rules for Web Push API, VAPID, subscription flow, Notification API, and permission UX.

## Permission UX

- **Never** request notification permission on page load. Chrome penalizes sites that do this, and users overwhelmingly deny the prompt.

  ```typescript
  // Before — hostile UX, high denial rate
  window.addEventListener('load', () => {
    Notification.requestPermission();
  });

  // After — user-initiated, contextual prompt
  enableNotificationsBtn.addEventListener('click', async () => {
    // 1. Show in-app explanation first
    const confirmed = await showExplanationModal(
      'Get notified when new messages arrive',
    );
    if (!confirmed) return;

    // 2. Then request browser permission
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await subscribeToPush();
    }
  });
  ```

- Check permission state before showing the enable button:

  ```typescript
  // Before — button shown even when already granted/denied
  showEnableButton();

  // After — context-aware UI
  if (Notification.permission === 'default') {
    showEnableButton();
  } else if (Notification.permission === 'granted') {
    showDisableButton();
  }
  // If 'denied', don't show anything — the user must change this in browser settings
  ```

## Subscription Flow

- Subscribe using `pushManager.subscribe()` with `userVisibleOnly: true` (required — silent push is not allowed) and the VAPID public key.

  ```typescript
  // Before — missing VAPID key, subscription fails
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
  });

  // After — correct subscription with VAPID
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Send subscription to your server
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  });
  ```

- The `urlBase64ToUint8Array` utility is required to convert the VAPID public key:

  ```typescript
  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  }
  ```

## Push Event Handler

- Always call `event.waitUntil()` with `showNotification()` in the `push` event. Without it, the browser may terminate the SW before the notification is displayed.

  ```typescript
  // Before — notification may not show
  self.addEventListener('push', (event) => {
    const data = event.data?.json();
    self.registration.showNotification(data.title, { body: data.body });
  });

  // After — notification guaranteed to show
  self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: `channel-${data.channelId}`,
        data: { url: `/chat/${data.channelId}` },
      }),
    );
  });
  ```

- Use the `tag` property to replace (not stack) notifications for the same context. Prevents notification spam.

  ```typescript
  // Before — 10 messages = 10 separate notifications
  self.registration.showNotification(title, { body });

  // After — latest message replaces the previous one for the same channel
  self.registration.showNotification(title, {
    body,
    tag: `channel-${channelId}`,
    renotify: true, // vibrate/sound again even when replacing
  });
  ```

## Notification Click Handler

- Always close the notification first, then focus or open a window. Use `event.waitUntil()`.

  ```typescript
  // Before — notification stays open, no navigation
  self.addEventListener('notificationclick', (event) => {
    clients.openWindow(event.notification.data.url);
  });

  // After — close, focus existing tab or open new
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Focus existing tab if found
          for (const client of clientList) {
            if (
              new URL(client.url).pathname === targetUrl &&
              'focus' in client
            ) {
              return client.focus();
            }
          }
          // Existing tab at different URL — navigate via postMessage
          for (const client of clientList) {
            if (new URL(client.url).origin === self.location.origin) {
              client.postMessage({ type: 'NAVIGATE', url: targetUrl });
              return client.focus();
            }
          }
          // No existing tab — open new window
          return self.clients.openWindow(targetUrl);
        }),
    );
  });
  ```

  **Why:** In SPAs, use `postMessage` to navigate instead of `openWindow` to avoid a full page reload. See also `references/service-workers.md` for SW communication patterns.

## VAPID Security

- The VAPID **private key must be a server-side environment variable** — never expose it in client code or commit it to version control.

  ```typescript
  // Before — private key in client bundle (CRITICAL vulnerability)
  const VAPID_PRIVATE_KEY = 'abc123secret';

  // After — server-side only
  // .env (server)
  VAPID_PRIVATE_KEY = abc123secret;

  // route handler (server)
  import webpush from 'web-push';
  webpush.setVapidDetails(
    'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  ```

- The VAPID **public key** is safe to include in client code — it's needed by `pushManager.subscribe()`.

## Payload Encryption

- Web Push payloads are end-to-end encrypted by the `web-push` library using the subscription's public key. Never send sensitive unencrypted data as a push payload.
- Keep payloads small (< 4KB). Send a notification ID and fetch details from the server if needed.

  ```typescript
  // Before — large payload with full message content
  webpush.sendNotification(
    subscription,
    JSON.stringify({
      title: 'New Message',
      body: fullMessageContent, // could be very large
      metadata: {
        /* ... */
      },
    }),
  );

  // After — minimal payload, fetch details if needed
  webpush.sendNotification(
    subscription,
    JSON.stringify({
      title: 'New Message',
      body: truncatedPreview.slice(0, 100),
      channelId: '123',
      groupId: '456',
    }),
  );
  ```

## iOS Push Notification Requirements

- Push notifications on iOS require **iOS 16.4+** AND the PWA must be **installed to the home screen**. Push does NOT work in Safari browser tabs.
- iOS does not support the `beforeinstallprompt` event — you must guide users to install manually before push works. See also `references/ios-safari.md`.

## Subscription Management

- Handle expired or invalid subscriptions gracefully. Remove them from your server when push delivery fails with a 410 (Gone) status.

  ```typescript
  // Server-side: clean up invalid subscriptions
  try {
    await webpush.sendNotification(subscription, payload);
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      await deleteSubscription(subscription.endpoint);
    }
  }
  ```

- Re-subscribe when the user returns after a long absence — subscriptions can expire.

  ```typescript
  // Before — assumes subscription is always valid
  const sub = await registration.pushManager.getSubscription();
  if (sub) return; // assume it works

  // After — validate and re-subscribe if needed
  const sub = await registration.pushManager.getSubscription();
  if (sub) {
    // Verify server still has this subscription
    const valid = await fetch('/api/push/validate', {
      method: 'POST',
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).then((r) => r.json());
    if (!valid) {
      await sub.unsubscribe();
      await subscribeToPush(); // re-subscribe
    }
  }
  ```
