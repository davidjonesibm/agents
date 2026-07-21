# TypeScript Typing

Correct TypeScript usage with `create`, `StateCreator`, slices, middleware type stacks, and type extraction.

## Always Use the Curried Form with TypeScript

- With TypeScript, always use the curried form `create<T>()((set) => ...)`. The non-curried form loses the ability to infer generic types when middleware is applied.

  ```typescript
  // Before (non-curried — breaks with middleware, partially infers without)
  const useStore = create<BearState>((set) => ({
    bears: 0,
    increase: (by) => set((s) => ({ bears: s.bears + by })),
  }));

  // After (curried — correct with or without middleware)
  const useStore = create<BearState>()((set) => ({
    bears: 0,
    increase: (by) => set((s) => ({ bears: s.bears + by })),
  }));
  ```

  **Why:** TypeScript cannot partially apply type arguments — currying separates the generic `T` from the inference of `set`/`get`/`store` parameters.

## Define State and Actions in a Single Interface

- Define a single `interface` or `type` for the combined store state + actions. Keep it next to the store definition.

  ```typescript
  // Before — separate interfaces require & intersection everywhere and can drift out of sync
  interface BearStateOnly {
    bears: number;
    foodPerBear: number;
  }
  interface BearActionsOnly {
    addBear: () => void;
    setFood: (n: number) => void;
  }

  // Must write BearStateOnly & BearActionsOnly on every generic parameter — verbose and brittle
  const useBearStore = create<BearStateOnly & BearActionsOnly>()((set) => ({
    bears: 0,
    foodPerBear: 2,
    addBear: () => set((s) => ({ bears: s.bears + 1 })),
    setFood: (n) => set({ foodPerBear: n }),
  }));
  ```

  ```typescript
  // After — single interface; referenced once, used everywhere
  import { create } from 'zustand';

  interface BearStore {
    // State
    bears: number;
    foodPerBear: number;
    // Actions
    addBear: () => void;
    setFood: (n: number) => void;
  }

  const useBearStore = create<BearStore>()((set) => ({
    bears: 0,
    foodPerBear: 2,
    addBear: () => set((s) => ({ bears: s.bears + 1 })),
    setFood: (n) => set({ foodPerBear: n }),
  }));
  ```

## Extracting State Type from an Existing Store

- Use `ExtractState` (from `'zustand'`) or `ReturnType<typeof store.getState>` to derive the state type from a store without re-declaring it.

  ```typescript
  // Before — re-declaring the state type separately; must stay in sync with the store manually
  interface BearStateManual {
    bears: number;
    increasePopulation: () => void;
    removeAllBears: () => void;
    // ❌ if the store gains a new field, this interface silently drifts out of sync
  }
  ```

  ```typescript
  // After — derive the type from the store; always in sync
  import { ExtractState } from 'zustand';

  type BearState = ExtractState<typeof useBearStore>;
  // Equivalent to:
  type BearState = ReturnType<typeof useBearStore.getState>;
  ```

## `StateCreator` Generics for Slices

- Use `StateCreator<FullStore, [], [], Slice>` when authoring slice creators. The four generics are: `State`, `InMutators`, `OutMutators`, `Return`.

  ```typescript
  // Before — untyped slice creator; cross-slice state is any, TypeScript cannot catch errors
  const createBearSlice = (set: any, get: any) => ({
    bears: 0,
    addBear: () => set((state: any) => ({ bears: state.bears + 1 })),
    // ❌ typos in state keys and incorrect slice shapes go undetected
  });
  ```

  ```typescript
  // After — StateCreator generics enforce slice shape and cross-slice access
  import { StateCreator } from 'zustand';

  interface BearSlice {
    bears: number;
    addBear: () => void;
  }
  interface FishSlice {
    fishes: number;
    addFish: () => void;
  }

  // StateCreator<FullStore, InMutators, OutMutators, SliceReturn>
  const createBearSlice: StateCreator<
    BearSlice & FishSlice,
    [],
    [],
    BearSlice
  > = (set) => ({
    bears: 0,
    addBear: () => set((s) => ({ bears: s.bears + 1 })),
  });

  const createFishSlice: StateCreator<
    BearSlice & FishSlice,
    [],
    [],
    FishSlice
  > = (set) => ({
    fishes: 0,
    addFish: () => set((s) => ({ fishes: s.fishes + 1 })),
  });

  const useBoundStore = create<BearSlice & FishSlice>()((...a) => ({
    ...createBearSlice(...a),
    ...createFishSlice(...a),
  }));
  ```

## Typing Middleware Stacks in `StateCreator`

- When a slice needs access to middleware-provided APIs (e.g., `immer`, `devtools`), declare the middleware mutators in the `InMutators` position.

  ```typescript
  // Before — InMutators omitted; TypeScript errors on mutation-style set inside the slice
  const createBearSlice: StateCreator<
    BearSlice & FishSlice,
    [], // ❌ missing ['zustand/immer', never] — set's type does not allow draft mutation
    [],
    BearSlice
  > = (set) => ({
    bears: 0,
    addBear: () =>
      set((s) => {
        s.bears++;
      }), // TS error: cannot assign to 'bears' — read-only
  });
  ```

  ```typescript
  // After — InMutators declares immer; mutation syntax type-checks correctly
  import { StateCreator } from 'zustand';
  import { immer } from 'zustand/middleware/immer';

  // Slice that relies on immer being applied
  const createBearSlice: StateCreator<
    BearSlice & FishSlice,
    [['zustand/immer', never]], // InMutators — immer is applied above this slice
    [],
    BearSlice
  > = (set) => ({
    bears: 0,
    addBear: () =>
      set((s) => {
        s.bears++;
      }), // mutation syntax — immer handles it
  });
  ```

## Typing Middleware Applied to a Full Store

- When applying `devtools`, `persist`, or `immer` to a full store, TypeScript infers the mutator stack automatically from the inline application.

  ```typescript
  // Before — manually annotating the mutator stack; verbose and breaks when middleware order changes
  import { Mutate, StoreApi, UseBoundStore } from 'zustand';

  const useStore: UseBoundStore<
    Mutate<
      StoreApi<MyState>,
      [
        ['zustand/devtools', never],
        ['zustand/persist', MyState],
        ['zustand/immer', never],
      ]
      // ❌ must be updated manually if middleware order or set changes
    >
  > = create<MyState>()(
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
    ),
  );
  ```

  ```typescript
  // After — TypeScript infers mutators from inline application; no extra annotation needed
  import { create } from 'zustand';
  import { devtools, persist } from 'zustand/middleware';
  import { immer } from 'zustand/middleware/immer';

  interface MyState {
    count: number;
    increment: () => void;
  }

  // TypeScript infers mutators from inline application — no extra annotation needed
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
    ),
  );
  ```

## Typing Vanilla Stores

- Use `StoreApi<T>` to type references to vanilla stores. Use `typeof store` when passing to `useStore`.

  ```typescript
  // Before — untyped vanilla store; all getState() calls return any
  const counterStore = createStore()((set: any) => ({
    count: 0,
    increment: () => set((s: any) => ({ count: s.count + 1 })),
  }));

  const count = counterStore.getState().count; // type: any ❌ — no autocomplete or type checking
  ```

  ```typescript
  // After — StoreApi<T> preserves full type safety
  import { createStore, StoreApi } from 'zustand/vanilla'
  import { useStore } from 'zustand'

  interface CounterStore { count: number; increment: () => void }

  const counterStore: StoreApi<CounterStore> = createStore<CounterStore>()((set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
  }))

  function Counter() {
    const count = useStore(counterStore, (s) => s.count)
    return <span>{count}</span>
  }
  ```

## Typing the Context Store Pattern

- When using the React context + vanilla store pattern, type the context value as `StoreApi<T> | null` and throw in the consumer hook when the context is missing.

  ```typescript
  // Before — context typed as non-null with an unsafe cast; missing-provider errors crash at runtime
  const CounterContext = createContext<StoreApi<CounterState>>(
    {} as StoreApi<CounterState>, // ❌ empty object satisfies the type but crashes on getState()
  );
  // No null check in consumer — gives cryptic error instead of clear 'missing provider' message
  ```

  ```typescript
  // After — typed as nullable; consumer hook throws an actionable error
  import { createContext, useContext, useRef } from 'react'
  import { createStore, StoreApi } from 'zustand/vanilla'
  import { useStore } from 'zustand'

  interface CounterState { count: number; increment: () => void }

  const CounterContext = createContext<StoreApi<CounterState> | null>(null)

  export function CounterProvider({ children }: { children: React.ReactNode }) {
    const storeRef = useRef<StoreApi<CounterState>>()
    if (!storeRef.current) {
      storeRef.current = createStore<CounterState>()((set) => ({
        count: 0,
        increment: () => set((s) => ({ count: s.count + 1 })),
      }))
    }
    return <CounterContext.Provider value={storeRef.current}>{children}</CounterContext.Provider>
  }

  export function useCounterStore<T>(selector: (state: CounterState) => T): T {
    const store = useContext(CounterContext)
    if (!store) throw new Error('useCounterStore must be used within CounterProvider')
    return useStore(store, selector)
  }
  ```

## `UseBoundStore` Type (for Store References)

- Use `UseBoundStore<StoreApi<T>>` to type a variable holding a Zustand React hook.

  ```typescript
  import { UseBoundStore, StoreApi } from 'zustand'

  // Before (v3 style — removed in v4/v5)
  const useStore: UseBoundStore<MyState> = create(...)

  // After (v5 correct)
  const useStore: UseBoundStore<StoreApi<MyState>> = create<MyState>()((set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 })),
  }))
  ```
