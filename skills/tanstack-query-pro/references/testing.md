# Testing — Query and Mutation Testing Patterns

Rules for testing TanStack Query hooks and components. Covers test isolation, wrapper setup, mocking, and common pitfalls.

---

## Create a Fresh `QueryClient` Per Test

- **Never share a `QueryClient` between tests.** A shared client leaks cache state between tests, causing flaky failures.

  ```typescript
  // Before (shared client — test pollution)
  const queryClient = new QueryClient()
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  describe('useTodos', () => {
    it('fetches todos', async () => { ... })
    it('returns empty list', async () => { ... }) // sees cached data from previous test
  })

  // After (fresh client per test)
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  describe('useTodos', () => {
    it('fetches todos', async () => {
      const { result } = renderHook(() => useTodos(), { wrapper: createWrapper() })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })
  })
  ```

---

## Disable Retries in Test `QueryClient`

- **Always set `retry: false` in the test `QueryClient`.** Default retries (3) cause tests that expect errors to wait for multiple retry cycles, making them slow and timing-dependent.

  ```typescript
  // Before (3 retries — error tests take 3+ seconds)
  const queryClient = new QueryClient();

  // After
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // no retries — errors surface immediately
        gcTime: Infinity, // prevent Jest "open handle" warning
      },
      mutations: {
        retry: false,
      },
    },
  });
  ```

---

## Set `gcTime: Infinity` in Jest to Prevent Open Handle Warnings

- **Set `gcTime: Infinity`** in Jest test QueryClients to prevent the "Jest did not exit one second after the test run" warning caused by background GC timers.

  ```typescript
  // Before (GC timer keeps Jest process alive)
  const queryClient = new QueryClient();

  // After
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  ```

---

## Test Custom Hooks with `renderHook` + `waitFor`

- **Use `renderHook` from `@testing-library/react` and `waitFor` to test async query state.** Never use `act` alone for async queries.

  ```typescript
  // Before (act with setTimeout — arbitrary timing, misses intermediate state updates)
  it('returns todo data', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, title: 'Test' }],
    } as Response)

    const { result } = renderHook(() => useTodos(), { wrapper: createWrapper() })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100)) // arbitrary delay — brittle
    })

    expect(result.current.data).toEqual([{ id: 1, title: 'Test' }])
  })

  // After (waitFor polls until condition is true — no timing assumptions)
  import { renderHook, waitFor } from '@testing-library/react'

  // Arrange
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  it('returns todo data', async () => {
    // Mock the fetch
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, title: 'Test' }],
    } as Response)

    const { result } = renderHook(() => useTodos(), { wrapper: createWrapper() })

    // Wait for async state
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([{ id: 1, title: 'Test' }])
  })
  ```

---

## Mock at the Network/Fetch Level — Not Inside `queryFn`

- **Mock `fetch`, `axios`, or your API client — not the `queryFn` itself.** Mocking the `queryFn` couples tests to implementation details and bypasses error/retry logic.

  ```typescript
  // Before (mocking queryFn — implementation-coupled)
  vi.mock('./api', () => ({ getTodos: vi.fn().mockResolvedValue([]) }));

  const { result } = renderHook(() => useTodos(), { wrapper });
  // useTodos internally calls getTodos — this works but is fragile

  // After (mock at fetch level — tests real queryFn execution)
  // Using nock:
  nock('https://api.example.com')
    .get('/todos')
    .reply(200, [{ id: 1, title: 'Test' }]);

  // Using vi.spyOn (Vitest) / jest.spyOn:
  vi.spyOn(global, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify([{ id: 1, title: 'Test' }])),
  );
  ```

---

## Testing Error States — Suppress Console Errors

- **Suppress `console.error` during error state tests.** TanStack Query logs errors to the console in development; this noise pollutes test output without affecting correctness.

  ```typescript
  // Before (no console suppression — TanStack Query error logs pollute CI output)
  it('shows error state when fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useTodos(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
    // console.error output from TanStack Query clutters CI logs
  });

  // After (suppress and restore console.error — clean output)
  it('shows error state when fetch fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useTodos(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');

    consoleSpy.mockRestore();
  });
  ```

---

## Testing Mutations — Trigger `mutate` and Wait for State

- **Call `result.current.mutate()` and use `waitFor` to check mutation state.** Mutations are async — always await the settled state.

  ```typescript
  // Before (vi.mock() inside it() body — silently ignored by Vitest; assertion fires before mutation settles)
  it('creates a todo and invalidates query', async () => {
    vi.mock('./api', () => ({ createTodo: vi.fn().mockResolvedValue({ id: 99, title: 'New' }) })) // ❌ inside test body

    const { result } = renderHook(() => useCreateTodo(), { wrapper: createWrapper() })

    result.current.mutate('New')

    expect(result.current.isSuccess).toBe(true) // ❌ fails — mutation not yet settled
  })

  // After (vi.mock() at module scope; waitFor for settled state)
  import { vi } from 'vitest'

  const createTodoSpy = vi.hoisted(() => vi.fn())
  vi.mock('./api', () => ({ createTodo: createTodoSpy })) // ✅ vi.hoisted() ensures spy is defined when factory runs

  it('creates a todo and invalidates query', async () => {
    createTodoSpy.mockResolvedValue({ id: 99, title: 'New' })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useCreateTodo(), { wrapper })

    result.current.mutate('New')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(createTodoSpy).toHaveBeenCalledWith('New')
  })
  ```

---

## Infinite Query Tests — Trigger `fetchNextPage`

- **Call `result.current.fetchNextPage()` and `waitFor` after initial data loads** to test multi-page accumulation.

  ```typescript
  // Before (no fetchNextPage call — only page 1 verified; multi-page accumulation untested)
  it('fetches posts', async () => {
    nock('http://api.example.com')
      .get('/posts')
      .query({ page: '1' })
      .reply(200, { data: [{ id: 10 }], nextCursor: 2 });

    const { result } = renderHook(() => useInfinitePosts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1); // only page 1 — fetchNextPage never called
  });

  // After (fetchNextPage triggered; both pages verified)
  it('fetches next page', async () => {
    // Mock page 1 then page 2
    nock('http://api.example.com')
      .persist()
      .query(true)
      .get('/posts')
      .reply(200, (uri) => {
        const page = new URL(`http://api.example.com${uri}`).searchParams.get(
          'page',
        );
        return { data: [{ id: +page! * 10 }], nextCursor: +page! + 1 };
      });

    const { result } = renderHook(() => useInfinitePosts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);

    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  });
  ```
