# TypeScript — Types, Generics, and Type Inference

Rules for correctly typing TanStack Query v5 hooks, custom hooks, and query options in TypeScript.

---

## Prefer Type Inference Over Explicit Generics

- **Let TypeScript infer `TData` from the return type of `queryFn`.** Explicit generics on `useQuery` are only needed for the error type or when inference fails.

  ```typescript
  // Before (unnecessary explicit generics — verbose)
  interface Todo {
    id: number;
    title: string;
  }

  const { data } = useQuery<Todo[], Error>({
    queryKey: ['todos'],
    queryFn: (): Promise<Todo[]> => api.getTodos(),
  });

  // After (inference via typed queryFn — data inferred as Todo[] | undefined)
  const fetchTodos = (): Promise<Todo[]> => api.getTodos();

  const { data } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
    //  ^? data: Todo[] | undefined (inferred)
  });
  ```

---

## Custom Error Types — Use Second Generic Only When Needed

- **Declare a custom error type only when you throw non-`Error` objects.** By default in v5, `error` is typed as `Error | null`. Overriding it to a different type loses inference on the data generic.

  ```typescript
  // Before (custom error loses data inference — over-generic)
  const { data, error } = useQuery<Todo[], string>({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  });
  // error: string | null (correct), but data type is now explicit, not inferred

  // After — option A: set a global default error type (recommended)
  // In a d.ts file or entry point:
  declare module '@tanstack/react-query' {
    interface Register {
      defaultError: ApiError; // your custom error class
    }
  }

  // Now error is typed as ApiError | null everywhere without explicit generics
  const { error } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos });
  //      ^? ApiError | null

  // After — option B: explicit second generic for one-off custom error
  const { error } = useQuery<Todo[], ApiError>({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  });
  ```

---

## Use `queryOptions()` for Fully Typed Reuse

- **Wrap query definitions in `queryOptions()` for co-located, type-safe definitions** that can be passed to `useQuery`, `queryClient.prefetchQuery`, and `queryClient.invalidateQueries` without retyping keys (see also `references/api.md`).

  ```typescript
  import { queryOptions } from '@tanstack/react-query';

  // Before (manually duplicated types at each call site)
  const TODOS_KEY = ['todos'] as const;
  const fetchTodos = (): Promise<Todo[]> => api.getTodos();

  // In component:
  const { data } = useQuery({ queryKey: TODOS_KEY, queryFn: fetchTodos });
  // In server component:
  await queryClient.prefetchQuery({ queryKey: TODOS_KEY, queryFn: fetchTodos });

  // After (single definition, fully typed everywhere)
  const todosQuery = queryOptions({
    queryKey: ['todos'],
    queryFn: (): Promise<Todo[]> => api.getTodos(),
    staleTime: 60_000,
  });

  const { data } = useQuery(todosQuery); // data: Todo[] | undefined
  await queryClient.prefetchQuery(todosQuery); // type-safe
  queryClient.invalidateQueries(todosQuery); // key derived automatically
  ```

---

## Type the `select` Return Value

- **The return type of `select` is automatically inferred** — do not assert it manually. This is one of the key benefits of the `select` option.

  ```typescript
  // Before (unnecessary cast)
  const { data: count } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
    select: (todos) => todos.length as number,
  });

  // After (inference is correct — count: number | undefined)
  const { data: count } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
    select: (todos) => todos.length,
    //                           ^? data: number | undefined
  });
  ```

---

## Type Custom Hook Return Values with `UseQueryResult`

- **Annotate custom hook return types explicitly** when exporting them as part of a library boundary or when the inferred type is overly complex.

  ```typescript
  import { useQuery, UseQueryResult } from '@tanstack/react-query';

  // Before (implicit return type — harder to consume)
  export function useTodo(id: number) {
    return useQuery({ queryKey: ['todo', id], queryFn: () => fetchTodo(id) });
  }

  // After (explicit — clear contract for consumers)
  export function useTodo(id: number): UseQueryResult<Todo, Error> {
    return useQuery({ queryKey: ['todo', id], queryFn: () => fetchTodo(id) });
  }
  ```

---

## Type `useMutation` Variables and Context

- **Annotate `useMutation` generics** when the variables or context types are non-trivial. The generics are: `<TData, TError, TVariables, TContext>`.

  ```typescript
  // Before (untyped — context rollback is any)
  useMutation({
    mutationFn: (todo) => api.createTodo(todo),
    onMutate: async (newTodo) => {
      const previous = queryClient.getQueryData(['todos']);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['todos'], context?.previous); // context: any
    },
  });

  // After (typed context — rollback is safe)
  interface TodoContext {
    previous: Todo[] | undefined;
  }

  useMutation<Todo, Error, NewTodo, TodoContext>({
    mutationFn: (todo) => api.createTodo(todo),
    onMutate: async (newTodo): Promise<TodoContext> => {
      const previous = queryClient.getQueryData<Todo[]>(['todos']);
      queryClient.setQueryData<Todo[]>(['todos'], (old = []) => [
        ...old,
        { ...newTodo, id: 0 },
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['todos'], context?.previous); // context: TodoContext | undefined
    },
  });
  ```

---

## `useInfiniteQuery` — Type `TPageParam` Explicitly

- **Provide the `TPageParam` generic to `useInfiniteQuery`** when the page param type is not `unknown`. Without it, `pageParam` is untyped inside `queryFn`.

  ```typescript
  // Before (pageParam is unknown inside queryFn)
  useInfiniteQuery({
    queryKey: ['projects'],
    queryFn: ({ pageParam }) => fetchProjects(pageParam), // pageParam: unknown
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  // After (pageParam typed as number)
  useInfiniteQuery<
    ProjectPage,
    Error,
    InfiniteData<ProjectPage>,
    string[],
    number
  >({
    queryKey: ['projects'],
    queryFn: ({ pageParam }) => fetchProjects(pageParam), // pageParam: number
    initialPageParam: 0,
    getNextPageParam: (lastPage): number | undefined => lastPage.nextCursor,
  });
  ```

---

## Avoid `as const` Assertions in `queryKey` When Using `queryOptions()`

- **Avoid manual `as const` assertions on query keys** when wrapping in `queryOptions()` — TypeScript infers the literal type correctly from the function call.

  ```typescript
  // Before (unnecessary as const)
  const key = ['todos', id] as const;

  // After (queryOptions infers the key type)
  const todoQuery = (id: number) =>
    queryOptions({
      queryKey: ['todos', id], // inferred as readonly ['todos', number]
      queryFn: () => fetchTodo(id),
    });
  ```
