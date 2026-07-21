# Patterns — Idiomatic Usage, Anti-Patterns, and Common Mistakes

Rules for writing idiomatic TanStack Query v5 code in React. Covers query key design, custom hooks, data transformation, parallel/dependent queries, and common mistakes.

---

## Query Key Factory Pattern

- **Define query keys using a factory object**, not scattered string arrays. This prevents key typos, enables consistent invalidation, and co-locates key shape with the feature.

  ```typescript
  // Before (scattered, error-prone)
  useQuery({ queryKey: ['todos'], queryFn: fetchTodos });
  queryClient.invalidateQueries({ queryKey: ['todo', id] }); // typo: 'todo' vs 'todos'

  // After (factory pattern)
  const todoKeys = {
    all: ['todos'] as const,
    lists: () => [...todoKeys.all, 'list'] as const,
    list: (filters: string) => [...todoKeys.lists(), { filters }] as const,
    details: () => [...todoKeys.all, 'detail'] as const,
    detail: (id: number) => [...todoKeys.details(), id] as const,
  };

  useQuery({ queryKey: todoKeys.detail(id), queryFn: () => fetchTodo(id) });
  queryClient.invalidateQueries({ queryKey: todoKeys.all }); // invalidates all todo queries
  ```

---

## Wrap Queries in Custom Hooks

- **Encapsulate every `useQuery` call in a dedicated custom hook.** This isolates fetch logic from UI, makes testing easier, and enables co-located `queryOptions` usage.

  ```typescript
  // Before (inline query — leaks fetch details into UI)
  function TodoList() {
    const { data } = useQuery({
      queryKey: ['todos', filters],
      queryFn: () => api.getTodos(filters),
      staleTime: 30_000,
    });
  }

  // After (custom hook)
  function useTodos(filters: TodoFilters) {
    return useQuery({
      queryKey: ['todos', filters],
      queryFn: () => api.getTodos(filters),
      staleTime: 30_000,
    });
  }

  function TodoList() {
    const { data } = useTodos(filters);
  }
  ```

---

## Dependent Queries — Use `enabled` Option

- **Gate dependent queries with `enabled`, never with conditional hook calls.** React rules of hooks forbid conditional hook calls.

  ```typescript
  // Before (broken — violates rules of hooks)
  function Profile({ userId }: { userId?: number }) {
    if (!userId) return null;
    const { data: posts } = useQuery({
      queryKey: ['posts', userId],
      queryFn: () => fetchPosts(userId),
    });
  }

  // After
  function Profile({ userId }: { userId?: number }) {
    const { data: user } = useQuery({
      queryKey: ['user', userId],
      queryFn: () => fetchUser(userId!),
      enabled: !!userId,
    });
    const { data: posts } = useQuery({
      queryKey: ['posts', user?.id],
      queryFn: () => fetchPosts(user!.id),
      enabled: !!user?.id,
    });
  }
  ```

---

## `select` for Data Transformation

- **Use `select` to transform or derive data from the cache without additional state.** The selector runs only when data changes and re-subscribes only to the selected slice.

  ```typescript
  // Before (manual state derivation — causes extra renders)
  const { data } = useQuery({ queryKey: ['user'], queryFn: getUser });
  const username = data?.name.toUpperCase();

  // After (select — renders only when username changes)
  const { data: username } = useQuery({
    queryKey: ['user'],
    queryFn: getUser,
    select: (user) => user.name.toUpperCase(),
  });
  ```

---

## Parallel Queries — Use `useQueries`

- **Use `useQueries` for a dynamic list of parallel queries** instead of calling `useQuery` in a loop (which violates rules of hooks).

  ```typescript
  // Before (invalid — hooks in a loop)
  const results = ids.map((id) =>
    useQuery({ queryKey: ['post', id], queryFn: () => fetchPost(id) }),
  );

  // After
  import { useQueries } from '@tanstack/react-query';

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['post', id],
      queryFn: () => fetchPost(id),
    })),
  });
  ```

---

## Paginated Queries — `placeholderData: keepPreviousData`

- **Use `placeholderData: keepPreviousData` to keep previous page data visible while the next page loads.** This prevents layout flicker during pagination (see also `references/api.md` for the v4→v5 migration of this option).

  ```typescript
  // Before (no placeholderData — content disappears while next page loads, causing flicker)
  import { useQuery } from '@tanstack/react-query';

  function usePaginatedPosts(page: number) {
    return useQuery({
      queryKey: ['posts', page],
      queryFn: () => fetchPosts(page),
      // No placeholderData — isPending is true during page transitions; UI blanks out
    });
  }

  // After (keepPreviousData — previous page stays visible until new page is ready)
  import { useQuery, keepPreviousData } from '@tanstack/react-query';

  function usePaginatedPosts(page: number) {
    return useQuery({
      queryKey: ['posts', page],
      queryFn: () => fetchPosts(page),
      placeholderData: keepPreviousData,
    });
  }
  ```

---

## Status Checks — Avoid Double Condition

- **Use `status` string instead of combining two boolean flags** when rendering conditional states. Both styles work, but pick one consistently.

  ```typescript
  // Before (verbose boolean combining)
  const { isPending, isError, isSuccess, data, error } = useQuery(...)
  if (isPending) return <Spinner />
  if (isError) return <Error error={error} />
  if (isSuccess) return <List data={data} />

  // After (status switch — more exhaustive)
  const { status, data, error } = useQuery(...)
  if (status === 'pending') return <Spinner />
  if (status === 'error') return <Error error={error} />
  return <List data={data} />
  ```

---

## Infinite Queries — Always Provide `initialPageParam`

- **Always set `initialPageParam` in `useInfiniteQuery`.** It is required in v5 (was optional before).

  ```typescript
  // Before (v4 — pageParam defaulted in queryFn)
  useInfiniteQuery({
    queryKey: ['projects'],
    queryFn: ({ pageParam = 0 }) => fetchProjects(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // After (v5 — initialPageParam is explicit)
  useInfiniteQuery({
    queryKey: ['projects'],
    queryFn: ({ pageParam }) => fetchProjects(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  ```

---

## Suspense Mode — `useSuspenseQuery`

- **Use `useSuspenseQuery` when using React Suspense boundaries.** It removes `isPending` / `isError` from the return type, making data always defined within the component.

  ```typescript
  // Before (manual isPending check required)
  const { data, isPending } = useQuery({ queryKey: ['user'], queryFn: getUser })
  if (isPending) return <Spinner />
  return <Profile user={data!} />

  // After (with Suspense boundary — data is always defined)
  import { useSuspenseQuery } from '@tanstack/react-query'

  function Profile() {
    const { data } = useSuspenseQuery({ queryKey: ['user'], queryFn: getUser })
    return <ProfileView user={data} /> // data: User, not User | undefined
  }

  // Wrap in Suspense
  <Suspense fallback={<Spinner />}>
    <Profile />
  </Suspense>
  ```

---

## Prefetching — Use `usePrefetchQuery` in Route Loaders

- **Use `queryClient.prefetchQuery()` (or `usePrefetchQuery`) in route loaders or parent components** to warm the cache before navigation completes.

  ```typescript
  // Before (data fetches on render — visible loading state)
  function PostList() {
    const { data } = useQuery({ queryKey: ['posts'], queryFn: fetchPosts })
    if (!data) return <Spinner />
    return <List posts={data} />
  }

  // After (prefetch in loader, data ready on render)
  // In route loader (React Router / TanStack Router):
  async function postsLoader() {
    await queryClient.prefetchQuery({
      queryKey: ['posts'],
      queryFn: fetchPosts,
    })
    return null
  }

  function PostList() {
    const { data } = useQuery({ queryKey: ['posts'], queryFn: fetchPosts })
    return <List posts={data!} /> // cache hit — no loading state
  }
  ```

---

## Anti-Pattern — `queryFn` Returning `undefined`

- **`queryFn` must never return `undefined`.** TanStack Query treats `undefined` as "no data" and will refetch indefinitely.

  ```typescript
  // Before (breaks caching — never resolves)
  useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const res = await fetch('/api/user');
      if (!res.ok) return undefined; // ❌
    },
  });

  // After (throw on error — let Query handle retries)
  useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const res = await fetch('/api/user');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json(); // always returns data or throws
    },
  });
  ```
