# Vue 3.5+ API — Deprecated Patterns & Modern Replacements

Target: Vue 3.5+ with `<script setup lang="ts">`.

---

- **Never use the Options API** — always use `<script setup>` with Composition API.

  ```vue
  <!-- Before (deprecated) -->
  <script lang="ts">
  export default {
    data() {
      return { count: 0 };
    },
    methods: {
      increment() {
        this.count++;
      },
    },
  };
  </script>

  <!-- After -->
  <script setup lang="ts">
  import { ref } from 'vue';

  const count = ref(0);
  function increment() {
    count.value++;
  }
  </script>
  ```

- **Use `defineModel()` instead of manual `modelValue` prop + `update:modelValue` emit** (Vue 3.4+).

  ```vue
  <!-- Before (deprecated pattern) -->
  <script setup lang="ts">
  const props = defineProps<{ modelValue: string }>();
  const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
  </script>

  <!-- After -->
  <script setup lang="ts">
  const model = defineModel<string>();
  </script>
  ```

  For named models:

  ```vue
  <!-- Before -->
  <script setup lang="ts">
  const props = defineProps<{ title: string }>();
  const emit = defineEmits<{ 'update:title': [value: string] }>();
  </script>

  <!-- After -->
  <script setup lang="ts">
  const title = defineModel<string>('title');
  </script>
  ```

- **Use `useTemplateRef()` instead of `ref(null)` for template element references** (Vue 3.5+).

  ```vue
  <!-- Before (pre-3.5 pattern) -->
  <script setup lang="ts">
  import { ref } from 'vue';
  const inputEl = ref<HTMLInputElement | null>(null);
  </script>
  <template><input ref="inputEl" /></template>

  <!-- After -->
  <script setup lang="ts">
  import { useTemplateRef } from 'vue';
  const inputEl = useTemplateRef<HTMLInputElement>('input');
  </script>
  <template><input ref="input" /></template>
  ```

  **Why:** `useTemplateRef()` provides better type inference and avoids the naming collision between reactive refs and template refs.

- **Use reactive props destructure with defaults instead of `withDefaults`** (Vue 3.5+).

  ```vue
  <!-- Before (3.4 and below) -->
  <script setup lang="ts">
  interface Props {
    msg?: string;
    labels?: string[];
  }
  const props = withDefaults(defineProps<Props>(), {
    msg: 'hello',
    labels: () => ['one', 'two'],
  });
  </script>

  <!-- After (3.5+) -->
  <script setup lang="ts">
  interface Props {
    msg?: string;
    labels?: string[];
  }
  const { msg = 'hello', labels = ['one', 'two'] } = defineProps<Props>();
  </script>
  ```

  **Why:** Reactive props destructure is stable in 3.5+ and is more concise. Destructured props remain reactive.

- **Use the 3.3+ succinct emit syntax** with named tuples instead of call signatures.

  ```vue
  <!-- Before (older call signature syntax) -->
  <script setup lang="ts">
  const emit = defineEmits<{
    (e: 'change', id: number): void;
    (e: 'update', value: string): void;
  }>();
  </script>

  <!-- After (3.3+ named tuple syntax) -->
  <script setup lang="ts">
  const emit = defineEmits<{
    change: [id: number];
    update: [value: string];
  }>();
  </script>
  ```

- **Use type-based `defineProps` instead of runtime declaration** for TypeScript projects.

  ```vue
  <!-- Before (runtime declaration) -->
  <script setup lang="ts">
  const props = defineProps({
    foo: { type: String, required: true },
    bar: Number,
  });
  </script>

  <!-- After (type-based declaration) -->
  <script setup lang="ts">
  const props = defineProps<{
    foo: string;
    bar?: number;
  }>();
  </script>
  ```

- **Use `defineExpose()` to expose component methods/state** instead of relying on `$refs` access.

  ```vue
  <!-- Before (implicit exposure) -->
  <script setup lang="ts">
  const count = ref(0);
  // all bindings exposed by default in non-setup components
  </script>

  <!-- After (explicit with defineExpose) -->
  <script setup lang="ts">
  const count = ref(0);
  const reset = () => {
    count.value = 0;
  };
  defineExpose({ count, reset });
  </script>
  ```

  **Why:** `<script setup>` components are closed by default — you must explicitly expose what parent components can access.

- **Use `defineSlots()` for typed slot props** (Vue 3.3+).

  ```vue
  <!-- Before (untyped slots) -->
  <script setup lang="ts">
  // slots are untyped, no compile-time checks
  </script>
  <template>
    <slot name="item" :data="item" />
  </template>

  <!-- After -->
  <script setup lang="ts">
  defineSlots<{
    item: (props: { data: ItemType }) => void;
  }>();
  </script>
  <template>
    <slot name="item" :data="item" />
  </template>
  ```

- **Avoid `Vue.set()` / `Vue.delete()`** — these are Vue 2 APIs. In Vue 3, reactivity is proxy-based and standard JS mutations are reactive.

  ```ts
  // Before (Vue 2 — does not exist in Vue 3)
  Vue.set(obj, 'newKey', value);
  Vue.delete(obj, 'key');

  // After (Vue 3 — standard JS)
  obj.newKey = value;
  delete obj.key;
  ```

- **Use `app.config.errorHandler` for global error tracking** in production.

  ```ts
  // Before (no error tracking)
  const app = createApp(App);
  app.mount('#app');

  // After
  const app = createApp(App);
  app.config.errorHandler = (err, instance, info) => {
    // report to tracking service (Sentry, etc.)
    console.error(`[Vue Error] ${info}:`, err);
  };
  app.mount('#app');
  ```
