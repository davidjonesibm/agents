# Idiomatic Patterns

Correct Zustand store patterns, action co-location, slices, derived state, and common anti-patterns.

## Co-locate State and Actions

- Keep actions inside the store alongside the state they mutate. Do not split actions into separate files or objects unless using the slices pattern.

  ```typescript
  // Before (anti-pattern — actions split from store)
  const useCountStore = create<{ count: number }>()(() => ({ count: 0 }));
  const increment = () =>
    useCountStore.setState((s) => ({ count: s.count + 1 }));

  // After — actions co-located inside store
  const useCountStore = create<{ count: number; increment: () => void }>()(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }),
  );
  ```

## Derived State Belongs in Selectors, Not the Store

- Never store values that can be computed from existing state. Compute them in the selector instead.

  ```typescript
  // Before (anti-pattern — totalFood duplicates data)
  interface BearState {
    bears: number
    foodPerBear: number
    totalFood: number // redundant
  }
  const useBearStore = create<BearState>()((set) => ({
    bears: 3,
    foodPerBear: 2,
    totalFood: 6,
    addBear: () => set((s) => ({ bears: s.bears + 1, totalFood: (s.bears + 1) * s.foodPerBear })),
  }))

  // After — compute in the selector, no duplication
  interface BearState {
    bears: number
    foodPerBear: number
  }
  const useBearStore = create<BearState>()(() => ({ bears: 3, foodPerBear: 2 }))

  function TotalFood() {
    const totalFood = useBearStore((s) => s.bears * s.foodPerBear)
    return <div>{totalFood} jars needed</div>
  }
  ```

## Slices Pattern for Large Stores

- Use the slices pattern to split large stores into focused `StateCreator` functions that are merged at the store level.

  ```typescript
  // bearSlice.ts
  import { StateCreator } from 'zustand';

  export interface BearSlice {
    bears: number;
    addBear: () => void;
  }

  export const createBearSlice: StateCreator<
    BearSlice & FishSlice,
    [],
    [],
    BearSlice
  > = (set) => ({
    bears: 0,
    addBear: () => set((state) => ({ bears: state.bears + 1 })),
  });

  // fishSlice.ts
  export interface FishSlice {
    fishes: number;
    addFish: () => void;
  }

  export const createFishSlice: StateCreator<
    BearSlice & FishSlice,
    [],
    [],
    FishSlice
  > = (set) => ({
    fishes: 0,
    addFish: () => set((state) => ({ fishes: state.fishes + 1 })),
  });

  // store.ts — combine at the store level
  import { create } from 'zustand';
  import { createBearSlice, BearSlice } from './bearSlice';
  import { createFishSlice, FishSlice } from './fishSlice';

  export const useBoundStore = create<BearSlice & FishSlice>()((...a) => ({
    ...createBearSlice(...a),
    ...createFishSlice(...a),
  }));
  ```

- Apply middleware at the combined store level, not within individual slice creators.

  ```typescript
  // Before (anti-pattern — persist applied per slice)
  const createBearSlice = persist(
    (set) => ({
      bears: 0,
      addBear: () => set((s) => ({ bears: s.bears + 1 })),
    }),
    { name: 'bears' },
  );

  // After — persist wraps the combined store
  export const useBoundStore = create<BearSlice & FishSlice>()(
    persist(
      (...a) => ({
        ...createBearSlice(...a),
        ...createFishSlice(...a),
      }),
      { name: 'bound-store' },
    ),
  );
  ```

## Cross-Slice Actions

- Access sibling slice state/actions in a cross-slice action using `get()`.

  ```typescript
  import { StateCreator } from 'zustand';

  interface SharedSlice {
    addBoth: () => void;
    getBoth: () => number;
  }

  const createSharedSlice: StateCreator<
    BearSlice & FishSlice,
    [],
    [],
    SharedSlice
  > = (set, get) => ({
    addBoth: () => {
      get().addBear();
      get().addFish();
    },
    getBoth: () => get().bears + get().fishes,
  });
  ```

## Accessing Store Outside React Components

- Use `store.getState()` to read state and `store.setState()` to mutate outside of React components. Never call the hook outside a component.

  ```typescript
  // Before (anti-pattern — calling hook outside component)
  const bears = useBearStore.getState; // typo-prone; and hooks can't be called outside React
  const resetEverything = () => {
    useBearStore(); // ❌ invalid outside React
  };

  // After — use store utility methods
  const resetEverything = () => {
    useBearStore.setState({ bears: 0 });
    // or
    useBearStore.getState().removeAllBears();
  };
  ```

## Avoid Storing Transient / Non-UI State in Zustand

- Do not put state that doesn't affect rendering (e.g., timers, WebSocket references, request abort controllers) into Zustand stores. Use refs instead.

  ```typescript
  // Before (anti-pattern — timer ID in Zustand store causes unnecessary re-renders)
  const useStore = create<{ timerId: number | null; startTimer: () => void }>()(
    (set) => ({
      timerId: null,
      startTimer: () => set({ timerId: window.setTimeout(() => {}, 1000) }),
    }),
  );

  // After — timer reference stays in a ref
  const timerId = useRef<number | null>(null);
  const startTimer = () => {
    timerId.current = window.setTimeout(() => {}, 1000);
  };
  ```

## Stable Selector Fallbacks (v5 Behavioral Change)

- In v5, selectors that return a new reference on every call (even for the same logical value) can trigger infinite loops. Ensure fallback values are stable references.

  ```typescript
  // Before (v4 — allowed, v5 may infinite loop)
  const action = useMainStore((state) => state.action ?? () => {})
  //                                                    ^^^^^^^^ new function on every render

  // After — hoist the fallback outside the component
  const FALLBACK_ACTION = () => {}
  const action = useMainStore((state) => state.action ?? FALLBACK_ACTION)
  ```

## Auto-Generated Selectors Utility

- Use the `createSelectors` utility pattern to avoid repetitive selector boilerplate in larger codebases.

  ```typescript
  import { StoreApi, UseBoundStore } from 'zustand';

  type WithSelectors<S> = S extends { getState: () => infer T }
    ? S & { use: { [K in keyof T]: () => T[K] } }
    : never;

  function createSelectors<S extends UseBoundStore<StoreApi<object>>>(
    _store: S,
  ) {
    const store = _store as WithSelectors<typeof _store>;
    store.use = {} as any;
    for (const k of Object.keys(store.getState())) {
      (store.use as any)[k] = () => store((s: any) => s[k]);
    }
    return store;
  }

  // Usage
  const useBearStoreBase = create<BearState>()((set) => ({
    bears: 0,
    increment: () => set((s) => ({ bears: s.bears + 1 })),
  }));
  const useBearStore = createSelectors(useBearStoreBase);

  // In components — no manual selectors needed
  const bears = useBearStore.use.bears();
  const increment = useBearStore.use.increment();
  ```
