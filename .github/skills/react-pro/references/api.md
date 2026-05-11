# React 19 API Reference

Deprecated APIs, their modern replacements, and new React 19 APIs to prefer — for React 19+.

## New React 19 APIs to Prefer

### `use(promise | context)` — New Data Hook

- **Use `use(promise)` inside Suspense boundaries** to read async values in render. Unlike `useContext`, `use` _can_ be called conditionally.

  ```tsx
  // Before ❌ — fetching in useEffect, complex loading state
  function UserCard({ userId }) {
    const [user, setUser] = useState(null);
    useEffect(() => {
      fetchUser(userId).then(setUser);
    }, [userId]);
    if (!user) return <Spinner />;
    return <div>{user.name}</div>;
  }

  // After ✅ — use() + Suspense, cleaner data flow
  // In a parent component:
  // <Suspense fallback={<Spinner />}><UserCard userPromise={fetchUser(userId)} /></Suspense>
  ('use client');
  import { use } from 'react';

  function UserCard({ userPromise }) {
    const user = use(userPromise); // suspends until resolved
    return <div>{user.name}</div>;
  }
  ```

- **Use `use(context)` conditionally** — unlike `useContext`, `use` is not restricted to top-level unconditional calls for context access.

  ```tsx
  // use() for context can be conditional (useContext cannot)
  function Greeting({ showTheme }) {
    if (showTheme) {
      const theme = use(ThemeContext); // ✅ conditional use() is fine
      return <span style={{ color: theme.color }}>Hello</span>;
    }
    return <span>Hello</span>;
  }
  ```

### `useActionState` — Form Action State Management

- **Use `useActionState` for form submissions** instead of manual `useState` + `useEffect` orchestration. Handles pending state and errors automatically.

  ```tsx
  // Before ❌ — manual orchestration
  function ChangeName() {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState(null);
    async function handleSubmit(e) {
      e.preventDefault();
      setIsPending(true);
      try {
        await updateName(new FormData(e.target).get('name'));
      } catch (err) {
        setError(err.message);
      } finally {
        setIsPending(false);
      }
    }
    return <form onSubmit={handleSubmit}>...</form>;
  }

  // After ✅ — React 19 useActionState
  import { useActionState } from 'react';

  function ChangeName() {
    const [error, submitAction, isPending] = useActionState(
      async (prevState, formData) => {
        const err = await updateName(formData.get('name'));
        if (err) return err;
        redirect('/profile');
        return null;
      },
      null,
    );
    return (
      <form action={submitAction}>
        <input type="text" name="name" />
        <button type="submit" disabled={isPending}>
          Update
        </button>
        {error && <p>{error}</p>}
      </form>
    );
  }
  ```

### `useOptimistic` — Optimistic UI Updates

- **Use `useOptimistic` for immediate feedback** during async mutations. React reverts to the base state if the async action fails.

  ```tsx
  // Before ❌ — manual optimistic state with rollback logic
  const [messages, setMessages] = useState(initialMessages);
  async function send(text) {
    const temp = { id: 'temp', text, sending: true };
    setMessages((prev) => [...prev, temp]);
    try {
      const saved = await sendMessage(text);
      setMessages((prev) => prev.map((m) => (m.id === 'temp' ? saved : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== 'temp'));
    }
  }

  // After ✅ — useOptimistic handles reversion automatically
  import { useOptimistic } from 'react';

  function Thread({ messages, sendMessage }) {
    const [optimisticMessages, addOptimistic] = useOptimistic(
      messages,
      (state, newText) => [...state, { text: newText, sending: true }],
    );
    async function formAction(formData) {
      addOptimistic(formData.get('message'));
      await sendMessage(formData);
    }
    return (
      <>
        {optimisticMessages.map((m, i) => (
          <div key={i}>
            {m.text}
            {m.sending && <small> (Sending...)</small>}
          </div>
        ))}
        <form action={formAction}>
          <input type="text" name="message" />
          <button type="submit">Send</button>
        </form>
      </>
    );
  }
  ```

### `useFormStatus` (react-dom) — Form Pending State in Child Components

- **Use `useFormStatus` to read parent form submission state** without prop drilling. Must be used inside a component that is a child of a `<form>`.

  ```tsx
  // Before ❌ — threading isPending through props
  function SubmitButton({ isPending }) {
    return (
      <button type="submit" disabled={isPending}>
        Submit
      </button>
    );
  }

  // After ✅ — useFormStatus reads from parent <form> automatically
  import { useFormStatus } from 'react-dom';

  function SubmitButton() {
    const { pending } = useFormStatus();
    return (
      <button type="submit" disabled={pending}>
        Submit
      </button>
    );
  }
  ```

## Deprecated APIs and Their Replacements

### `forwardRef` → `ref` as a direct prop (React 19)

- **In React 19, function components accept `ref` as a regular prop.** `forwardRef` is no longer needed and will be deprecated in a future release. Existing `forwardRef` usage still works.

  ```tsx
  // Before (React 18 and earlier — still works in 19)
  const MyInput = forwardRef(function MyInput({ placeholder }, ref) {
    return <input placeholder={placeholder} ref={ref} />;
  });

  // After ✅ — React 19: ref as a plain prop
  function MyInput({ placeholder, ref }) {
    return <input placeholder={placeholder} ref={ref} />;
  }
  // Usage: <MyInput ref={inputRef} placeholder="Enter name" />
  ```

### `<Context.Provider>` → `<Context>` as provider (React 19)

- **In React 19, render `<Context value={...}>` directly** instead of `<Context.Provider value={...}>`. Both still work but `<Context>` is the preferred modern form.

  ```tsx
  // Before (React 18 — still works in 19)
  <ThemeContext.Provider value="dark">
    <App />
  </ThemeContext.Provider>

  // After ✅ — React 19
  <ThemeContext value="dark">
    <App />
  </ThemeContext>
  ```

### `ReactDOM.render` → `createRoot` (React 18+, required)

- **Never use `ReactDOM.render`.** It was removed in React 19 (deprecated in 18). Use `createRoot` for client rendering.

  ```tsx
  // Before ❌ — removed in React 19
  import ReactDOM from 'react-dom';
  ReactDOM.render(<App />, document.getElementById('root'));

  // After ✅
  import { createRoot } from 'react-dom/client';
  createRoot(document.getElementById('root')!).render(<App />);
  ```

### `ReactDOM.hydrate` → `hydrateRoot` (React 18+, required)

- **Never use `ReactDOM.hydrate`.** Use `hydrateRoot` from `react-dom/client` for SSR hydration.

  ```tsx
  // Before ❌
  ReactDOM.hydrate(<App />, document.getElementById('root'));

  // After ✅
  import { hydrateRoot } from 'react-dom/client';
  hydrateRoot(document.getElementById('root')!, <App />);
  ```

### Class Components → Function Components with Hooks

- **Don't write new class components.** They still work but receive no new features. All class lifecycle methods have hook equivalents.

  ```tsx
  // Before ❌ — class component (legacy)
  class Counter extends React.Component {
    state = { count: 0 };
    increment = () => this.setState((s) => ({ count: s.count + 1 }));
    render() {
      return <button onClick={this.increment}>{this.state.count}</button>;
    }
  }

  // After ✅ — function component
  function Counter() {
    const [count, setCount] = useState(0);
    return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
  }
  ```

### `React.createFactory` — Removed in React 19

- **`React.createFactory` was removed.** Use JSX directly or `React.createElement`.

  ```tsx
  // Before ❌ — removed
  const button = React.createFactory('button');
  button({ type: 'submit' }, 'Click me');

  // After ✅
  <button type="submit">Click me</button>;
  // or: React.createElement('button', { type: 'submit' }, 'Click me')
  ```

### `ReactElement["props"]` Type Change (TypeScript)

- **`ReactElement` props typing changed in React 19** — see also `references/typescript.md` for the full rule with before/after examples.

## Stable APIs to Keep Using

| API                | Notes                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| `createContext`    | Unchanged; use `<Context value={...}>` in React 19 instead of `.Provider` |
| `memo`             | Unchanged; may be redundant when React Compiler is active                 |
| `lazy`             | Unchanged; use with `Suspense` for code splitting                         |
| `Suspense`         | Unchanged; now also works with `use(promise)`                             |
| `startTransition`  | Unchanged; wraps non-urgent state updates                                 |
| `useTransition`    | Unchanged; returns `[isPending, startTransition]`                         |
| `useDeferredValue` | Unchanged; defers rendering of slow subtrees                              |
