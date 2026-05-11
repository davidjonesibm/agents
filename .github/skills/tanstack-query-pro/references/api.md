# API Reference — v5 Changes and Deprecated Patterns

Rules for TanStack Query v5 API surface: what changed from v4, what was removed, and what to use instead.

---

## Hook Signature — Single Object Argument (Breaking)

- **Use the single-object form for all hooks.** v5 removes the positional `(key, fn, options)` overloads entirely.

  ```typescript
  // Before (v4 — compile error in v5)
  useQuery(['todos'], fetchTodos, { staleTime: 5000 });
  useMutation(createTodo, { onSuccess: () => {} });
  useIsFetching(['todos'], filters);

  // After (v5)
  useQuery({ queryKey: ['todos'], queryFn: fetchTodos, staleTime: 5000 });
  useMutation({ mutationFn: createTodo, onSuccess: () => {} });
  useIsFetching({ queryKey: ['todos'], ...filters });
  ```

  **Why:** Positional overloads were removed to simplify types and enable better inference.

---

## `cacheTime` → `gcTime` (Breaking Rename)

- **Rename `cacheTime` to `gcTime` everywhere.** The rename reflects what the option actually controls: garbage collection delay after a query becomes unused.

  ```typescript
  // Before (v4)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { cacheTime: 10 * 60 * 1000 } },
  });

  // After (v5)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 10 * 60 * 1000 } },
  });
  ```

---

## `isLoading` vs `isPending` (Semantic Change)

- **Prefer `isPending` over `isLoading` for detecting "no data yet" state.** In v5, `isLoading` is true only when `isPending && isFetching` — i.e., the first active fetch. `isPending` is true whenever there is no cached data, even for disabled queries.

  ```typescript
  // Before (v4 semantics — misleading for disabled queries)
  const { isLoading } = useQuery({ queryKey: ['user'], queryFn: getUser, enabled: false })
  // isLoading was true even when disabled in v4

  // After (v5 — use isPending for "no data" check)
  const { isPending, isFetching } = useQuery({ queryKey: ['user'], queryFn: getUser })
  if (isPending) return <Spinner />        // no data yet
  if (isFetching) return <BackgroundSpinner /> // refetching
  ```

---

## `keepPreviousData` → `placeholderData` (Removed Option)

- **Replace `keepPreviousData: true` with `placeholderData: keepPreviousData`.** The option was removed; use the exported helper or an identity function.

  ```typescript
  import { useQuery, keepPreviousData } from '@tanstack/react-query';

  // Before (v4)
  const { data, isPreviousData } = useQuery({
    queryKey: ['page', page],
    queryFn: () => fetchPage(page),
    keepPreviousData: true,
  });

  // After (v5)
  const { data, isPlaceholderData } = useQuery({
    queryKey: ['page', page],
    queryFn: () => fetchPage(page),
    placeholderData: keepPreviousData,
  });
  ```

---

## `query.remove()` → `queryClient.removeQueries()` (Removed Method)

- **Remove calls to `query.remove()` — the method no longer exists.** Use `queryClient.removeQueries()` with a filter instead.

  ```typescript
  // Before (v4)
  const query = useQuery({ queryKey, queryFn });
  query.remove(); // removed in v5

  // After (v5)
  const queryClient = useQueryClient();
  queryClient.removeQueries({ queryKey });
  ```

---

## `context` Prop → Direct `queryClient` Instance (Removed)

- **Remove the React-specific `context` prop** from hooks. Pass a `queryClient` instance directly as the second argument when using a non-default client (e.g., microfrontends).

  ```typescript
  // Before (v4)
  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    context: customContext,
  });

  // After (v5)
  import { myQueryClient } from './client';
  const { data } = useQuery(
    { queryKey: ['users'], queryFn: fetchUsers },
    myQueryClient,
  );
  ```

---

## `Hydrate` → `HydrationBoundary` (Renamed Component)

- **Replace `<Hydrate>` with `<HydrationBoundary>`.** The component was renamed in v5.

  ```typescript
  // Before (v4)
  import { Hydrate } from '@tanstack/react-query'
  <Hydrate state={dehydratedState}><App /></Hydrate>

  // After (v5)
  import { HydrationBoundary } from '@tanstack/react-query'
  <HydrationBoundary state={dehydratedState}><App /></HydrationBoundary>
  ```

---

## `queryCache.find()` / `findAll()` — Object Signature (Breaking)

- **Update `queryCache.find` and `queryCache.findAll` calls to object form.**

  ```typescript
  // Before (v4)
  queryCache.find(['todos'], filters);
  queryCache.findAll(['todos'], filters);

  // After (v5)
  queryCache.find({ queryKey: ['todos'], ...filters });
  queryCache.findAll({ queryKey: ['todos'], ...filters });
  ```

---

## New v5 Helpers — `queryOptions()`, `infiniteQueryOptions()`, `mutationOptions()`

- **Use `queryOptions()` to co-locate queryKey and queryFn.** This enables type-safe reuse across `useQuery`, `queryClient.prefetchQuery`, and `queryClient.invalidateQueries` without repeating key strings.

  ```typescript
  // Before (v4 — scattered key/fn definitions)
  const TODOS_KEY = ['todos'] as const;
  function fetchTodos() {
    return api.get('/todos');
  }
  // Used separately in hook and queryClient calls

  // After (v5 — co-located, type-safe)
  import { queryOptions } from '@tanstack/react-query';

  const todosQueryOptions = queryOptions({
    queryKey: ['todos'],
    queryFn: () => api.get('/todos'),
    staleTime: 60 * 1000,
  });

  // In component
  const { data } = useQuery(todosQueryOptions);
  // In server component or prefetch
  await queryClient.prefetchQuery(todosQueryOptions);
  // Invalidation — key is never retyped
  queryClient.invalidateQueries({ queryKey: todosQueryOptions.queryKey });
  ```

---

## Codemod for Automated Migration

- **Run the official v5 codemod** to automate the hook signature changes.

  ```shell
  # JavaScript/JSX
  npx jscodeshift@latest ./src/ --extensions=js,jsx \
    --transform=./node_modules/@tanstack/react-query/build/codemods/src/v5/remove-overloads/remove-overloads.cjs

  # TypeScript/TSX
  npx jscodeshift@latest ./src/ --extensions=ts,tsx --parser=tsx \
    --transform=./node_modules/@tanstack/react-query/build/codemods/src/v5/remove-overloads/remove-overloads.cjs
  ```

  **Note:** Always review codemod output and address any manual notes printed to the console.
