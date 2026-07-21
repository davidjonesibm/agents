# Performance Optimization

Selector granularity, `useShallow`, subscription patterns, and re-render prevention strategies.

## Use Granular Selectors to Limit Re-renders

- Subscribe to the smallest possible slice of state. A component re-renders whenever the selected value changes (by reference equality by default).

  ```tsx
  // Before — subscribes to the entire store; re-renders on any state change
  function BearCounter() {
    const state = useBearStore();
    return <h1>{state.bears} bears</h1>;
  }

  // After — subscribes only to `bears`; ignores unrelated state changes
  function BearCounter() {
    const bears = useBearStore((state) => state.bears);
    return <h1>{bears} bears</h1>;
  }
  ```

## Wrap Object and Array Selectors with `useShallow`

- Selectors returning a new object or array literal on every call cause infinite re-render loops in v5 (and unnecessary re-renders in v4). Wrap them with `useShallow`.

  ```tsx
  import { useShallow } from 'zustand/react/shallow';

  // Before — new object reference every render → infinite loop in v5
  function UserInfo() {
    const { firstName, lastName } = useUserStore((state) => ({
      firstName: state.firstName,
      lastName: state.lastName,
    }));
    return (
      <p>
        {firstName} {lastName}
      </p>
    );
  }

  // After — shallow comparison; re-renders only when firstName or lastName change
  function UserInfo() {
    const { firstName, lastName } = useUserStore(
      useShallow((state) => ({
        firstName: state.firstName,
        lastName: state.lastName,
      })),
    );
    return (
      <p>
        {firstName} {lastName}
      </p>
    );
  }
  ```

- `useShallow` also works with array and keys selections.

  ```tsx
  // Array selection
  const [firstName, lastName] = useUserStore(
    useShallow((state) => [state.firstName, state.lastName]),
  );

  // Keys extraction
  const keys = useUserStore(useShallow((state) => Object.keys(state)));
  ```

## Prefer Primitive Selectors Over Object Selectors

- When selecting multiple primitive values from a large store, prefer multiple single-value hooks over one object selector. Each hook renders independently, reducing unnecessary work.

  ```tsx
  // Before — one combined selector re-renders the whole component on any change
  const { count, label } = useStore(
    useShallow((s) => ({ count: s.count, label: s.label })),
  );

  // After — two atomic subscriptions; each re-renders independently
  const count = useStore((s) => s.count);
  const label = useStore((s) => s.label);
  ```

  **When to prefer the object selector:** the two values are always used together and always change together. In that case, `useShallow` is fine.

## Transient Updates with `subscribe` + `useRef`

- For state that drives non-visual logic (animations, WebGL, audio), use `subscribe` + `useRef` to track state without triggering re-renders.

  ```tsx
  // Before — subscribing via the hook re-renders the component on every position change
  function Canvas() {
    const position = useScratchStore((state) => state.position); // ❌ re-renders on every frame
    useEffect(() => {
      drawFrame(position);
    }, [position]);
    return <canvas />;
  }

  // After — subscribe + useRef tracks state without triggering re-renders
  import { useEffect, useRef } from 'react';

  function Canvas() {
    const positionRef = useRef(useScratchStore.getState().position);

    useEffect(() => {
      // Read initial state
      positionRef.current = useScratchStore.getState().position;

      // Subscribe to changes — does NOT re-render the component
      const unsub = useScratchStore.subscribe((state) => {
        positionRef.current = state.position;
      });
      return unsub; // unsubscribe on unmount
    }, []);

    // Use positionRef.current in animation loop, not React state
    return <canvas />;
  }
  ```

## `subscribeWithSelector` for Reactive Side Effects Outside React

- Use the `subscribeWithSelector` middleware when you need to react to specific state slices outside of React without re-rendering anything. Provides selector + equality function support on `subscribe`.

  > See `references/middleware.md` — **`subscribeWithSelector` — Granular Reactive Subscriptions** for the full API signature, import path, and usage example with `fireImmediately`.

## `createWithEqualityFn` for Store-Level Custom Equality

- When you need deep or custom equality (not shallow), use `createWithEqualityFn` from `'zustand/traditional'` instead of `useShallow` per selector.

  ```typescript
  // Before — repeating useShallow on every selector across the codebase
  function BearCount() {
    const { bears } = useBearStore(useShallow((s) => ({ bears: s.bears }))) // repetitive
    return <span>{bears}</span>
  }
  function BearLabel() {
    const { label } = useBearStore(useShallow((s) => ({ label: s.label }))) // repetitive
    return <p>{label}</p>
  }

  // After — createWithEqualityFn applies shallow comparison to all selectors by default
  import { createWithEqualityFn } from 'zustand/traditional'
  import { shallow } from 'zustand/shallow'

  // All selectors on this store use shallow comparison by default
  const useBearStore = createWithEqualityFn<BearState>()(
    (set) => ({ bears: 0, increase: (n) => set((s) => ({ bears: s.bears + n })) }),
    shallow,
  )
  ```

  **Note:** requires `use-sync-external-store` as a peer dependency (`npm install use-sync-external-store`).

## Action Selectors Are Stable — No `useShallow` Needed

- Functions (actions) defined in the store are stable references because `set` always returns the same action. You do not need `useShallow` when selecting only actions.

  ```tsx
  // Before — wrapping action selectors in useShallow; unnecessary overhead
  const addBear = useBearStore(useShallow((state) => state.addBear)); // ❌ useShallow not needed
  const { addBear, addFish } = useBearStore(
    useShallow((state) => ({ addBear: state.addBear, addFish: state.addFish })), // ❌ still unnecessary
  );

  // After — action references are stable; select them without useShallow
  const addBear = useBearStore((state) => state.addBear);
  ```

  **Why:** Zustand only calls the selector's equality check (reference equality by default) when state changes. Actions are created once and never reassigned, so the reference never changes.
