# Middleware

Correct usage of `persist`, `devtools`, `immer`, `subscribeWithSelector`, `combine`, and custom middleware.

## Middleware Application Order

- Apply middleware from the **outside in**: `devtools` outermost, then `persist`, then `immer`. The outermost middleware is applied last and wraps all others.

  ```typescript
  import { create } from 'zustand';
  import { devtools, persist } from 'zustand/middleware';
  import { immer } from 'zustand/middleware/immer';

  // Correct order: devtools → persist → immer → state creator
  const useStore = create<MyState>()(
    devtools(
      persist(
        immer((set) => ({
          count: 0,
          increment: () =>
            set((s) => {
              s.count++;
            }),
        })),
        { name: 'my-store' },
      ),
      { name: 'MyStore' },
    ),
  );
  ```

- Apply middleware directly inline (not via a helper variable) for best TypeScript inference.

  ```typescript
  // Before (loses TypeScript contextual inference)
  const myMiddlewares = (f: any) => devtools(persist(f, { name: 'store' }));
  const useStore = create<MyState>()(
    myMiddlewares((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    })),
  );

  // After (inline — correct inference)
  const useStore = create<MyState>()(
    devtools(
      persist(
        (set) => ({
          count: 0,
          increment: () => set((s) => ({ count: s.count + 1 })),
        }),
        { name: 'store' },
      ),
    ),
  );
  ```

## `persist` — State Persistence

All imports from `'zustand/middleware'`.

- Wrap a state creator with `persist` to automatically save and restore state from `localStorage` (default).

  ```typescript
  import { create } from 'zustand';
  import { persist, createJSONStorage } from 'zustand/middleware';

  interface SettingsStore {
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
  }

  const useSettingsStore = create<SettingsStore>()(
    persist(
      (set) => ({
        theme: 'light',
        setTheme: (theme) => set({ theme }),
      }),
      {
        name: 'app-settings', // localStorage key (must be unique per store)
        storage: createJSONStorage(() => localStorage), // explicit, default is localStorage
      },
    ),
  );
  ```

- Use `partialize` to persist only a subset of state (exclude actions, derived values, or sensitive fields).

  ```typescript
  // Before — no partialize; action functions are serialized as null in localStorage
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 14,
      setTheme: (t: 'light' | 'dark') => set({ theme: t }),
    }),
    {
      name: 'app-settings',
      // ❌ setTheme is stored as null — hydrated store has a broken action
    },
  );
  ```

  ```typescript
  // After — partialize excludes non-serializable actions
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 14,
      setTheme: (t) => set({ theme: t }),
    }),
    {
      name: 'app-settings',
      partialize: (state) => ({ theme: state.theme, fontSize: state.fontSize }),
      // actions are excluded — they are not serializable
    },
  );
  ```

- Use `version` and `migrate` to handle storage schema changes across app versions.

  ```typescript
  // Before — no version/migrate; renamed field causes undefined values after an app update
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 14,
      setTheme: (t: 'light' | 'dark') => set({ theme: t }),
    }),
    {
      name: 'app-settings',
      // ❌ old storage has 'textSize' key; after rename to 'fontSize', hydrated value is undefined
    },
  );
  ```

  ```typescript
  // After — version + migrate transforms old shape to new shape on hydration
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 14,
      setTheme: (t) => set({ theme: t }),
    }),
    {
      name: 'app-settings',
      version: 2,
      migrate: (persisted: any, version) => {
        if (version < 2) {
          persisted.fontSize = persisted.textSize ?? 14; // renamed field
          delete persisted.textSize;
        }
        return persisted;
      },
    },
  );
  ```

- Use `createJSONStorage(() => sessionStorage)` for session-scoped persistence.

  ```typescript
  // Before — localStorage keeps data after the browser tab closes; wrong for session-only data
  storage: createJSONStorage(() => localStorage); // ❌ persists across browser sessions

  // After — sessionStorage scopes data to the current tab session
  storage: createJSONStorage(() => sessionStorage);
  ```

- Use `skipHydration: true` when you need manual control over when state is rehydrated (e.g., SSR, React Native).

  ```typescript
  // Before — automatic hydration in SSR causes server/client state mismatch
  persist(
    (set) => ({ data: null }),
    { name: 'my-store' },
    // ❌ server renders with null; client immediately rehydrates from localStorage → hydration mismatch
  );
  ```

  ```typescript
  // After — skipHydration defers rehydration until the client is ready
  persist((set) => ({ data: null }), { name: 'my-store', skipHydration: true });

  // Later, manually rehydrate
  useMyStore.persist.rehydrate();
  ```

- **v5 Breaking Change:** `persist` no longer writes initial state to storage at store creation time. Explicitly set dynamic initial state with `setState` after store creation.

  ```typescript
  // Before (v4 — initial state written to storage automatically)
  const useStore = create(
    persist(() => ({ count: Math.random() * 100 }), { name: 'store' }),
  );

  // After (v5 — set initial dynamic state explicitly)
  const useStore = create(persist(() => ({ count: 0 }), { name: 'store' }));
  useStore.setState({ count: Math.floor(Math.random() * 100) });
  ```

### `persist` API on the store

| Method                                 | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| `useStore.persist.clearStorage()`      | Remove all persisted data for this store                  |
| `useStore.persist.setOptions(partial)` | Dynamically update persist options (e.g., switch storage) |
| `useStore.persist.rehydrate()`         | Manually trigger rehydration (when `skipHydration: true`) |
| `useStore.persist.hasHydrated()`       | Check if store has been rehydrated                        |

## `devtools` — Redux DevTools Integration

All imports from `'zustand/middleware'`.

- Wrap a state creator with `devtools` to enable Redux DevTools support. Provide `name` to distinguish stores in the DevTools panel.

  ```typescript
  import { devtools } from 'zustand/middleware';

  const useStore = create<BearState>()(
    devtools(
      (set) => ({
        bears: 0,
        increase: (by) =>
          set((state) => ({ bears: state.bears + by }), false, 'bear/increase'),
        //                                                                       ^^^^^^^^^^^^ action name in DevTools
      }),
      { name: 'BearStore' },
    ),
  );
  ```

- Pass an action name as the third argument to `set` for readable DevTools labels.

  ```typescript
  // Before — action shows as "anonymous" in DevTools
  increase: (by) => set((s) => ({ bears: s.bears + by }));

  // After — labeled in DevTools
  increase: (by) =>
    set((s) => ({ bears: s.bears + by }), false, 'bear/increase');
  ```

## `immer` — Immutable Updates with Mutation Syntax

Import from `'zustand/middleware/immer'` (not `'zustand/middleware'`).

- Wrap a state creator with `immer` to use mutation-style updates on deeply nested state. Immer converts mutations into immutable operations.

  ```typescript
  import { create } from 'zustand';
  import { immer } from 'zustand/middleware/immer';

  interface TodoState {
    todos: Record<string, { title: string; done: boolean }>;
    toggle: (id: string) => void;
  }

  const useTodoStore = create<TodoState>()(
    immer((set) => ({
      todos: {},
      toggle: (id) =>
        set((state) => {
          state.todos[id].done = !state.todos[id].done;
          // Immer converts this mutation to an immutable update
        }),
    })),
  );
  ```

  ```typescript
  // Before (without immer — verbose spread for nested updates)
  toggle: (id) =>
    set((state) => ({
      todos: {
        ...state.todos,
        [id]: { ...state.todos[id], done: !state.todos[id].done },
      },
    }));

  // After (with immer — mutation syntax, same result)
  toggle: (id) =>
    set((state) => {
      state.todos[id].done = !state.todos[id].done;
    });
  ```

- Inside `immer` set callbacks, you can either mutate the draft **or** return a new state — not both.

  ```typescript
  // Mutation — modifies draft in place
  set((state) => {
    state.count++;
  });

  // Return — replaces state (no mutation)
  set((_state) => ({ count: 0 }));

  // ❌ Wrong — both mutation and return in the same callback
  set((state) => {
    state.count++;
    return { count: 0 };
  });
  ```

## `subscribeWithSelector` — Granular Reactive Subscriptions

Import from `'zustand/middleware'`. See also `references/performance.md` for usage patterns.

- Use `subscribeWithSelector` to add selector + equality function support to `subscribe`. Best for vanilla stores driving side effects outside React.

  ```typescript
  import { createStore } from 'zustand/vanilla';
  import { subscribeWithSelector } from 'zustand/middleware';

  const store = createStore<GameStore>()(
    subscribeWithSelector((set) => ({
      score: 0,
      level: 1,
      addScore: (pts) => set((s) => ({ score: s.score + pts })),
    })),
  );

  const unsubScore = store.subscribe(
    (state) => state.score, // selector
    (score, prevScore) => console.log(`${prevScore} → ${score}`), // listener
    { fireImmediately: true }, // optional: fire on subscribe
  );
  ```

## `combine` — Inferred Slice Types

Import from `'zustand/middleware'`.

- Use `combine` when you want automatic TypeScript inference for separate state and actions without manually declaring the combined type.

  ```typescript
  // Before — manually declaring the combined type is redundant when combine can infer it
  interface BearFishStore {
    bears: number;
    fishes: number;
    addBear: () => void;
    addFish: () => void;
  }

  const useStore = create<BearFishStore>()((set) => ({
    bears: 0,
    fishes: 0,
    addBear: () => set((s) => ({ bears: s.bears + 1 })),
    addFish: () => set((s) => ({ fishes: s.fishes + 1 })),
  }));
  ```

  ```typescript
  // After — combine infers the full type from the initial state and actions
  import { create } from 'zustand';
  import { combine } from 'zustand/middleware';

  const useStore = create(
    combine(
      { bears: 0, fishes: 0 }, // initial state — type inferred
      (set) => ({
        // actions — type inferred from state
        addBear: () => set((s) => ({ bears: s.bears + 1 })),
        addFish: () => set((s) => ({ fishes: s.fishes + 1 })),
      }),
    ),
  );
  ```

## Custom Middleware

- Implement custom middleware using `StateCreator` and `StoreMutatorIdentifier`. The pattern involves an outer type-level signature and an inner implementation function.

  ```typescript
  // Before — naïve middleware using any; loses TypeScript inference and doesn't compose correctly
  const logger = (config: any) => (set: any, get: any, api: any) =>
    config(
      (...args: any[]) => {
        console.log('state:', get());
        set(...args);
      },
      get,
      api,
    );
  // ❌ useStore is inferred as UseBoundStore<StoreApi<any>> — no type safety downstream
  ```

  ```typescript
  // After — typed middleware using StateCreator and StoreMutatorIdentifier
  import { create, StateCreator, StoreMutatorIdentifier } from 'zustand';

  // Type-level signature — preserves existing mutators
  type Logger = <
    T,
    Mps extends [StoreMutatorIdentifier, unknown][] = [],
    Mcs extends [StoreMutatorIdentifier, unknown][] = [],
  >(
    f: StateCreator<T, Mps, Mcs>,
    name?: string,
  ) => StateCreator<T, Mps, Mcs>;

  // Implementation
  type LoggerImpl = <T>(
    f: StateCreator<T, [], []>,
    name?: string,
  ) => StateCreator<T, [], []>;

  const loggerImpl: LoggerImpl = (f, name) => (set, get, store) => {
    const loggedSet: typeof set = (...args) => {
      set(...(args as Parameters<typeof set>));
      console.log(name ? `[${name}]` : '', get());
    };
    return f(loggedSet, get, store);
  };

  export const logger = loggerImpl as unknown as Logger;

  // Usage
  const useStore = create<BearState>()(
    logger(
      (set) => ({
        bears: 0,
        increase: (by) => set((s) => ({ bears: s.bears + by })),
      }),
      'BearStore',
    ),
  );
  ```
