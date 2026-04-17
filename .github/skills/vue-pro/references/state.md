# Pinia State Management Best Practices

Target: Pinia 2.x with Vue 3.5+ and `<script setup lang="ts">`.

---

## Store Design

- **Use setup stores (function syntax) for TypeScript projects** — they provide full type inference without annotations.

  ```ts
  // Before (option syntax — requires manual typing for complex getters)
  export const useChatStore = defineStore('chat', {
    state: () => ({
      messages: [] as MessageWithSender[],
      loading: false,
    }),
    getters: {
      unreadCount: (state) => state.messages.filter((m) => !m.read).length,
    },
    actions: {
      addMessage(msg: MessageWithSender) {
        this.messages.push(msg);
      },
    },
  });

  // After (setup syntax — full inference, Composition API)
  export const useChatStore = defineStore('chat', () => {
    const messages = ref<MessageWithSender[]>([]);
    const loading = ref(false);

    const unreadCount = computed(
      () => messages.value.filter((m) => !m.read).length,
    );

    function addMessage(msg: MessageWithSender) {
      messages.value.push(msg);
    }

    return { messages, loading, unreadCount, addMessage };
  });
  ```

  **Why:** Setup stores use standard Composition API — `ref` for state, `computed` for getters, plain functions for actions. No `this` ambiguity.

- **Name stores consistently** using `use*Store` convention and a unique string ID.

  ```ts
  // Good
  export const useAuthStore = defineStore('auth', () => {
    /* ... */
  });
  export const useChatStore = defineStore('chat', () => {
    /* ... */
  });
  export const useChannelStore = defineStore('channel', () => {
    /* ... */
  });

  // Bad — inconsistent naming
  export const authState = defineStore('auth', () => {
    /* ... */
  });
  export const chat = defineStore('Chat', () => {
    /* ... */
  });
  ```

- **Keep stores focused** — one store per domain concern. Don't create a single monolithic store.

  ```ts
  // Bad — everything in one store
  export const useAppStore = defineStore('app', () => {
    const user = ref(null);
    const messages = ref([]);
    const channels = ref([]);
    const theme = ref('light');
    // ... 500 lines
  });

  // Good — separate concerns
  export const useAuthStore = defineStore('auth', () => {
    /* user, token */
  });
  export const useChatStore = defineStore('chat', () => {
    /* messages, typing */
  });
  export const useChannelStore = defineStore('channel', () => {
    /* groups, channels */
  });
  ```

## Accessing Store State

- **Use `storeToRefs()` when destructuring reactive state or getters from a store.** Actions can be destructured directly.

  ```vue
  <!-- Before (BROKEN — loses reactivity) -->
  <script setup lang="ts">
  const store = useChatStore();
  const { messages, loading } = store;
  </script>

  <!-- After -->
  <script setup lang="ts">
  import { storeToRefs } from 'pinia';
  const store = useChatStore();
  const { messages, loading } = storeToRefs(store);
  // Actions don't need storeToRefs
  const { addMessage, clearChat } = store;
  </script>
  ```

- **Access the store directly (no destructuring) for one-off reads** in templates or event handlers.

  ```vue
  <script setup lang="ts">
  const authStore = useAuthStore();
  </script>
  <template>
    <span>{{ authStore.user?.name }}</span>
  </template>
  ```

## Store Composition

- **Stores can use other stores** — call `useOtherStore()` inside the setup function.

  ```ts
  export const useCartStore = defineStore('cart', () => {
    const userStore = useUserStore();
    const items = ref<CartItem[]>([]);

    const summary = computed(
      () => `Hi ${userStore.user?.name}, you have ${items.value.length} items.`,
    );

    return { items, summary };
  });
  ```

- **Avoid circular store dependencies.** If store A needs store B and vice versa, extract the shared logic into a composable.

  ```ts
  // Bad — circular: storeA uses storeB, storeB uses storeA

  // Good — extract shared logic
  // composables/useSharedState.ts
  export function useSharedState() {
    /* ... */
  }

  // Both stores use the composable instead of each other
  ```

## Store vs Composable

- **Use a Pinia store** when state must be shared across multiple components and persist across navigations.
- **Use a composable** when logic is reusable but state is local to the component instance.

  ```ts
  // Store — global shared state
  export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null);
    const token = ref<string | null>(null);
    return { user, token };
  });

  // Composable — per-instance logic
  export function useFormValidation() {
    const errors = ref<Record<string, string>>({});
    function validate(field: string, value: string) {
      /* ... */
    }
    return { errors, validate };
  }
  ```

## Reactivity Patterns

- **Use `$patch` for batch updates** when modifying multiple state properties at once (option stores) or mutate refs directly in setup stores.

  ```ts
  // Option store — batch mutation
  store.$patch({
    messages: newMessages,
    loading: false,
    hasMore: true,
  });

  // Setup store — direct mutation is fine
  messages.value = newMessages;
  loading.value = false;
  hasMore.value = true;
  ```

- **Use `$reset()` only with option stores.** Setup stores need a manual reset function.

  ```ts
  // Setup store — manual reset
  export const useChatStore = defineStore('chat', () => {
    const messages = ref<MessageWithSender[]>([]);
    const loading = ref(false);

    function clearChat() {
      messages.value = [];
      loading.value = false;
    }

    return { messages, loading, clearChat };
  });
  ```

- **Use `$subscribe()` sparingly** — prefer `watch()` on specific store properties for more precise reactivity.

  ```ts
  // Before (watches all store changes)
  store.$subscribe((mutation, state) => {
    localStorage.setItem('chat', JSON.stringify(state));
  });

  // After (precise — watches only what matters)
  watch(
    () => store.messages,
    (msgs) => {
      localStorage.setItem('messages', JSON.stringify(msgs));
    },
    { deep: true },
  );
  ```

## Async Actions

- **Handle loading and error states in store actions** — don't leave that to components.

  ```ts
  export const useChannelStore = defineStore('channel', () => {
    const channels = ref<Channel[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function fetchChannels(groupId: string) {
      loading.value = true;
      error.value = null;
      try {
        channels.value = await apiFetch<Channel[]>(
          `/api/groups/${groupId}/channels`,
        );
      } catch (err) {
        error.value =
          err instanceof Error ? err.message : 'Failed to fetch channels';
        throw err;
      } finally {
        loading.value = false;
      }
    }

    return { channels, loading, error, fetchChannels };
  });
  ```

- **Avoid calling store actions in `created`/`mounted` of every component.** Prefer a single orchestration point (router guard, parent component, or app-level composable).

  ```ts
  // Good — fetch in router guard, not in every component
  router.beforeEach(async (to) => {
    const authStore = useAuthStore();
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      return '/login';
    }
  });
  ```

  See also `references/patterns.md` for composable design patterns.
