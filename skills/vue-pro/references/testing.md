# Testing Vue 3 Components and Composables

Target: Vitest + `@vue/test-utils` with Vue 3.5+ and TypeScript.

---

## Test Setup

- **Configure Vitest with `happy-dom`** for DOM simulation in `vite.config.ts`.

  ```ts
  // vite.config.ts
  export default defineConfig({
    test: {
      globals: true,
      environment: 'happy-dom',
    },
  });
  ```

- **Add `vitest/globals` to `tsconfig.json`** to enable global test APIs without imports.

  ```json
  {
    "compilerOptions": {
      "types": ["vitest/globals"]
    }
  }
  ```

## Component Testing

- **Test components through their public interface** — props, emits, slots, and rendered output. Never test internal state.

  ```ts
  // Good — tests behavior
  import { mount } from '@vue/test-utils';
  import Counter from './Counter.vue';

  test('increments count on button click', async () => {
    const wrapper = mount(Counter, { props: { initial: 0 } });

    await wrapper.find('[data-testid="increment"]').trigger('click');

    expect(wrapper.find('[data-testid="count"]').text()).toBe('1');
  });

  // Bad — tests internal state
  test('increments count', () => {
    const wrapper = mount(Counter);
    // DON'T access internal component state
    expect(wrapper.vm.count).toBe(0);
  });
  ```

- **Use `data-testid` attributes** for selecting elements in tests — not CSS classes or element types.

  ```vue
  <!-- Component -->
  <template>
    <button data-testid="submit-btn" @click="submit">Submit</button>
  </template>
  ```

  ```ts
  // Test
  await wrapper.find('[data-testid="submit-btn"]').trigger('click');
  ```

- **Mount with required plugins** (Pinia, Router) using the `global` option.

  ```ts
  import { mount } from '@vue/test-utils';
  import { createTestingPinia } from '@pinia/testing';
  import { createRouter, createMemoryHistory } from 'vue-router';
  import ChatView from './ChatView.vue';

  test('renders chat view', () => {
    const wrapper = mount(ChatView, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              chat: { messages: [], loading: false },
            },
          }),
          createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/chat', component: ChatView }],
          }),
        ],
      },
    });

    expect(wrapper.exists()).toBe(true);
  });
  ```

- **Test emitted events** using `wrapper.emitted()`.

  ```ts
  test('emits select event on click', async () => {
    const wrapper = mount(ItemList, {
      props: { items: [{ id: '1', name: 'Test' }] },
    });

    await wrapper.find('[data-testid="item-1"]').trigger('click');

    expect(wrapper.emitted('select')).toHaveLength(1);
    expect(wrapper.emitted('select')![0]).toEqual(['1']);
  });
  ```

- **Test slots** by providing slot content and asserting rendered output.

  ```ts
  test('renders slot content', () => {
    const wrapper = mount(Card, {
      slots: {
        header: '<h2>Title</h2>',
        default: '<p>Body content</p>',
      },
    });

    expect(wrapper.find('h2').text()).toBe('Title');
    expect(wrapper.find('p').text()).toBe('Body content');
  });
  ```

- **Test async components** by using `await flushPromises()` or `await nextTick()`.

  ```ts
  import { flushPromises } from '@vue/test-utils';

  test('loads data on mount', async () => {
    vi.spyOn(api, 'fetchMessages').mockResolvedValue([mockMessage]);

    const wrapper = mount(MessageList);
    await flushPromises();

    expect(wrapper.findAll('[data-testid="message"]')).toHaveLength(1);
  });
  ```

## Composable Testing

- **Test composables that use only reactivity APIs** by invoking them directly — no component wrapper needed.

  ```ts
  // composables/useCounter.ts
  export function useCounter(initial = 0) {
    const count = ref(initial);
    const increment = () => count.value++;
    return { count, increment };
  }

  // composables/useCounter.test.ts
  import { useCounter } from './useCounter';

  test('useCounter increments', () => {
    const { count, increment } = useCounter(5);
    expect(count.value).toBe(5);

    increment();
    expect(count.value).toBe(6);
  });
  ```

- **Test composables that use lifecycle hooks or provide/inject** by wrapping them in a host component.

  ```ts
  import { createApp } from 'vue';

  function withSetup<T>(
    composable: () => T,
  ): [T, ReturnType<typeof createApp>] {
    let result!: T;
    const app = createApp({
      setup() {
        result = composable();
        return () => {};
      },
    });
    app.mount(document.createElement('div'));
    return [result, app];
  }

  test('useFoo with lifecycle', () => {
    const [result, app] = withSetup(() => useFoo());
    expect(result.value.value).toBe('initial');
    app.unmount(); // triggers onUnmounted
  });
  ```

## Pinia Store Testing

- **Use `@pinia/testing` with `createTestingPinia`** for isolated store tests.

  ```ts
  import { setActivePinia, createPinia } from 'pinia';
  import { useChatStore } from './chatStore';

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('addMessage adds to messages array', () => {
    const store = useChatStore();
    const msg = { id: '1', content: 'hello' } as MessageWithSender;

    store.addMessage(msg);

    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].id).toBe('1');
  });
  ```

- **Test store actions that make API calls** by mocking the API layer.

  ```ts
  import { setActivePinia, createPinia } from 'pinia';
  import { useChannelStore } from './channelStore';
  import * as api from '../lib/api';

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('fetchChannels populates channels', async () => {
    const mockChannels = [{ id: '1', name: 'general' }];
    vi.spyOn(api, 'apiFetch').mockResolvedValue(mockChannels);

    const store = useChannelStore();
    await store.fetchChannels('group-1');

    expect(store.channels).toEqual(mockChannels);
    expect(store.loading).toBe(false);
  });

  test('fetchChannels sets error on failure', async () => {
    vi.spyOn(api, 'apiFetch').mockRejectedValue(new Error('Network error'));

    const store = useChannelStore();
    await expect(store.fetchChannels('group-1')).rejects.toThrow();

    expect(store.loading).toBe(false);
  });
  ```

- **Provide initial state in component tests** using `createTestingPinia`.

  ```ts
  const wrapper = mount(ChatView, {
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            auth: { user: mockUser, token: 'mock-token' },
            chat: { messages: [mockMessage], connected: true },
          },
          stubActions: false, // set to true to auto-stub all actions
        }),
      ],
    },
  });
  ```

## Mocking

- **Mock API calls with `vi.spyOn`** — don't mock the entire module unless necessary.

  ```ts
  // Good — targeted spy
  vi.spyOn(api, 'apiFetch').mockResolvedValue(mockData);

  // Less ideal — replaces entire module
  vi.mock('../lib/api', () => ({
    apiFetch: vi.fn().mockResolvedValue(mockData),
  }));
  ```

- **Mock `window`/`navigator` APIs** for PWA-related composable tests.

  ```ts
  test('usePush detects support', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ pushManager: {} }) },
      configurable: true,
    });

    const { isSupported } = usePush();
    expect(isSupported.value).toBe(true);
  });
  ```

## Anti-Patterns

- **Don't test implementation details** — test what the component renders and emits, not internal refs or computed values.

- **Don't use snapshot tests as the primary assertion** — they break on any change and provide low confidence.

  ```ts
  // Bad — fragile
  expect(wrapper.html()).toMatchSnapshot();

  // Good — intentional assertions
  expect(wrapper.find('h1').text()).toBe('Welcome');
  ```

- **Don't test Vue framework behavior** — trust that `v-if`, `v-for`, etc. work correctly. Test your logic.

See also `references/state.md` for Pinia store patterns and `references/patterns.md` for composable design.
