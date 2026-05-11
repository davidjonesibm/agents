# Core API Reference

Correct usage of Zustand v5's `create`, `createStore`, `useStore`, and store utility methods. Covers deprecated v4 APIs and their v5 replacements.

## Named Imports (v5 Breaking Change)

- **Always use named imports.** Zustand v5 dropped all default exports.

  ```typescript
  // Before (v4 — default export)
  import create from 'zustand';

  // After (v5 — named export)
  import { create } from 'zustand';
  ```

## `create` — React Store Hook

- Use `create` from `'zustand'` to create a React hook-based store.

  ```typescript
  import { create } from 'zustand';

  interface BearState {
    bears: number;
    increasePopulation: () => void;
    removeAllBears: () => void;
  }

  const useBearStore = create<BearState>()((set) => ({
    bears: 0,
    increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
    removeAllBears: () => set({ bears: 0 }),
  }));
  ```

- Use the curried form `create<T>()((set) => ...)` with TypeScript — the non-curried form breaks type inference when middleware is added. See also `references/typescript.md`.

  ```typescript
  // Before (non-curried — TypeScript inference breaks with middleware)
  const useStore = create<MyState>((set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
  }));

  // After (curried — correct for TypeScript)
  const useStore = create<MyState>()((set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
  }));
  ```

## `createStore` — Vanilla Store (No React)

- Use `createStore` from `'zustand/vanilla'` for framework-agnostic stores. Returns an API object (`getState`, `setState`, `subscribe`, `getInitialState`) instead of a hook.

  ```typescript
  import { createStore } from 'zustand/vanilla';

  const counterStore = createStore<{ count: number; increment: () => void }>()(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }),
  );

  counterStore.getState().increment();
  console.log(counterStore.getState().count); // 1

  const unsubscribe = counterStore.subscribe((state, prevState) => {
    console.log(`${prevState.count} → ${state.count}`);
  });
  ```

- Use `useStore` from `'zustand'` to bind a vanilla store to a React component.

  ```tsx
  import { useStore } from 'zustand';
  import { counterStore } from './counterStore';

  function Counter() {
    const count = useStore(counterStore, (state) => state.count);
    return <span>{count}</span>;
  }
  ```

## `set` and `get` Parameters

- Use the functional form of `set` when the new state depends on the previous state. Zustand merges partial state — full replacement requires `replace: true`.

  ```typescript
  // Before — reading stale state directly in the action
  const useStore = create<State>()((set) => ({
    count: 0,
    double: () => set({ count: useStore.getState().count * 2 }), // anti-pattern
  }));

  // After — use functional set or get
  const useStore = create<State>()((set, get) => ({
    count: 0,
    double: () => set((state) => ({ count: state.count * 2 })),
    doubleWithGet: () => set({ count: get().count * 2 }),
  }));
  ```

- Pass `replace: true` as the second argument to `setState` only when fully replacing state (v5 enforces this with stricter types).

  ```typescript
  // Partial update (default — merges)
  useBearStore.setState({ bears: 5 });

  // Full replacement (requires complete state object in v5)
  useBearStore.setState(
    { bears: 5, increasePopulation: () => {}, removeAllBears: () => {} },
    true,
  );
  ```

## `getInitialState`

- Use `store.getInitialState()` to retrieve the original state for store resets in tests. See also `references/testing.md`.

  ```typescript
  const initial = useBearStore.getInitialState();
  useBearStore.setState(initial, true); // full reset
  ```

## v4 Custom Equality in `create` (Breaking Change)

- `create` in v5 no longer accepts a custom equality function as a second argument. Use `useShallow` (preferred) or `createWithEqualityFn` from `'zustand/traditional'`.

  ```typescript
  // Before (v4 — second arg equality)
  import { shallow } from 'zustand/shallow';
  const { a, b } = useStore((state) => ({ a: state.a, b: state.b }), shallow);

  // After (v5 — useShallow hook)
  import { useShallow } from 'zustand/react/shallow';
  const { a, b } = useStore(
    useShallow((state) => ({ a: state.a, b: state.b })),
  );
  ```

  ```typescript
  // After (v5 — createWithEqualityFn for store-level custom equality)
  import { createWithEqualityFn } from 'zustand/traditional';
  import { shallow } from 'zustand/shallow';

  const useStore = createWithEqualityFn<MyState>()(
    (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }),
    shallow,
  );
  ```

## Deprecated Context API (v4)

- `createContext` from `'zustand/context'` is removed in v5. Use React's `createContext` with a vanilla store ref pattern instead.

  ```typescript
  // Before (v4 — removed in v5)
  import { createContext } from 'zustand/context'
  const { Provider, useStore } = createContext<MyState>()

  // After (v5 — React context + useStore)
  import { createContext, useContext, useRef } from 'react'
  import { createStore } from 'zustand/vanilla'
  import { useStore } from 'zustand'

  const StoreContext = createContext<ReturnType<typeof createStore<MyState>> | null>(null)

  function StoreProvider({ children }: { children: React.ReactNode }) {
    const storeRef = useRef<ReturnType<typeof createStore<MyState>>>()
    if (!storeRef.current) {
      storeRef.current = createStore<MyState>()((set) => ({
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 })),
      }))
    }
    return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>
  }

  function useMyStore<T>(selector: (state: MyState) => T): T {
    const store = useContext(StoreContext)
    if (!store) throw new Error('useMyStore must be used within StoreProvider')
    return useStore(store, selector)
  }
  ```
