# Testing Patterns

Testing Zustand stores with Jest and Vitest, including store reset between tests, mocking, and component testing.

## Reset Stores Between Tests with Auto-Mocking

- Zustand stores persist state across tests by default. Use the official `__mocks__/zustand.ts` pattern to capture initial state and reset all stores after each test.

  ```typescript
  // Before — no store reset; state leaks between tests
  describe('leaky tests', () => {
    it('first test mutates state', () => {
      useBearStore.getState().increasePopulation();
      expect(useBearStore.getState().bears).toBe(1); // passes
    });
    it('second test expects initial state but sees dirty state', () => {
      expect(useBearStore.getState().bears).toBe(0); // ❌ fails — bears is still 1
    });
  });
  ```

  **For Vitest:**

  ```typescript
  // __mocks__/zustand.ts
  import { act } from '@testing-library/react';
  import type * as ZustandExportedTypes from 'zustand';
  export * from 'zustand';

  const { create: actualCreate, createStore: actualCreateStore } =
    await vi.importActual<typeof ZustandExportedTypes>('zustand');

  export const storeResetFns = new Set<() => void>();

  const createUncurried = <T>(
    stateCreator: ZustandExportedTypes.StateCreator<T>,
  ) => {
    const store = actualCreate(stateCreator);
    const initialState = store.getInitialState();
    storeResetFns.add(() => store.setState(initialState, true));
    return store;
  };

  export const create = (<T>(
    stateCreator: ZustandExportedTypes.StateCreator<T>,
  ) =>
    typeof stateCreator === 'function'
      ? createUncurried(stateCreator)
      : createUncurried) as typeof ZustandExportedTypes.create;

  const createStoreUncurried = <T>(
    stateCreator: ZustandExportedTypes.StateCreator<T>,
  ) => {
    const store = actualCreateStore(stateCreator);
    const initialState = store.getInitialState();
    storeResetFns.add(() => store.setState(initialState, true));
    return store;
  };

  export const createStore = (<T>(
    stateCreator: ZustandExportedTypes.StateCreator<T>,
  ) =>
    typeof stateCreator === 'function'
      ? createStoreUncurried(stateCreator)
      : createStoreUncurried) as typeof ZustandExportedTypes.createStore;

  afterEach(() => {
    act(() => storeResetFns.forEach((fn) => fn()));
  });
  ```

  ```typescript
  // setup-vitest.ts
  import '@testing-library/jest-dom/vitest';
  vi.mock('zustand'); // enables auto-mocking from __mocks__/zustand.ts
  ```

  ```typescript
  // vitest.config.ts
  export default defineConfig({
    test: {
      setupFiles: ['./setup-vitest.ts'],
    },
  });
  ```

  **For Jest:**

  ```typescript
  // __mocks__/zustand.ts — same structure but use jest.requireActual instead of vi.importActual
  const { create: actualCreate, createStore: actualCreateStore } =
    jest.requireActual<typeof ZustandExportedTypes>('zustand');
  // afterEach reset is the same
  ```

## Unit-Test Store Logic Directly (No React)

- Test store state and actions using `getState()` and `setState()` directly without rendering any React components. This is the fastest way to test store logic.

  ```typescript
  // Before — rendering a full component just to test store logic; slow and couples test to UI
  import { render } from '@testing-library/react'
  import userEvent from '@testing-library/user-event'
  import { BearCounter } from '../components/BearCounter'

  it('increasePopulation adds one bear', async () => {
    render(<BearCounter />)
    await userEvent.click(screen.getByRole('button', { name: 'one up' }))
    // ❌ tests both store logic AND rendering — hard to diagnose which side failed
    expect(screen.getByText('1 bears around here...')).toBeInTheDocument()
  })
  ```

  ```typescript
  // After — test store logic directly via getState(); no render overhead

  describe('useBearStore', () => {
    it('starts with zero bears', () => {
      expect(useBearStore.getState().bears).toBe(0);
    });

    it('increasePopulation adds one bear', () => {
      useBearStore.getState().increasePopulation();
      expect(useBearStore.getState().bears).toBe(1);
    });

    it('removeAllBears resets to zero', () => {
      useBearStore.setState({ bears: 5 });
      useBearStore.getState().removeAllBears();
      expect(useBearStore.getState().bears).toBe(0);
    });
  });
  ```

  **Note:** Store reset between tests is handled by the auto-mock in `__mocks__/zustand.ts`. If not using auto-mocking, reset manually:

  ```typescript
  beforeEach(() => {
    useBearStore.setState(useBearStore.getInitialState(), true);
  });
  ```

## Component Testing with `@testing-library/react`

- Test components that consume Zustand stores using `render` and `screen`. The global store is auto-mocked and reset — no manual provider wrapping is needed for global stores.

  ```tsx
  // Before — asserting store state directly instead of the rendered UI; tests implementation, not behavior
  it('increments count on button click', async () => {
    render(<BearCounter />);
    await userEvent.click(screen.getByRole('button', { name: 'one up' }));
    expect(useBearStore.getState().bears).toBe(1); // ❌ skips verifying what the user actually sees
  });
  ```

  ```tsx
  // After — assert on what the user sees; store reset is handled by auto-mock
  import userEvent from '@testing-library/user-event';
  import { act } from '@testing-library/react';
  import { BearCounter } from '../components/BearCounter';
  import { useBearStore } from '../stores/bearStore';

  describe('BearCounter', () => {
    it('shows initial bear count', () => {
      render(<BearCounter />);
      expect(screen.getByText('0 bears around here...')).toBeInTheDocument();
    });

    it('increments count on button click', async () => {
      render(<BearCounter />);
      await userEvent.click(screen.getByRole('button', { name: 'one up' }));
      expect(screen.getByText('1 bears around here...')).toBeInTheDocument();
    });

    it('responds to external state change', () => {
      render(<BearCounter />);
      act(() => {
        useBearStore.setState({ bears: 42 });
      });
      expect(screen.getByText('42 bears around here...')).toBeInTheDocument();
    });
  });
  ```

## Testing Context Store Stores (Per-Instance Stores)

- For context-based stores (e.g., `CounterProvider` + `useCounterStore`), wrap the component in the provider in tests.

  ```tsx
  // Before — rendering context store component without its provider throws at runtime
  it('displays count', () => {
    render(<CounterComponent />); // ❌ throws: "useCounterStore must be used within CounterProvider"
    expect(screen.getByText('0')).toBeInTheDocument();
  });
  ```

  ```tsx
  // After — wrap the component in a test-scoped provider instance
  import { CounterProvider } from '../providers/CounterProvider';
  import { CounterComponent } from '../components/CounterComponent';
  import { createStore } from 'zustand/vanilla';

  function renderWithProvider(
    counterStore = createStore<CounterState>()((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    })),
  ) {
    return render(
      <CounterProvider store={counterStore}>
        <CounterComponent />
      </CounterProvider>,
    );
  }

  it('displays count from provider store', () => {
    const store = createStore<CounterState>()((set) => ({
      count: 5,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));
    renderWithProvider(store);
    expect(screen.getByText('5')).toBeInTheDocument();
  });
  ```

## Testing `persist` Middleware

- Mock `localStorage` (or the target storage) before testing persist middleware behavior.

  ```typescript
  // Before — no localStorage.clear(); stale data from a previous test causes wrong rehydration
  it('starts with default theme', async () => {
    // A previous test may have written { theme: 'dark' } to localStorage
    await usePersistStore.persist.rehydrate();
    expect(usePersistStore.getState().theme).toBe('light'); // ❌ may fail — stale storage not cleared
  });
  ```

  ```typescript
  // After — clear storage and reset store state in beforeEach

  describe('persistStore', () => {
    beforeEach(() => {
      localStorage.clear();
      usePersistStore.setState(usePersistStore.getInitialState(), true);
    });

    it('rehydrates state from localStorage', async () => {
      // Pre-populate storage as if a previous session had run
      localStorage.setItem(
        'my-store',
        JSON.stringify({ state: { theme: 'dark' }, version: 1 }),
      );

      // Trigger rehydration
      await usePersistStore.persist.rehydrate();

      expect(usePersistStore.getState().theme).toBe('dark');
    });
  });
  ```

## Testing `subscribeWithSelector` Stores

- Test subscription callbacks by subscribing directly to the vanilla store, triggering state changes, and asserting on captured values.

  ```typescript
  // Before — subscription never unsubscribed; callback fires in subsequent tests
  it('fires score subscription', () => {
    const captured: number[] = [];
    gameStore.subscribe(
      // ❌ unsub never called — leaks into later tests
      (state) => state.score,
      (score) => captured.push(score),
    );
    gameStore.getState().addScore(10);
    expect(captured).toEqual([10]);
  });
  ```

  ```typescript
  // After — store unsub in cleanup; captures only expected values

  it('fires score subscription on score change', () => {
    const captured: number[] = [];

    const unsub = gameStore.subscribe(
      (state) => state.score,
      (score) => captured.push(score),
    );

    gameStore.getState().addScore(10);
    gameStore.getState().addScore(5);

    expect(captured).toEqual([10, 15]);

    unsub();
  });
  ```
