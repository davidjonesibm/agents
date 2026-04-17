# Vue 3 Performance Best Practices

Target: Vue 3.5+ with `<script setup lang="ts">`.

---

## Update Optimizations

- **Keep props stable** — pass derived booleans instead of shared IDs so child components skip unnecessary re-renders.

  ```vue
  <!-- Before (every ListItem re-renders when activeId changes) -->
  <template>
    <ListItem
      v-for="item in list"
      :key="item.id"
      :id="item.id"
      :active-id="activeId"
    />
  </template>

  <!-- After (only affected items re-render) -->
  <template>
    <ListItem
      v-for="item in list"
      :key="item.id"
      :id="item.id"
      :active="item.id === activeId"
    />
  </template>
  ```

  **Why:** When `activeId` changes, all items receive a new `:active-id` prop. With `:active`, only the two items whose boolean changed will re-render.

- **Use `v-once` for content that never changes** after initial render.

  ```vue
  <!-- Static legal text — render once, skip subsequent updates -->
  <template>
    <footer v-once>
      <p>© 2026 Chat App. All rights reserved.</p>
    </footer>
  </template>
  ```

- **Use `v-memo` to skip re-renders for `v-for` list items** that haven't changed.

  ```vue
  <!-- Only re-render when item.id or selected state changes -->
  <template>
    <div v-for="item in list" :key="item.id" v-memo="[item.id === selectedId]">
      <p>{{ item.name }}</p>
    </div>
  </template>
  ```

  **Why:** `v-memo` skips vnode creation and diffing for items whose memo deps haven't changed. Use it for large lists.

- **Preserve computed stability** — return the previous value when the output object hasn't meaningfully changed (Vue 3.4+).

  ```ts
  // Before (creates new object every time, triggers downstream effects)
  const userStatus = computed(() => ({
    isOnline: onlineUsers.value.includes(userId.value),
  }));

  // After (returns old value if content is unchanged)
  const userStatus = computed((oldValue) => {
    const newValue = { isOnline: onlineUsers.value.includes(userId.value) };
    if (oldValue && oldValue.isOnline === newValue.isOnline) {
      return oldValue;
    }
    return newValue;
  });
  ```

## Reactivity Overhead

- **Use `shallowRef()` for large arrays or deeply nested objects** whose internals don't need deep reactivity.

  ```ts
  // Before (tracks every nested property — expensive for 10,000+ items)
  const messages = ref<MessageWithSender[]>([]);

  // After (only triggers on .value reassignment)
  const messages = shallowRef<MessageWithSender[]>([]);

  // Update by replacing, not mutating:
  messages.value = [...messages.value, newMessage]; // triggers
  messages.value.push(newMessage); // DOES NOT trigger
  ```

  **Why:** Deep reactivity on large arrays creates proxy wrappers for every object and property access. Use `shallowRef` when you can replace the whole array.

- **Use `shallowReactive()` for flat reactive objects** with many keys but no nested reactivity needed.

  ```ts
  // Before
  const state = reactive({
    user: { name: '', prefs: { theme: 'dark' } },
    // inner objects are all deeply reactive
  });

  // After — only root properties are reactive
  const state = shallowReactive({
    user: { name: '', prefs: { theme: 'dark' } },
  });
  // Must replace to trigger: state.user = { ...state.user, name: 'new' }
  ```

- **Use `markRaw()` for objects that should never be reactive** (e.g., class instances, third-party objects).

  ```ts
  import { markRaw } from 'vue';

  const map = markRaw(new Map()); // never wrapped in proxy
  const ws = markRaw(new WebSocket(url));
  ```

## Code Splitting

- **Lazy-load route components** with dynamic imports for smaller initial bundles.

  ```ts
  // Before (eager import — everything in main bundle)
  import ChatView from '../views/ChatView.vue';

  const routes = [{ path: '/chat', component: ChatView }];

  // After (lazy-loaded route)
  const routes = [
    { path: '/chat', component: () => import('../views/ChatView.vue') },
  ];
  ```

- **Use `defineAsyncComponent` for heavy components** not needed on first paint.

  ```ts
  import { defineAsyncComponent } from 'vue';

  // Heavy component lazy-loaded on demand
  const GiphyPicker = defineAsyncComponent(
    () => import('../components/chat/GiphyPicker.vue'),
  );
  ```

## List Rendering

- **Virtualize large lists** (hundreds of items) — never render thousands of DOM nodes.

  ```vue
  <!-- Before (renders all 10,000 messages) -->
  <template>
    <div v-for="msg in messages" :key="msg.id">
      <Message :message="msg" />
    </div>
  </template>

  <!-- After (use a virtual scroller library) -->
  <template>
    <RecycleScroller
      :items="messages"
      :item-size="72"
      key-field="id"
      v-slot="{ item }"
    >
      <Message :message="item" />
    </RecycleScroller>
  </template>
  ```

  Libraries: `vue-virtual-scroller`, `@tanstack/vue-virtual`.

- **Always use a unique, stable `:key`** — never use array index.

  ```vue
  <!-- Bad -->
  <div v-for="(msg, i) in messages" :key="i" />

  <!-- Good -->
  <div v-for="msg in messages" :key="msg.id" />
  ```

## Component Optimization

- **Avoid unnecessary component abstractions** in hot paths. Each component instance has memory and reconciliation overhead.

  ```vue
  <!-- Before — wrapper component adds overhead in a large list -->
  <template>
    <ItemWrapper v-for="item in items" :key="item.id">
      <span>{{ item.name }}</span>
    </ItemWrapper>
  </template>

  <!-- After — inline if wrapper provides no logic -->
  <template>
    <div v-for="item in items" :key="item.id" class="item-wrapper">
      <span>{{ item.name }}</span>
    </div>
  </template>
  ```

- **Use `<KeepAlive>` to cache component state** for frequently toggled views (e.g., tab views).

  ```vue
  <template>
    <KeepAlive>
      <component :is="currentTab" />
    </KeepAlive>
  </template>
  ```

  Use `include`/`exclude` to control which components are cached: `<KeepAlive :include="['ChatView', 'ProfileView']">`.

## Computed vs Methods vs Watchers

- **Use `computed`** for synchronous derived state (cached, reactive).
- **Use methods (plain functions)** for event handlers and imperative actions.
- **Use `watch/watchEffect`** for side effects (API calls, DOM manipulation, logging).

  ```ts
  // Good — computed for derived UI state
  const fullName = computed(() => `${user.value.first} ${user.value.last}`);

  // Good — function for event handler
  function handleSubmit() {
    /* ... */
  }

  // Good — watch for side effect
  watch(channelId, async (id) => {
    if (id) await fetchMessages(id);
  });
  ```

  See also `references/patterns.md` for reactivity patterns.

## Bundle Size

- **Prefer tree-shakable imports** — import specific functions, not entire libraries.

  ```ts
  // Before (imports entire library)
  import _ from 'lodash';
  _.debounce(fn, 300);

  // After (tree-shakable)
  import { debounce } from 'lodash-es';
  debounce(fn, 300);
  ```

- **Check dependency sizes** before adding them. Use `bundlejs.com` for quick size analysis.
