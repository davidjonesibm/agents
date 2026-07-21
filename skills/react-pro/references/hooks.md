# React Hooks Best Practices

All built-in hook rules, custom hook conventions, and the Rules of Hooks — for React 19+.

## Rules of Hooks (Critical — linted by eslint-plugin-react-hooks)

- **Never call hooks conditionally.** Move any early return _after_ all hook calls. React preserves state by hook call order — a missing call corrupts that order.

  ```tsx
  // Before ❌ — hook after conditional return
  function Profile({ userId, show }) {
    if (!show) return null;
    const [name, setName] = useState(''); // called only when show=true
    return <input value={name} onChange={(e) => setName(e.target.value)} />;
  }

  // After ✅ — all hooks called unconditionally at the top
  function Profile({ userId, show }) {
    const [name, setName] = useState('');
    if (!show) return null;
    return <input value={name} onChange={(e) => setName(e.target.value)} />;
  }
  ```

- **Only call hooks at the top level of a function component or custom hook.** Never call them inside loops, nested functions, or callbacks.

  ```tsx
  // Before ❌ — hook inside a loop
  function List({ items }) {
    return items.map((item) => {
      const [checked, setChecked] = useState(false); // ❌ inside map
      return (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => setChecked((v) => !v)}
        />
      );
    });
  }

  // After ✅ — lift each item into its own component
  function CheckItem({ label }) {
    const [checked, setChecked] = useState(false);
    return (
      <input
        type="checkbox"
        checked={checked}
        onChange={() => setChecked((v) => !v)}
      />
    );
  }
  function List({ items }) {
    return items.map((item) => <CheckItem key={item.id} label={item.label} />);
  }
  ```

- **Only call hooks from React function components or custom hooks.** Never from plain utility functions, class components, or event callbacks outside React.

  ```tsx
  // Before ❌ — hook in a plain function
  function getOnlineStatus() {
    return useSyncExternalStore(subscribe, getSnapshot); // ❌ not a component or hook
  }

  // After ✅ — wrapped in a custom hook
  function useOnlineStatus() {
    return useSyncExternalStore(subscribe, getSnapshot); // ✅ prefixed with `use`
  }
  ```

## useState

- **Use a functional updater when next state depends on previous state.** Avoids stale closure bugs under concurrent rendering.

  ```tsx
  // Before ❌ — reads stale `count` from closure
  setCount(count + 1);

  // After ✅ — always gets the latest state
  setCount((prev) => prev + 1);
  ```

- **Use a lazy initializer for expensive initial state.** Pass a function, not a computed value — the function runs only on mount.

  ```tsx
  // Before ❌ — computeExpensiveValue() runs on every render
  const [value, setValue] = useState(computeExpensiveValue(props.data));

  // After ✅ — computeExpensiveValue() runs only once
  const [value, setValue] = useState(() => computeExpensiveValue(props.data));
  ```

- **Don't store derived values in state.** Compute them during render instead — see also `references/patterns.md` (Derived State section) for the full rule with before/after examples.

## useEffect

- **Always return a cleanup function when the effect subscribes to external systems.** Missing cleanup causes memory leaks and stale listeners.

  ```tsx
  // Before ❌ — no cleanup, listener accumulates on every render
  useEffect(() => {
    window.addEventListener('resize', handleResize);
  }, []);

  // After ✅
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  ```

- **Include all reactive values in the dependency array.** Use `eslint-plugin-react-hooks/exhaustive-deps` to catch missing deps. Missing deps produce stale closure bugs.

  ```tsx
  // Before ❌ — roomId missing from deps, effect won't re-run on change
  useEffect(() => {
    const conn = connect(roomId);
    return () => conn.close();
  }, []); // eslint-disable-line — suppressing is a code smell

  // After ✅
  useEffect(() => {
    const conn = connect(roomId);
    return () => conn.close();
  }, [roomId]);
  ```

- **Don't use effects to derive state.** Compute derived values during render, or use an event handler for user-driven changes.

  ```tsx
  // Before ❌ — extra render cycle, unnecessary effect
  const [doubled, setDoubled] = useState(0);
  useEffect(() => {
    setDoubled(count * 2);
  }, [count]);

  // After ✅ — derived during render, zero extra renders
  const doubled = count * 2;
  ```

- **Extract complex effect logic into purpose-driven custom hooks.** Keep the component body declarative.

  ```tsx
  // Before ❌ — effect logic embedded in component
  useEffect(() => {
    const conn = createConnection({ serverUrl, roomId });
    conn.connect();
    return () => conn.disconnect();
  }, [serverUrl, roomId]);

  // After ✅ — encapsulated in a named hook
  useChatRoom({ serverUrl, roomId });
  ```

- **Use `useLayoutEffect` only when you must read layout synchronously** (measuring DOM dimensions, synchronous scroll position). It blocks painting — misusing it hurts perceived performance. Prefer `useEffect` for everything else.

  ```tsx
  // Before ❌ — useEffect: tooltip position flickers because DOM paint happens before measurement
  function Tooltip({ anchorRef, children }) {
    const [pos, setPos] = useState({ top: 0, left: 0 });
    useEffect(() => {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom, left: rect.left }); // runs after paint — visible flicker
    }, [anchorRef]);
    return <div style={{ position: 'fixed', ...pos }}>{children}</div>;
  }

  // After ✅ — useLayoutEffect: measurement and position update happen before paint
  import { useLayoutEffect, useState } from 'react';

  function Tooltip({ anchorRef, children }) {
    const [pos, setPos] = useState({ top: 0, left: 0 });
    useLayoutEffect(() => {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom, left: rect.left }); // runs before paint — no flicker
    }, [anchorRef]);
    return <div style={{ position: 'fixed', ...pos }}>{children}</div>;
  }
  ```

## useRef

- **Don't read or write refs during rendering.** Refs are for side-effect logic (DOM access, timers, subscriptions). Reading during render makes the component impure.

  ```tsx
  // Before ❌ — reading ref during render is impure
  function Badge({ count }) {
    const prevRef = useRef(0);
    if (prevRef.current !== count) {
      // ❌ read during render
      prevRef.current = count;
    }
    return <span>{count}</span>;
  }

  // After ✅ — ref mutation inside effect
  function Badge({ count }) {
    const prevRef = useRef(0);
    useEffect(() => {
      prevRef.current = count;
    });
    return <span>{count}</span>;
  }
  ```

- **Use `useRef(null)` for DOM node access, not state.** Storing a DOM node in state causes unnecessary re-renders.

  ```tsx
  // Before ❌ — DOM node in state triggers re-render on mount
  const [inputEl, setInputEl] = useState(null);
  return <input ref={setInputEl} />;

  // After ✅
  const inputRef = useRef(null);
  return <input ref={inputRef} />;
  ```

## useContext

- **Memoize the context value object to prevent unnecessary re-renders** of all consumers when unrelated state changes.

  ```tsx
  // Before ❌ — new object on every render re-renders all consumers
  function App() {
    const [user, setUser] = useState(null);
    return (
      <AuthContext value={{ user, setUser }}>
        <Page />
      </AuthContext>
    );
  }

  // After ✅
  import { useMemo, useCallback } from 'react';
  function App() {
    const [user, setUser] = useState(null);
    const login = useCallback((u) => setUser(u), []);
    const ctx = useMemo(() => ({ user, login }), [user, login]);
    return (
      <AuthContext value={ctx}>
        <Page />
      </AuthContext>
    );
  }
  ```

## useReducer

- **Prefer `useReducer` over multiple `useState` calls when state variables are updated together.** Reducers centralize the transition logic and are easier to test.

  ```tsx
  // Before ❌ — three states that always change together
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // After ✅
  const [state, dispatch] = useReducer(fetchReducer, {
    status: 'idle',
    data: null,
    error: null,
  });
  // fetchReducer handles 'loading', 'success', 'error' transitions
  ```

## useId

- **Use `useId()` for accessibility IDs** (`htmlFor`, `aria-describedby`). Never use `Math.random()` or indexes — IDs must be stable across server and client renders.

  ```tsx
  // Before ❌ — unstable, breaks SSR hydration
  const id = `input-${Math.random()}`;

  // After ✅
  const id = useId(); // stable, SSR-safe
  return (
    <>
      <label htmlFor={id}>Name</label>
      <input id={id} type="text" />
    </>
  );
  ```

## useSyncExternalStore

- **Use `useSyncExternalStore` to subscribe to external stores** (Redux without React-Redux, browser APIs like `navigator.onLine`). It is concurrent-mode safe. Do not use `useEffect` + `useState` for this pattern.

  ```tsx
  // Before ❌ — race condition under concurrent mode
  function useOnline() {
    const [online, setOnline] = useState(navigator.onLine);
    useEffect(() => {
      const handler = () => setOnline(navigator.onLine);
      window.addEventListener('online', handler);
      window.addEventListener('offline', handler);
      return () => {
        window.removeEventListener('online', handler);
        window.removeEventListener('offline', handler);
      };
    }, []);
    return online;
  }

  // After ✅ — concurrent-mode safe
  function useOnline() {
    return useSyncExternalStore(
      (cb) => {
        window.addEventListener('online', cb);
        window.addEventListener('offline', cb);
        return () => {
          window.removeEventListener('online', cb);
          window.removeEventListener('offline', cb);
        };
      },
      () => navigator.onLine,
      () => true, // serverSnapshot
    );
  }
  ```

## Custom Hooks

- **Always prefix custom hooks with `use`.** This tells the linter to enforce Rules of Hooks and signals intent to readers.

  ```tsx
  // Before ❌ — linter won't enforce hook rules inside this
  function fetchUser(id) { ... }

  // After ✅
  function useUser(id) { ... }
  ```

- **Don't prefix non-hook utility functions with `use`.** They don't call hooks; the prefix is misleading and disables linter optimizations.

  ```tsx
  // Before ❌
  function useSorted(items) {
    return items.slice().sort(); // no hooks inside — misleading prefix
  }

  // After ✅
  function getSorted(items) {
    return items.slice().sort();
  }
  ```

- **Wrap functions returned from custom hooks in `useCallback`** so consumers can safely use them as effect dependencies.

  ```tsx
  // Before ❌ — navigate changes reference every render, breaking consumers' deps
  function useRouter() {
    const { dispatch } = useContext(RouterCtx);
    const navigate = (url) => dispatch({ type: 'navigate', url });
    return { navigate };
  }

  // After ✅
  function useRouter() {
    const { dispatch } = useContext(RouterCtx);
    const navigate = useCallback(
      (url) => dispatch({ type: 'navigate', url }),
      [dispatch],
    );
    return { navigate };
  }
  ```

- **Define custom hooks at module level, never inside components.** Hooks defined inside components are recreated on every render, breaking identity and hook ordering.

  ```tsx
  // Before ❌ — hook factory inside component
  function MyComponent() {
    function useLocalData() { ... } // recreated every render
    const data = useLocalData();
  }

  // After ✅
  function useLocalData() { ... } // module-level, stable
  function MyComponent() {
    const data = useLocalData();
  }
  ```
