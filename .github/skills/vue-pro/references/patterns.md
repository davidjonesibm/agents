# Idiomatic Vue 3 Composition API Patterns

Target: Vue 3.5+ with `<script setup lang="ts">`. Composition API only.

---

## Component Structure

- **Always use `<script setup lang="ts">`** — never use `defineComponent()` with a `setup()` function in SFCs.

  ```vue
  <!-- Before (verbose) -->
  <script lang="ts">
  import { defineComponent, ref } from 'vue';
  export default defineComponent({
    setup() {
      const count = ref(0);
      return { count };
    },
  });
  </script>

  <!-- After -->
  <script setup lang="ts">
  import { ref } from 'vue';
  const count = ref(0);
  </script>
  ```

- **Order `<script>` → `<template>` → `<style>`** consistently across all SFCs.

  ```vue
  <!-- Correct order -->
  <script setup lang="ts">
  // logic
  </script>

  <template>
    <!-- markup -->
  </template>

  <style scoped>
  /* styles */
  </style>
  ```

## Reactivity

- **Prefer `ref()` over `reactive()` for primitives and top-level state.** Use `reactive()` only for deeply nested objects where `.value` access would be verbose.

  ```vue
  <!-- Before -->
  <script setup lang="ts">
  import { reactive } from 'vue';
  const state = reactive({ count: 0, name: '' });
  </script>

  <!-- After -->
  <script setup lang="ts">
  import { ref } from 'vue';
  const count = ref(0);
  const name = ref('');
  </script>
  ```

  **Why:** `ref()` works consistently for all value types, is easier to destructure, and avoids the reactivity-loss pitfall of destructuring `reactive()` objects.

- **Never destructure a `reactive()` object** without `toRefs()` — it breaks reactivity.

  ```ts
  // Before (BROKEN — loses reactivity)
  const state = reactive({ count: 0 });
  const { count } = state;

  // After
  import { toRefs } from 'vue';
  const state = reactive({ count: 0 });
  const { count } = toRefs(state);
  ```

- **Use `computed()` for derived state** — never use methods for values that derive from reactive sources.

  ```vue
  <!-- Before (recalculates every render) -->
  <script setup lang="ts">
  import { ref } from 'vue';
  const items = ref<Item[]>([]);
  function activeCount() {
    return items.value.filter((i) => i.active).length;
  }
  </script>
  <template>{{ activeCount() }}</template>

  <!-- After (cached, reactive) -->
  <script setup lang="ts">
  import { ref, computed } from 'vue';
  const items = ref<Item[]>([]);
  const activeCount = computed(
    () => items.value.filter((i) => i.active).length,
  );
  </script>
  <template>{{ activeCount }}</template>
  ```

  See also `references/performance.md` for computed stability patterns.

- **Use `watchEffect()` for side effects that depend on multiple reactive sources.** Use `watch()` when you need the old value, or want to watch specific sources.

  ```ts
  // watchEffect — runs immediately, auto-tracks dependencies
  watchEffect(() => {
    console.log(`Count is ${count.value}, name is ${name.value}`);
  });

  // watch — explicit source, access to old value
  watch(count, (newVal, oldVal) => {
    console.log(`Count changed from ${oldVal} to ${newVal}`);
  });
  ```

- **Avoid `watch` with `{ immediate: true }` when `watchEffect` suffices.** If you don't need the old value, `watchEffect` is more concise.

  ```ts
  // Before
  watch(
    searchQuery,
    (val) => {
      fetchResults(val);
    },
    { immediate: true },
  );

  // After
  watchEffect(() => {
    fetchResults(searchQuery.value);
  });
  ```

## Composables

- **Extract reusable logic into composables** (`use*` naming). A composable is a function that uses Vue reactivity APIs and returns reactive state.

  ```ts
  // composables/useCounter.ts
  import { ref } from 'vue';

  export function useCounter(initial = 0) {
    const count = ref(initial);
    const increment = () => count.value++;
    const decrement = () => count.value--;
    return { count, increment, decrement };
  }
  ```

- **Composables should return `ref`s, not `reactive` objects** — this allows consumers to destructure without losing reactivity.

  ```ts
  // Before (anti-pattern)
  export function useUser() {
    return reactive({ name: '', email: '' });
  }
  // consumer: const user = useUser()  — cannot destructure

  // After
  export function useUser() {
    const name = ref('');
    const email = ref('');
    return { name, email };
  }
  // consumer: const { name, email } = useUser()  — works
  ```

- **Accept refs OR plain values as composable arguments** using `toValue()` or `MaybeRefOrGetter<T>`.

  ```ts
  import { toValue, type MaybeRefOrGetter } from 'vue';

  export function useFormattedDate(date: MaybeRefOrGetter<Date>) {
    return computed(() => toValue(date).toLocaleDateString());
  }

  // Works with both:
  useFormattedDate(new Date());
  useFormattedDate(ref(new Date()));
  useFormattedDate(() => new Date());
  ```

- **Clean up side effects in composables** using `onUnmounted` or return a cleanup function.

  ```ts
  export function useEventListener(
    target: EventTarget,
    event: string,
    handler: EventListener,
  ) {
    onMounted(() => target.addEventListener(event, handler));
    onUnmounted(() => target.removeEventListener(event, handler));
  }
  ```

## Component Design

- **Use `v-if` for type narrowing** before passing nullable values as required props.

  ```vue
  <!-- Before (TS error: possibly null) -->
  <template>
    <UserProfile :user="authStore.user" />
  </template>

  <!-- After -->
  <template>
    <UserProfile v-if="authStore.user" :user="authStore.user" />
  </template>
  ```

- **Use `?? undefined` to convert `null` to `undefined`** for DOM attribute bindings.

  ```vue
  <!-- Before (null is not valid for DOM attributes) -->
  <template>
    <img :src="user.avatar" />
  </template>

  <!-- After -->
  <template>
    <img :src="user.avatar ?? undefined" />
  </template>
  ```

- **Prefer named slots over prop-based render customization** for complex content injection.

  ```vue
  <!-- Before (prop-based) -->
  <DataTable :renderCell="(item) => h('span', item.name)" />

  <!-- After (slot-based) -->
  <DataTable>
    <template #cell="{ item }">
      <span>{{ item.name }}</span>
    </template>
  </DataTable>
  ```

- **Always provide a `:key` on `v-for`** that is a unique, stable identifier — never use array index.

  ```vue
  <!-- Before (anti-pattern — index as key) -->
  <template>
    <div v-for="(item, index) in items" :key="index">{{ item.name }}</div>
  </template>

  <!-- After -->
  <template>
    <div v-for="item in items" :key="item.id">{{ item.name }}</div>
  </template>
  ```

- **Never use `v-if` and `v-for` on the same element.** Use a wrapper `<template>` or `computed` to filter first.

  ```vue
  <!-- Before (anti-pattern) -->
  <template>
    <div v-for="item in items" v-if="item.active" :key="item.id">
      {{ item.name }}
    </div>
  </template>

  <!-- After (computed filter) -->
  <script setup lang="ts">
  const activeItems = computed(() => items.value.filter((i) => i.active));
  </script>
  <template>
    <div v-for="item in activeItems" :key="item.id">
      {{ item.name }}
    </div>
  </template>
  ```

- **Use `<component :is="">` for dynamic components** rather than long `v-if`/`v-else-if` chains.

  ```vue
  <!-- Before -->
  <template>
    <TextMessage v-if="msg.type === 'text'" :msg="msg" />
    <ImageMessage v-else-if="msg.type === 'image'" :msg="msg" />
    <GiphyMessage v-else-if="msg.type === 'giphy'" :msg="msg" />
  </template>

  <!-- After -->
  <script setup lang="ts">
  const componentMap = {
    text: TextMessage,
    image: ImageMessage,
    giphy: GiphyMessage,
  } as const;
  </script>
  <template>
    <component :is="componentMap[msg.type]" :msg="msg" />
  </template>
  ```

## Lifecycle

- **Avoid business logic in `onMounted`** when it can be in `watchEffect` or `watch`. Lifecycle hooks should be for DOM-only interactions.

  ```ts
  // Before
  onMounted(async () => {
    const data = await fetchData(props.id);
    items.value = data;
  });

  // After — reactive to prop changes too
  watch(
    () => props.id,
    async (id) => {
      items.value = await fetchData(id);
    },
    { immediate: true },
  );
  ```

- **Use `onUnmounted` to clean up intervals, timers, listeners, and subscriptions.**

  ```ts
  const intervalId = setInterval(poll, 5000);
  onUnmounted(() => clearInterval(intervalId));
  ```
