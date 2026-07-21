# Performance — Caching, staleTime, gcTime, and Optimization

Rules for configuring TanStack Query caching correctly and avoiding performance pitfalls.

---

## Set `staleTime` to Non-Zero for Stable Data

- **Set a non-zero `staleTime` for data that doesn't change on every request.** The default is `0`, meaning every component mount triggers a background refetch.

  ```typescript
  // Before (default staleTime: 0 — refetches on every mount)
  useQuery({ queryKey: ['config'], queryFn: fetchConfig });

  // After (data is fresh for 5 minutes — no background refetch)
  useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  ```

  **Why:** With `staleTime: 0`, mounting the same component in two places fires two background requests. For static or slow-changing server data, this is wasteful.

---

## Understand `gcTime` — Garbage Collection, Not Cache Expiry

- **Do not confuse `gcTime` with `staleTime`.** `staleTime` controls when data is considered fresh. `gcTime` controls how long _unused_ query data stays in memory before being garbage collected (default: 5 minutes). Data is never evicted while it has active subscribers.

  ```typescript
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // Data is "fresh" for 1 minute — no background refetch
        gcTime: 10 * 60 * 1000, // Unused data removed from memory after 10 minutes
      },
    },
  });
  ```

  | Setting     | Default | Controls                   |
  | ----------- | ------- | -------------------------- |
  | `staleTime` | `0`     | When to background refetch |
  | `gcTime`    | 5 min   | When to evict from memory  |

---

## Set `staleTime: Infinity` for Truly Static Data

- **Use `staleTime: Infinity` for data that never changes unless manually invalidated** (e.g., application config, enum lists).

  ```typescript
  // Before (config refetched on every mount)
  useQuery({ queryKey: ['app-config'], queryFn: fetchConfig });

  // After
  useQuery({
    queryKey: ['app-config'],
    queryFn: fetchConfig,
    staleTime: Infinity, // only invalidated explicitly
  });
  ```

---

## Query Deduplication — Same Key = Single Request

- **Multiple components using the same `queryKey` share a single in-flight request.** No action required — this is automatic. Avoid creating unique keys when the data is the same.

  ```typescript
  // Before (unique keys per component — separate requests for the same data)
  // ComponentA:
  useQuery({
    queryKey: ['user', userId, 'componentA'],
    queryFn: () => fetchUser(userId),
  });
  // ComponentB:
  useQuery({
    queryKey: ['user', userId, 'componentB'],
    queryFn: () => fetchUser(userId),
  });

  // After (shared key — one request, shared cache)
  // ComponentA and ComponentB both use:
  useQuery({ queryKey: ['user', userId], queryFn: () => fetchUser(userId) });
  ```

---

## Use `select` to Minimize Re-Renders

- **Use the `select` option to subscribe only to a slice of query data, reducing unnecessary re-renders.** See `references/patterns.md` — "`select` for Data Transformation" for full before/after examples.

---

## Set Global Defaults in `QueryClient` Constructor

- **Configure `staleTime` and `gcTime` globally** rather than repeating them on every query. Per-query options override globals when you need an exception.

  ```typescript
  // Before (repeated on every hook call)
  useQuery({ queryKey: ['todos'], queryFn: fetchTodos, staleTime: 60_000 });
  useQuery({ queryKey: ['users'], queryFn: fetchUsers, staleTime: 60_000 });

  // After (set once, overridden per query when needed)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });
  ```

---

## `maxPages` on Infinite Queries

- **Set `maxPages` on `useInfiniteQuery` for long lists** to cap the number of pages stored in memory. Without it, all fetched pages accumulate indefinitely.

  ```typescript
  // Before (unbounded page accumulation)
  useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam }) => fetchPosts(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // After (keep only the last 5 pages in cache)
  useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: ({ pageParam }) => fetchPosts(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    maxPages: 5,
  });
  ```

---

## `initialData` vs `placeholderData`

- **Prefer `placeholderData` over `initialData` when data comes from another query or is uncertain.** `initialData` is treated as real data and updates `dataUpdatedAt`; `placeholderData` is shown until real data arrives and does not pollute the cache.

  ```typescript
  // Before (initialData — marks the query as fresh with stale timestamp)
  const { data } = useQuery({
    queryKey: ['todo', id],
    queryFn: () => fetchTodo(id),
    initialData: () => {
      // Grab from the todo list cache — but this data may be partial
      return queryClient
        .getQueryData<Todo[]>(['todos'])
        ?.find((t) => t.id === id);
    },
  });

  // After (placeholderData — shows cached list item while fetching full detail)
  const { data, isPlaceholderData } = useQuery({
    queryKey: ['todo', id],
    queryFn: () => fetchTodo(id),
    placeholderData: () =>
      queryClient.getQueryData<Todo[]>(['todos'])?.find((t) => t.id === id),
  });
  ```

---

## Disable `refetchOnWindowFocus` for Infrequently Changing Data

- **Set `refetchOnWindowFocus: false` for data that doesn't change while the user is away.** The default `true` triggers a background fetch every time the browser tab regains focus.

  ```typescript
  // Before (config refetches every time user tabs back to the app)
  useQuery({ queryKey: ['app-config'], queryFn: fetchConfig });

  // After
  useQuery({
    queryKey: ['app-config'],
    queryFn: fetchConfig,
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000,
  });
  ```

---

## Avoid Unstable Object Literals in `queryKey`

- **Do not inline object literals in `queryKey`** — use stable references or primitives. An object literal is a new reference on every render, causing the query to restart.

  ```typescript
  // Before (new object on every render — triggers unnecessary refetches)
  function useTodos(status: string) {
    return useQuery({
      queryKey: ['todos', { status, sort: 'asc' }], // new object each render
      queryFn: () => fetchTodos({ status, sort: 'asc' }),
    });
  }

  // After (stable — same value across renders)
  function useTodos(status: string) {
    const filters = useMemo(() => ({ status, sort: 'asc' as const }), [status]);
    return useQuery({
      queryKey: ['todos', filters],
      queryFn: () => fetchTodos(filters),
    });
  }
  ```

  **Note:** This only applies when the object contains values that don't change with renders. If all values are primitives derived from props/state, the array serialization is stable.
