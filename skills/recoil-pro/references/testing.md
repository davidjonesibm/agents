# Testing Patterns

Testing Recoil atoms, selectors, snapshot-based unit tests, and component integration tests.

## Snapshot-Based Selector Unit Tests

- Use `snapshot_UNSTABLE()` to unit test selectors and their derived values without mounting React components.

  ```tsx
  import { atom, selector } from 'recoil';
  import { snapshot_UNSTABLE } from 'recoil';

  const countState = atom({ key: 'test/count', default: 0 });
  const doubledState = selector<number>({
    key: 'test/doubled',
    get: ({ get }) => get(countState) * 2,
  });

  test('doubledState returns double the count', () => {
    const initial = snapshot_UNSTABLE();
    expect(initial.getLoadable(doubledState).getValue()).toBe(0);

    const modified = snapshot_UNSTABLE(({ set }) => set(countState, 5));
    expect(modified.getLoadable(doubledState).getValue()).toBe(10);
  });
  ```

- Use `snapshot.getLoadable(node).getValue()` for synchronous selectors and `snapshot.getPromise(node)` for async ones.

## Async Selector Tests — Retain the Snapshot

- **Call `snapshot.retain()` before testing async selectors.** Without it, Recoil may cancel the in-flight async operation before it resolves, causing flaky tests.

  ```tsx
  // Before — async selector test may fail intermittently
  test('userNameQuery resolves correctly', async () => {
    const snapshot = snapshot_UNSTABLE(({ set }) => set(currentUserIDState, 1));
    const name = await snapshot.getPromise(userNameQuery); // may be cancelled ❌
    expect(name).toBe('Alice');
  });

  // After — retain keeps the snapshot alive for the duration of the test
  test('userNameQuery resolves correctly', async () => {
    const snapshot = snapshot_UNSTABLE(({ set }) => set(currentUserIDState, 1));
    const release = snapshot.retain();
    try {
      const name = await snapshot.getPromise(userNameQuery);
      expect(name).toBe('Alice');
    } finally {
      release();
    }
  });
  ```

## Component Tests with RecoilRoot

- Wrap components under test in `<RecoilRoot>`. Use `initializeState` to seed atom values for the test scenario.

  ```tsx
  import { render, screen } from '@testing-library/react';
  import { RecoilRoot } from 'recoil';

  test('UserName renders the current user name', () => {
    render(
      <RecoilRoot
        initializeState={({ set }) => set(currentUserState, { name: 'Alice' })}
      >
        <UserName />
      </RecoilRoot>,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
  ```

## RecoilObserver — Asserting State Changes

- Use a `RecoilObserver` utility component to observe and assert on atom state changes triggered by user interactions in component tests.

  ```tsx
  // Reusable observer utility
  function RecoilObserver<T>({
    node,
    onChange,
  }: {
    node: RecoilState<T> | RecoilValueReadOnly<T>;
    onChange: (value: T) => void;
  }): null {
    const value = useRecoilValue(node);
    useEffect(() => onChange(value), [onChange, value]);
    return null;
  }

  // Usage in a test
  test('clicking Add increments the count', async () => {
    const onChange = jest.fn();
    render(
      <RecoilRoot>
        <RecoilObserver node={countState} onChange={onChange} />
        <Counter />
      </RecoilRoot>,
    );
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
  ```

## Mocking External Dependencies in Atom Effects

- For atoms with effects that call external APIs or `localStorage`, mock the dependency in tests to keep tests fast and deterministic.

  ```tsx
  // Before — test hits real localStorage
  test('currentUserIDState persists to localStorage', () => {
    render(
      <RecoilRoot>
        <UserPanel />
      </RecoilRoot>,
    );
    // localStorage is real; test may be affected by previous test's data ❌
  });

  // After — mock localStorage before each test
  beforeEach(() => {
    jest.spyOn(window, 'localStorage', 'get').mockReturnValue({
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    } as unknown as Storage);
  });

  test('currentUserIDState uses localStorage value when available', () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(42));
    render(
      <RecoilRoot>
        <UserPanel />
      </RecoilRoot>,
    );
    expect(screen.getByText('User 42')).toBeInTheDocument();
  });
  ```

## Testing Async Selectors with Suspense

- When testing components that consume async selectors and use `Suspense`, wrap with both `Suspense` and `act` to flush the async resolution.

  ```tsx
  import { act } from '@testing-library/react';

  test('UserInfo shows name after loading', async () => {
    jest.mocked(fetchUser).mockResolvedValue({ name: 'Bob' });

    render(
      <RecoilRoot>
        <React.Suspense fallback={<span>Loading</span>}>
          <UserInfo userID={1} />
        </React.Suspense>
      </RecoilRoot>,
    );

    expect(screen.getByText('Loading')).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve(); // flush selector resolution
    });

    expect(screen.getByText('Bob')).toBeInTheDocument();
  });
  ```

## Isolating Atom State Between Tests

- Each `<RecoilRoot>` creates an isolated atom store. Because tests render inside their own `<RecoilRoot>`, atom state is automatically isolated between test cases — no manual cleanup needed.

  ```tsx
  // Before — manual afterEach cleanup is unnecessary and fragile;
  // attempting to reset Recoil state from outside RecoilRoot doesn't reliably work
  afterEach(() => {
    // ❌ no-op: atoms are already scoped to their RecoilRoot instance
    jest.clearAllMocks();
    // some teams add custom atom reset loops here — not needed
  });

  test('test A', () => {
    render(
      <RecoilRoot>
        <ComponentA />
      </RecoilRoot>,
    );
    // ...
  });
  ```

  ```tsx
  // After — each test gets a fresh RecoilRoot; no afterEach cleanup needed
  test('test A', () => {
    render(
      <RecoilRoot>
        <ComponentA />
      </RecoilRoot>,
    );
    // ...
  });

  test('test B', () => {
    render(
      <RecoilRoot>
        <ComponentB />
      </RecoilRoot>,
    );
    // atom state from test A is not present here
  });
  ```

  **Note:** Singleton effects (e.g., WebSocket connections) may persist across tests if the atom module is loaded once. Use `jest.resetModules()` or factory functions if effect setup must be isolated.
