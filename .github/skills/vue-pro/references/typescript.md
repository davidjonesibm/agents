# TypeScript Patterns in Vue 3

Target: Vue 3.5+ with `<script setup lang="ts">`. See also `references/api.md` for API-level type patterns.

---

## Props Typing

- **Always use type-based `defineProps<T>()`** instead of runtime prop declarations.

  ```vue
  <!-- Before (runtime declaration — less type-safe) -->
  <script setup lang="ts">
  import type { PropType } from 'vue';
  const props = defineProps({
    user: { type: Object as PropType<User>, required: true },
    count: { type: Number, default: 0 },
  });
  </script>

  <!-- After (type-based declaration) -->
  <script setup lang="ts">
  interface Props {
    user: User;
    count?: number;
  }
  const props = defineProps<Props>();
  </script>
  ```

- **Extract prop interfaces to named types** when they are complex or shared.

  ```vue
  <script setup lang="ts">
  // Good — named interface, easy to export/reuse
  interface Props {
    message: MessageWithSender;
    isNewSender: boolean;
  }
  const props = defineProps<Props>();
  </script>
  ```

- **Use reactive props destructure for defaults** (Vue 3.5+) instead of `withDefaults`.

  ```vue
  <!-- Before (3.4 pattern) -->
  <script setup lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
  }
  const props = withDefaults(defineProps<Props>(), {
    size: 'md',
    disabled: false,
  });
  </script>

  <!-- After (3.5+ destructure) -->
  <script setup lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
  }
  const { size = 'md', disabled = false } = defineProps<Props>();
  </script>
  ```

## Emits Typing

- **Use named tuple syntax** for typed emits (Vue 3.3+).

  ```vue
  <!-- Before (call signature syntax) -->
  <script setup lang="ts">
  const emit = defineEmits<{
    (e: 'select', id: string): void;
    (e: 'close'): void;
  }>();
  </script>

  <!-- After (named tuple syntax — preferred) -->
  <script setup lang="ts">
  const emit = defineEmits<{
    select: [id: string];
    close: [];
  }>();
  </script>
  ```

## Refs Typing

- **Let `ref()` infer types from initial values** — only annotate when the type is wider than the initial value.

  ```ts
  // Good — type inferred as Ref<number>
  const count = ref(0);

  // Good — explicit because initial value doesn't capture full type
  const user = ref<User | null>(null);

  // Bad — redundant annotation
  const count = ref<number>(0);
  ```

- **Type template refs with `useTemplateRef<T>()`** (Vue 3.5+). Fall back to `ref<T | null>(null)` with explicit type for pre-3.5.

  ```vue
  <script setup lang="ts">
  import { useTemplateRef } from 'vue';
  const inputEl = useTemplateRef<HTMLInputElement>('input');
  // inputEl.value is HTMLInputElement | null
  </script>
  <template><input ref="input" /></template>
  ```

- **Type component template refs using `InstanceType<typeof Component>`.**

  ```vue
  <script setup lang="ts">
  import { useTemplateRef } from 'vue';
  import MyModal from './MyModal.vue';

  type MyModalInstance = InstanceType<typeof MyModal>;
  const modal = useTemplateRef<MyModalInstance>('modal');

  function openModal() {
    modal.value?.open();
  }
  </script>
  <template><MyModal ref="modal" /></template>
  ```

## Computed Typing

- **Let `computed()` infer its return type.** Only annotate when the inference is wrong or too wide.

  ```ts
  // Good — inferred as ComputedRef<number>
  const total = computed(() =>
    items.value.reduce((sum, i) => sum + i.price, 0),
  );

  // Only annotate when needed
  const result = computed<string | null>(() => {
    return condition ? 'yes' : null;
  });
  ```

## Provide / Inject Typing

- **Use `InjectionKey<T>` for type-safe provide/inject.** Place keys in a shared file.

  ```ts
  // keys.ts
  import type { InjectionKey } from 'vue';

  export const ThemeKey: InjectionKey<'light' | 'dark'> = Symbol('theme');
  ```

  ```vue
  <!-- Provider -->
  <script setup lang="ts">
  import { provide } from 'vue';
  import { ThemeKey } from './keys';
  provide(ThemeKey, 'dark'); // type-checked
  </script>

  <!-- Consumer -->
  <script setup lang="ts">
  import { inject } from 'vue';
  import { ThemeKey } from './keys';
  const theme = inject(ThemeKey); // type: 'light' | 'dark' | undefined
  const theme = inject(ThemeKey, 'light'); // type: 'light' | 'dark'
  </script>
  ```

- **Avoid string injection keys in TypeScript** — the injected type will be `unknown`.

  ```ts
  // Before (untyped)
  const val = inject('theme'); // type: unknown

  // After (typed with InjectionKey)
  const val = inject(ThemeKey); // type: 'light' | 'dark' | undefined
  ```

## Event Handler Typing

- **Explicitly type DOM event handler arguments.** Use type assertions for `event.target`.

  ```vue
  <script setup lang="ts">
  function handleInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    // ...
  }
  </script>
  <template>
    <input @input="handleInput" />
  </template>
  ```

## Slots Typing

- **Use `defineSlots()` for typed scoped slots** (Vue 3.3+).

  ```vue
  <script setup lang="ts">
  defineSlots<{
    default: (props: { item: ItemType; index: number }) => void;
    header: () => void;
  }>();
  </script>
  ```

## Generic Components

- **Use the `generic` attribute on `<script setup>`** for generic components (Vue 3.3+).

  ```vue
  <script setup lang="ts" generic="T extends { id: string }">
  interface Props {
    items: T[];
    selected?: T;
  }
  const props = defineProps<Props>();
  const emit = defineEmits<{
    select: [item: T];
  }>();
  </script>
  <template>
    <div v-for="item in items" :key="item.id" @click="emit('select', item)">
      <slot :item="item" />
    </div>
  </template>
  ```

## Type Narrowing Patterns

- **Use `v-if` for template-level type narrowing** of nullable store values.

  ```vue
  <!-- Before (TS error: possibly null) -->
  <template>
    <span>{{ authStore.user.name }}</span>
  </template>

  <!-- After -->
  <template>
    <span v-if="authStore.user">{{ authStore.user.name }}</span>
  </template>
  ```

- **Use early returns for control-flow narrowing** instead of the `!` non-null assertion operator.

  ```ts
  // Before (unsafe)
  function sendMessage() {
    const channelId = chatStore.currentChannelId!;
    ws.send({ channelId });
  }

  // After (safe)
  function sendMessage() {
    const channelId = chatStore.currentChannelId;
    if (!channelId) return;
    ws.send({ channelId });
  }
  ```

- **Use `?? undefined` instead of `!` for nullable-to-optional conversions** in DOM bindings.

  ```vue
  <!-- Before (unsafe assertion) -->
  <img :src="user.avatar!" />

  <!-- After (safe coalescing) -->
  <img :src="user.avatar ?? undefined" />
  ```
