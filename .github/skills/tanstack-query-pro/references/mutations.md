# Mutations — Patterns, Optimistic Updates, and Rollback

Rules for `useMutation`, cache updates, optimistic UI, and mutation lifecycle callbacks.

---

## Invalidate in `onSettled`, Not `onSuccess`

- **Invalidate queries in `onSettled`, not `onSuccess`.** `onSettled` fires whether the mutation succeeds or fails — ensuring the cache is always refreshed after a write, even if the optimistic update was rolled back.

  ```typescript
  // Before (skips invalidation on error — cache stays stale)
  useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  // After
  useMutation({
    mutationFn: createTodo,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
  ```

---

## Return the Invalidation Promise from `onSettled`

- **Return the `invalidateQueries` promise from `onSettled`** so the mutation stays `isPending` until the refetch completes. Without `return`, the UI can flash between "mutating" and "stale" states.

  ```typescript
  // Before (mutation resolves before refetch — UI flash possible)
  useMutation({
    mutationFn: createTodo,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] }); // not returned
    },
  });

  // After
  useMutation({
    mutationFn: createTodo,
    onSettled: () => {
      return queryClient.invalidateQueries({ queryKey: ['todos'] }); // returned
    },
  });
  ```

---

## Optimistic Updates — Cache-Based Pattern

- **Use `onMutate` to optimistically update the cache and return a rollback context.** Always cancel outgoing refetches first so they don't overwrite the optimistic value.

  ```typescript
  // Before (no cancellation or rollback — in-flight refetch can overwrite optimistic update)
  const queryClient = useQueryClient();

  useMutation({
    mutationFn: (newTodo: NewTodo) => api.createTodo(newTodo),
    onSuccess: (savedTodo) => {
      queryClient.setQueryData<Todo[]>(['todos'], (old = []) => [
        ...old,
        savedTodo,
      ]);
      // Missing: cancelQueries, snapshot, and onError rollback
    },
  });

  // After (full pattern: cancel outgoing fetches, snapshot, optimistic update, rollback on error)
  const queryClient = useQueryClient();

  useMutation({
    mutationFn: (newTodo: NewTodo) => api.createTodo(newTodo),
    onMutate: async (newTodo) => {
      // 1. Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      // 2. Snapshot the previous value for rollback
      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);
      // 3. Optimistically update the cache
      queryClient.setQueryData<Todo[]>(['todos'], (old = []) => [
        ...old,
        { ...newTodo, id: Date.now(), status: 'pending' },
      ]);
      // 4. Return context with snapshot
      return { previousTodos };
    },
    onError: (_err, _newTodo, context) => {
      // Rollback to snapshot on error
      if (context?.previousTodos) {
        queryClient.setQueryData(['todos'], context.previousTodos);
      }
    },
    onSettled: () => {
      return queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
  ```

---

## Optimistic Updates — UI-Based Pattern (Simpler)

- **Prefer the UI-based approach for simple single-location optimistic UIs.** Skip `onMutate` and render pending items from `mutation.isPending` and `mutation.variables` instead. Less code, no rollback logic needed.

  ```typescript
  const addTodo = useMutation({
    mutationFn: (text: string) => api.createTodo(text),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  const { data: todos } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos })

  return (
    <ul>
      {todos?.map((todo) => <li key={todo.id}>{todo.text}</li>)}
      {addTodo.isPending && (
        <li style={{ opacity: 0.5 }}>{addTodo.variables}</li>
      )}
    </ul>
  )
  ```

  **Why:** The cache-based approach (with `onMutate`) is required when the optimistic item appears in multiple places or when you need rollback semantics for a multi-step operation. For simple append-to-list patterns, the UI approach is clearer.

---

## `useMutationState` — Cross-Component Mutation State

- **Use `useMutationState` to read mutation variables or state from any component** without prop-drilling. Requires a `mutationKey` on the mutation.

  ```typescript
  // Before (no mutationKey — useMutationState cannot target this mutation; must prop-drill isPending)
  export function useAddTodo() {
    return useMutation({
      // No mutationKey — pending state cannot be observed from another component
      mutationFn: (text: string) => api.createTodo(text),
    })
  }

  // In a sibling component — must receive isPending/variables as props, no direct access
  function PendingTodoList({ isPending, pendingText }: { isPending: boolean; pendingText?: string }) {
    return isPending ? <li style={{ opacity: 0.5 }}>{pendingText}</li> : null
  }

  // After (mutationKey enables useMutationState — read pending state from any component)
  // Mutation definition (in hook file)
  export function useAddTodo() {
    return useMutation({
      mutationKey: ['addTodo'],
      mutationFn: (text: string) => api.createTodo(text),
      onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
    })
  }

  // Reading pending mutations from another component
  import { useMutationState } from '@tanstack/react-query'

  function PendingTodoList() {
    const pendingTodos = useMutationState({
      filters: { mutationKey: ['addTodo'], status: 'pending' },
      select: (mutation) => mutation.state.variables as string,
    })

    return (
      <>
        {pendingTodos.map((text, i) => (
          <li key={i} style={{ opacity: 0.5 }}>{text}</li>
        ))}
      </>
    )
  }
  ```

---

## `mutate` vs `mutateAsync` — Error Handling

- **Use `mutation.mutate()` in event handlers** — it catches errors internally and routes them to `onError`. Use `mutation.mutateAsync()` only when you need to `await` the result and handle errors with try/catch.

  ```typescript
  // Before (mutateAsync in event handler without try/catch — unhandled promise rejection)
  function handleClick() {
    mutation.mutateAsync({ id });
  }

  // After — option A: use mutate (errors handled by onError callback)
  function handleClick() {
    mutation.mutate({ id });
  }

  // After — option B: use mutateAsync with try/catch when you need the result
  async function handleSubmit() {
    try {
      const result = await mutation.mutateAsync({ id });
      router.push(`/items/${result.id}`);
    } catch {
      // error already handled by onError, optionally show UI feedback here
    }
  }
  ```

---

## Disable Mutation Retries by Default

- **Set `retry: false` on mutations** (or globally). Mutations that fail should not be silently retried — the user may have already gotten an error message and the action may not be idempotent.

  ```typescript
  // Before (default — retries on failure, may cause duplicate writes)
  useMutation({ mutationFn: submitOrder });

  // After
  useMutation({
    mutationFn: submitOrder,
    retry: false,
  });

  // Or globally (recommended for mutations)
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
    },
  });
  ```

---

## Set Default `mutationFn` for Resumable Mutations (Offline)

- **Register a default `mutationFn` via `queryClient.setMutationDefaults`** when you need mutations to resume after a page reload (e.g., with `persistQueryClient`).

  ```typescript
  // Before (mutationFn in component only — mutation cannot resume after page reload)
  useMutation({
    mutationKey: ['todos'],
    mutationFn: ({ id, data }: { id: number; data: Partial<Todo> }) =>
      api.updateTodo(id, data),
  });
  // If page reloads mid-mutation with persistQueryClient, the resumed mutation
  // has no mutationFn registered and throws: "No mutationFn found"

  // After (mutationFn registered globally via setMutationDefaults — resumes after reload)
  queryClient.setMutationDefaults({
    mutationKey: ['todos'],
    mutationFn: ({ id, data }: { id: number; data: Partial<Todo> }) =>
      api.updateTodo(id, data),
  });

  // Then in component — mutationFn is already registered
  useMutation({ mutationKey: ['todos'] });
  ```
