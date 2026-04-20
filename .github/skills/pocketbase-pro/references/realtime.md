# PocketBase Real-Time Subscriptions

Target: PocketBase v0.25+ with JS SDK v0.25+

## Overview

PocketBase real-time is implemented via **Server-Sent Events (SSE)**, not WebSocket. The JS SDK abstracts this into a simple subscribe/unsubscribe API. Events fire for `create`, `update`, and `delete` operations on records.

## Subscribe to All Collection Changes

```ts
const unsubscribe = await pb.collection('posts').subscribe('*', (data) => {
  console.log('Action:', data.action); // 'create' | 'update' | 'delete'
  console.log('Record:', data.record);

  switch (data.action) {
    case 'create':
      addPost(data.record);
      break;
    case 'update':
      updatePost(data.record);
      break;
    case 'delete':
      removePost(data.record.id);
      break;
  }
});
```

## Subscribe to a Single Record

```ts
const unsubscribe = await pb.collection('posts').subscribe(
  'RECORD_ID',
  (data) => {
    console.log('Record updated:', data.record);
  },
  {
    expand: 'author,comments', // expand relations in realtime events
  },
);
```

## Unsubscribe Patterns

```ts
// Unsubscribe using the returned function
const unsub = await pb.collection('posts').subscribe('*', handler);
unsub(); // removes this specific subscription

// Unsubscribe from a specific topic
await pb.collection('posts').unsubscribe('RECORD_ID');

// Unsubscribe from all topics in a collection
await pb.collection('posts').unsubscribe();

// Unsubscribe by prefix
await pb.realtime.unsubscribeByPrefix('posts/');
```

- Always unsubscribe when the component or page is destroyed to prevent memory leaks.

  ```ts
  // Vue example
  import { onMounted, onUnmounted } from 'vue';

  let unsubscribe: (() => void) | undefined;

  onMounted(async () => {
    unsubscribe = await pb.collection('posts').subscribe('*', handleEvent);
  });

  onUnmounted(() => {
    unsubscribe?.();
  });
  ```

  ```ts
  // React example
  useEffect(() => {
    let unsub: (() => void) | undefined;

    pb.collection('posts')
      .subscribe('*', handleEvent)
      .then((fn) => {
        unsub = fn;
      });

    return () => {
      unsub?.();
    };
  }, []);
  ```

## Connection Management

```ts
// Check connection status
pb.realtime.isConnected;

// Handle disconnect
pb.realtime.onDisconnect = (activeSubscriptions) => {
  console.warn('Disconnected. Active subs:', activeSubscriptions);
  // Optionally refresh data when reconnection occurs
};
```

## Access Rules for Realtime

- **Single record subscription** → PocketBase checks the collection's `viewRule`.
- **Collection subscription** (`*`) → PocketBase checks the collection's `listRule`.
- If the authenticated user no longer satisfies the rule, they stop receiving events.

## Server-Side Custom Events (JSVM)

Send custom messages to connected clients from hooks:

```js
const message = new SubscriptionMessage({
  name: 'custom-topic',
  data: JSON.stringify({ type: 'notification', text: 'Hello!' }),
});

const clients = $app.subscriptionsBroker().clients();
for (let clientId in clients) {
  if (clients[clientId].hasSubscription('custom-topic')) {
    clients[clientId].send(message);
  }
}
```

## Realtime Best Practices

- Use single-record subscriptions when you only need changes for one record — they are more efficient and use `viewRule` instead of `listRule`.
- Do not use `getFullList()` on every realtime event to refresh — apply the delta from `data.record` to your local state.

  ```ts
  // Before — inefficient full refresh
  pb.collection('posts').subscribe('*', async () => {
    posts.value = await pb.collection('posts').getFullList();
  });

  // After — apply delta
  pb.collection('posts').subscribe('*', (data) => {
    if (data.action === 'create') {
      posts.value.push(data.record);
    } else if (data.action === 'update') {
      const idx = posts.value.findIndex((p) => p.id === data.record.id);
      if (idx !== -1) posts.value[idx] = data.record;
    } else if (data.action === 'delete') {
      posts.value = posts.value.filter((p) => p.id !== data.record.id);
    }
  });
  ```

- PocketBase uses SSE, which has a browser limit of ~6 concurrent connections per domain. Group subscriptions when possible.
- The `expand` option works in realtime events — use it to receive related data without extra requests.
