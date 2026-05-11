# React Performance Optimization

Memoization, concurrent features, rendering optimization, and code splitting — for React 19+.

## React Compiler (React 19 Toolchains)

- **When the React Compiler is active, don't add manual `memo`, `useMemo`, or `useCallback` without profiling first.** The compiler auto-memoizes components and values. Manual memoization on top of compiler output is redundant and adds noise.

  ```tsx
  // Before — unnecessary manual memoization when compiler is active
  const expensiveValue = useMemo(() => compute(a, b), [a, b]);
  const stableCallback = useCallback(() => doSomething(x), [x]);
  const MemoChild = memo(Child);

  // After ✅ (compiler active) — write plain code; compiler handles it
  const expensiveValue = compute(a, b);
  const handleClick = () => doSomething(x);
  // render <Child> directly
  ```

  **When compiler is NOT active:** use `memo`, `useMemo`, `useCallback` deliberately as described below.

## `memo` — Skip Re-renders of Pure Components

- **Wrap a component in `memo` when it renders frequently with the same props** and re-rendering is expensive. `memo` does a shallow reference comparison of props — it is useless without stable prop references.

  ```tsx
  // Before ❌ — ShippingForm re-renders on every parent render
  function ProductPage({ productId }) {
    const handleSubmit = (details) => post('/buy', details); // new ref every render
    return <ShippingForm onSubmit={handleSubmit} />;
  }

  // After ✅ — stable ref + memo = skip re-render
  import { memo, useCallback } from 'react';

  const ShippingForm = memo(function ShippingForm({ onSubmit }) {
    // only re-renders when onSubmit reference changes
    return <form onSubmit={onSubmit}>...</form>;
  });

  function ProductPage({ productId, referrer }) {
    const handleSubmit = useCallback(
      (details) => {
        post('/product/' + productId + '/buy', { referrer, details });
      },
      [productId, referrer],
    ); // stable reference ✅
    return <ShippingForm onSubmit={handleSubmit} />;
  }
  ```

## `useMemo` — Cache Expensive Computations

- **Use `useMemo` for computationally expensive derived values** (sorting, filtering, heavy math). Don't use it for trivial operations — the memoization overhead can exceed the savings.

  ```tsx
  // Before ❌ — filterTodos runs on every render, including unrelated state changes
  function TodoList({ todos, tab, theme }) {
    const visibleTodos = filterTodos(todos, tab); // expensive, runs every render
    return <ul>{visibleTodos.map(...)}</ul>;
  }

  // After ✅ — cached, recomputes only when todos or tab changes
  function TodoList({ todos, tab, theme }) {
    const visibleTodos = useMemo(
      () => filterTodos(todos, tab),
      [todos, tab] // theme not included — theme changes don't recompute
    );
    return <ul>{visibleTodos.map(...)}</ul>;
  }
  ```

- **Use `useMemo` to produce a stable object/array reference** for memoized children or context values (see also `references/patterns.md`).

## `useCallback` — Stable Function References

- **`useCallback` is only useful when the function is passed to a `memo`-wrapped component or used as an effect dependency.** Don't wrap every function in `useCallback` — it has its own overhead.

  ```tsx
  // Unnecessary ❌ — result of useCallback is only used locally
  function Counter() {
    const increment = useCallback(() => setCount((c) => c + 1), []); // no benefit here
    return <button onClick={increment}>+</button>;
  }

  // Justified ✅ — passed as prop to memo'd child
  function Parent() {
    const handleChange = useCallback((val) => processChange(val), []);
    return <MemoizedChild onChange={handleChange} />;
  }
  ```

## `useTransition` — Non-Blocking State Updates

- **Wrap non-urgent state updates in `startTransition`** to keep the UI responsive. React will interrupt the transition rendering if higher-priority updates (e.g., typing) arrive.

  ```tsx
  // Before ❌ — tab switch blocks the UI for a slow tab
  function TabContainer() {
    const [tab, setTab] = useState('home');
    return (
      <>
        <TabButton onClick={() => setTab('posts')}>Posts</TabButton>
        <SlowPostsTab hidden={tab !== 'posts'} />
      </>
    );
  }

  // After ✅ — tab switch is non-blocking
  import { useState, useTransition } from 'react';

  function TabContainer() {
    const [tab, setTab] = useState('home');
    const [isPending, startTransition] = useTransition();
    function selectTab(nextTab) {
      startTransition(() => setTab(nextTab));
    }
    return (
      <>
        <TabButton onClick={() => selectTab('posts')}>
          Posts {isPending && '...'}
        </TabButton>
        <SlowPostsTab hidden={tab !== 'posts'} />
      </>
    );
  }
  ```

## `useDeferredValue` — Defer Slow Subtree Rendering

- **Use `useDeferredValue` to keep an input responsive while a downstream list lags.** The deferred value trails behind the real value; React renders with the old value first, then updates when capacity allows.

  ```tsx
  // Before ❌ — SearchResults blocks on every keystroke
  function SearchPage() {
    const [query, setQuery] = useState('');
    return (
      <>
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
        <SearchResults query={query} /> {/* slow re-render on every key */}
      </>
    );
  }

  // After ✅ — input stays snappy, results update when idle
  import { useState, useDeferredValue, Suspense } from 'react';

  function SearchPage() {
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);
    const isStale = query !== deferredQuery;
    return (
      <>
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
        <div style={{ opacity: isStale ? 0.5 : 1 }}>
          <Suspense fallback={<Spinner />}>
            <SearchResults query={deferredQuery} />
          </Suspense>
        </div>
      </>
    );
  }
  ```

## Code Splitting with `React.lazy` and `Suspense`

- **Lazy-load heavy components with `React.lazy`** to reduce initial bundle size. Always pair with a `Suspense` boundary.

  ```tsx
  // Before ❌ — heavy chart library loaded eagerly
  import { HeavyChart } from './HeavyChart';
  function Dashboard() {
    return <HeavyChart data={data} />;
  }

  // After ✅ — loaded only when rendered
  import { lazy, Suspense } from 'react';
  const HeavyChart = lazy(() => import('./HeavyChart'));

  function Dashboard() {
    return (
      <Suspense fallback={<Spinner />}>
        <HeavyChart data={data} />
      </Suspense>
    );
  }
  ```

## List Rendering

- **Always provide a stable, unique `key` prop** for list items to allow React to reconcile efficiently. See also `references/patterns.md` for key selection rules.

  ```tsx
  // Before ❌ — index as key causes incorrect reconciliation when items reorder or are removed
  items.map((item, index) => <Row key={index} data={item} />);

  // After ✅ — stable entity ID as key
  items.map((item) => <Row key={item.id} data={item} />);
  ```

- **Virtualize long lists** (100+ items) with a windowing library (e.g., `@tanstack/react-virtual`, `react-window`). Rendering thousands of DOM nodes at once is the most common React performance killer.

  ```tsx
  // Before ❌ — renders 10,000 DOM nodes upfront
  function LongList({ items }) {
    return (
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    );
  }

  // After ✅ — virtual scroll, only visible rows are in the DOM
  import { useRef } from 'react';
  import { useVirtualizer } from '@tanstack/react-virtual';

  function LongList({ items }) {
    const parentRef = useRef(null);
    const rowVirtualizer = useVirtualizer({
      count: items.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 35,
    });
    return (
      <div ref={parentRef} style={{ height: '500px', overflow: 'auto' }}>
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {items[virtualRow.index].name}
            </div>
          ))}
        </div>
      </div>
    );
  }
  ```

## Avoid Creating New References in JSX

- **Don't create inline object or array literals as props** when passing to memoized components — they produce a new reference on every render, defeating `memo`.

  ```tsx
  // Before ❌ — new style object every render, memo is useless
  <MemoButton style={{ color: 'red' }} />;

  // After ✅ — stable reference
  const buttonStyle = { color: 'red' }; // module-level constant
  <MemoButton style={buttonStyle} />;
  ```

- **Inline arrow functions on memoized children break memoization.** Extract or `useCallback` them.

  ```tsx
  // Before ❌ — new function on every parent render
  <MemoList onSelect={(id) => handleSelect(id)} />

  // After ✅
  const handleSelect = useCallback((id) => { ... }, []);
  <MemoList onSelect={handleSelect} />
  ```

## Profiling Before Optimizing

- **Always measure with React DevTools Profiler before adding memoization.** Over-memoization adds maintenance cost and can introduce bugs via stale closures. Optimize only confirmed hot paths.

  ```tsx
  // Before ❌ — blindly memoizing without evidence of a problem
  function ProductList({ products, discount }) {
    // useMemo added "just in case" — no profiling done
    const discounted = useMemo(
      () => products.map((p) => ({ ...p, price: p.price * discount })),
      [products, discount],
    );
    return (
      <ul>
        {discounted.map((p) => (
          <li key={p.id}>
            {p.name}: ${p.price}
          </li>
        ))}
      </ul>
    );
  }

  // After ✅ — profile first, then memoize only where DevTools shows excess render time
  // Step 1: Record a Profiler session; confirm ProductList is a hot path.
  // Step 2: Add useMemo only after confirming the computation is the bottleneck.
  function ProductList({ products, discount }) {
    const discounted = useMemo(
      () => products.map((p) => ({ ...p, price: p.price * discount })),
      [products, discount], // added after profiler confirmed this was slow
    );
    return (
      <ul>
        {discounted.map((p) => (
          <li key={p.id}>
            {p.name}: ${p.price}
          </li>
        ))}
      </ul>
    );
  }
  ```
