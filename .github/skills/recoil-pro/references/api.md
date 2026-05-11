# Core API Reference

Current Recoil 0.7.x hook and utility API surface, correct hook selection, and usage guidance.

## Hook Selection Guide

Choose the narrowest hook for the component's need. Over-subscribing causes unnecessary re-renders.

| Hook                            | Reads         | Writes     | Re-renders on change |
| ------------------------------- | ------------- | ---------- | -------------------- |
| `useRecoilValue(state)`         | ✅            | ❌         | ✅                   |
| `useSetRecoilState(state)`      | ❌            | ✅         | ❌                   |
| `useRecoilState(state)`         | ✅            | ✅         | ✅                   |
| `useResetRecoilState(state)`    | ❌            | reset only | ❌                   |
| `useRecoilValueLoadable(state)` | ✅ (Loadable) | ❌         | ✅                   |
| `useRecoilCallback(fn)`         | snapshot      | ✅         | ❌                   |

## useRecoilValue

- Use `useRecoilValue` when the component only reads state. It subscribes the component to re-renders when the atom/selector changes.

  ```tsx
  // Before — useRecoilState used but setter ignored
  function UserName() {
    const [userName] = useRecoilState(userNameState);
    return <span>{userName}</span>;
  }

  // After — useRecoilValue is the correct read-only hook
  function UserName() {
    const userName = useRecoilValue(userNameState);
    return <span>{userName}</span>;
  }
  ```

## useSetRecoilState

- Use `useSetRecoilState` when the component only writes state. Unlike `useRecoilState`, it does **not** subscribe the component to re-renders when the atom changes.

  ```tsx
  // Before — useRecoilState subscribes Form to re-renders even though it only writes
  function Form() {
    const [, setNames] = useRecoilState(namesState);
    return (
      <button onClick={() => setNames((n) => [...n, 'Alice'])}>Add</button>
    );
  }

  // After — useSetRecoilState avoids the subscription
  function Form() {
    const setNames = useSetRecoilState(namesState);
    return (
      <button onClick={() => setNames((n) => [...n, 'Alice'])}>Add</button>
    );
  }
  ```

  **Why:** A component using `useRecoilState` subscribes to the atom and re-renders whenever it changes, even if it never reads the value.

## useResetRecoilState

- Use `useResetRecoilState` to reset an atom to its default value. It does not subscribe the component to re-renders.

  ```tsx
  // Before — manual reset by setting default value (hard-codes the default twice)
  function ResetButton() {
    const setTodos = useSetRecoilState(todoListState);
    return <button onClick={() => setTodos([])}>Reset</button>;
  }

  // After — useResetRecoilState resets to atom's declared default
  import { useResetRecoilState } from 'recoil';

  function ResetButton() {
    const resetTodos = useResetRecoilState(todoListState);
    return <button onClick={resetTodos}>Reset</button>;
  }
  ```

## useRecoilCallback

- Use `useRecoilCallback` to read state outside of render, perform async operations, or write to multiple atoms without subscribing the component to re-renders.

  ```tsx
  // Before — reading state in a click handler with useRecoilValue causes subscription
  function CartButton() {
    const cartItems = useRecoilValue(cartItemsState); // subscribes unnecessarily
    const logCart = () => console.log(cartItems);
    return <button onClick={logCart}>Log Cart</button>;
  }

  // After — useRecoilCallback reads lazily without subscribing
  function CartButton() {
    const logCart = useRecoilCallback(
      ({ snapshot }) =>
        async () => {
          const cartItems = await snapshot.getPromise(cartItemsState);
          console.log(cartItems);
        },
      [],
    );
    return <button onClick={logCart}>Log Cart</button>;
  }
  ```

  The `CallbackInterface` provides: `snapshot`, `gotoSnapshot`, `set`, `reset`, `refresh`, `transact_UNSTABLE`.

## useRecoilValueLoadable

- Use `useRecoilValueLoadable` to handle async selectors without relying on React `Suspense`. Returns a `Loadable` with `state` (`'hasValue' | 'loading' | 'hasError'`) and `contents`.

  ```tsx
  // Before — useRecoilValue on async selector requires Suspense wrapper
  function UserInfo({ userID }: { userID: number }) {
    const name = useRecoilValue(userNameQuery(userID)); // throws Promise if loading
    return <div>{name}</div>;
  }

  // After — useRecoilValueLoadable handles all states inline
  function UserInfo({ userID }: { userID: number }) {
    const loadable = useRecoilValueLoadable(userNameQuery(userID));
    switch (loadable.state) {
      case 'hasValue':
        return <div>{loadable.contents}</div>;
      case 'loading':
        return <div>Loading…</div>;
      case 'hasError':
        return <div>Error: {loadable.contents.message}</div>;
    }
  }
  ```

## RecoilRoot

- Every Recoil-using component tree must be wrapped in `<RecoilRoot>`. Place it at the application root.

  ```tsx
  // Before — Recoil hooks used without RecoilRoot (throws at runtime)
  function App() {
    return <UserInfo />;
  }

  // After — RecoilRoot wraps the component tree
  import { RecoilRoot } from 'recoil';

  function App() {
    return (
      <RecoilRoot>
        <UserInfo />
      </RecoilRoot>
    );
  }
  ```

- Use the `initializeState` prop on `<RecoilRoot>` for synchronous state initialization (e.g., SSR or loading persisted state). Atom effects take precedence over `initializeState`.

  ```tsx
  function App() {
    return (
      <RecoilRoot
        initializeState={({ set }) => {
          set(currentUserIDState, 42);
        }}
      >
        <UserInfo />
      </RecoilRoot>
    );
  }
  ```

- Use `override={false}` on a nested `<RecoilRoot>` to share the ancestor's state scope rather than creating an isolated scope.

  ```tsx
  // Nested root shares parent scope — useful for portals/modals
  function Modal() {
    return (
      <RecoilRoot override={false}>
        <ModalContent />
      </RecoilRoot>
    );
  }
  ```

## useRecoilSnapshot (dev-only)

- **Do not use `useRecoilSnapshot` in production components.** It returns a new `Snapshot` on every Recoil state change, causing the consuming component to re-render for every atom mutation in the entire app.

  ```tsx
  // Before — useRecoilSnapshot in a production component causes massive re-renders
  function UserPanel() {
    const snapshot = useRecoilSnapshot(); // re-renders on any atom change
    const user = snapshot.getLoadable(currentUserState).getValue();
    return <div>{user.name}</div>;
  }

  // After — use useRecoilValue for production reads
  function UserPanel() {
    const user = useRecoilValue(currentUserState);
    return <div>{user.name}</div>;
  }
  ```

  Reserve `useRecoilSnapshot` for debugging observers (see `references/patterns.md`).
