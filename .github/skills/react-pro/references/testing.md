# React Testing Patterns

Testing components, hooks, async behavior, and queries — using React Testing Library (RTL) and Vitest/Jest.

## Query Priority (Critical)

- **Follow the RTL query priority hierarchy.** Prefer queries that reflect how users interact with the UI. `getByTestId` is a last resort.

  | Priority | Query                  | When to use                                                  |
  | -------- | ---------------------- | ------------------------------------------------------------ |
  | 1        | `getByRole`            | Most interactive elements — buttons, inputs, links, headings |
  | 2        | `getByLabelText`       | Form inputs associated with a `<label>`                      |
  | 3        | `getByPlaceholderText` | Inputs with a placeholder (when no label)                    |
  | 4        | `getByText`            | Non-interactive text content                                 |
  | 5        | `getByDisplayValue`    | Current value of input/select                                |
  | 6        | `getByAltText`         | Images                                                       |
  | 7        | `getByTitle`           | Elements with a `title` attribute                            |
  | 8        | `getByTestId`          | Last resort — only when no semantic query works              |

  ```tsx
  // Before ❌ — brittle testId coupling
  const button = screen.getByTestId('submit-btn');

  // After ✅ — queries by accessible role
  const button = screen.getByRole('button', { name: /submit/i });
  ```

## `userEvent` over `fireEvent`

- **Use `@testing-library/user-event` instead of `fireEvent`** for realistic user interaction simulation. `userEvent` dispatches the full sequence of events (pointer events, key events, etc.) that real browsers fire.

  ```tsx
  // Before ❌ — fireEvent.click skips pointer events, may miss handlers
  import { render, screen, fireEvent } from '@testing-library/react';

  test('increments counter', () => {
    render(<Counter />);
    fireEvent.click(screen.getByRole('button', { name: /increment/i }));
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  // After ✅ — userEvent simulates realistic browser interactions
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';

  test('increments counter', async () => {
    const user = userEvent.setup();
    render(<Counter />);
    await user.click(screen.getByRole('button', { name: /increment/i }));
    expect(screen.getByText('1')).toBeInTheDocument();
  });
  ```

## Async Queries

- **Use `findBy*` queries or `waitFor` for elements that appear after async operations.** Never use `getBy*` for async elements — it throws immediately.

  ```tsx
  // Before ❌ — getBy throws before async render completes
  test('shows user name after load', async () => {
    render(<UserProfile userId="1" />);
    expect(screen.getByText('Alice')).toBeInTheDocument(); // fails — not yet rendered
  });

  // After ✅ — findBy waits up to the default timeout
  test('shows user name after load', async () => {
    render(<UserProfile userId="1" />);
    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  // Alternative ✅ — waitFor for assertions on existing elements
  test('shows success message', async () => {
    const user = userEvent.setup();
    render(<Form />);
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument();
    });
  });
  ```

## `act()` — Low-Level State Updates

- **Wrap state updates in `act()` when testing without RTL's built-in act wrapping.** RTL's `render`, `userEvent`, and `findBy*` already wrap in `act` — you only need it when using `ReactDOM.createRoot` directly or dispatching raw DOM events.

  ```tsx
  // When using ReactDOM directly (rare)
  import { act } from 'react';
  import ReactDOMClient from 'react-dom/client';

  it('renders and updates counter', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    await act(async () => {
      ReactDOMClient.createRoot(container).render(<Counter />);
    });

    const button = container.querySelector('button')!;
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('p')!.textContent).toBe('1');
  });
  ```

## Test Structure

- **Don't test implementation details.** Test what the user sees and does, not internal state or private methods.

  ```tsx
  // Before ❌ — tests internal state (brittle)
  const { result } = renderHook(() => useCounter());
  expect(result.current.internalCount).toBe(0); // internal detail

  // After ✅ — tests visible behavior
  render(<CounterDisplay />);
  expect(screen.getByText('Count: 0')).toBeInTheDocument();
  ```

- **One logical behavior per test.** Don't test multiple unrelated assertions in a single `it` block.

  ```tsx
  // Before ❌ — multiple unrelated concerns
  test('form behavior', async () => {
    render(<LoginForm />);
    // ... tests empty submission
    // ... tests wrong password
    // ... tests successful login
  });

  // After ✅ — one concern per test
  test('shows error when submitted empty', async () => { ... });
  test('shows error on wrong password', async () => { ... });
  test('redirects on successful login', async () => { ... });
  ```

## Testing Custom Hooks

- **Use `renderHook` from `@testing-library/react` to test custom hooks** in isolation, without building a wrapper component.

  ```tsx
  // Before ❌ — building a fake component just to test a hook
  function TestComponent() {
    const count = useCounter(1000);
    return <div>{count}</div>;
  }
  render(<TestComponent />);

  // After ✅ — renderHook
  import { renderHook, act } from '@testing-library/react';
  import { useCounter } from './useCounter';

  test('increments on interval', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCounter(1000));
    expect(result.current).toBe(0);

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current).toBe(1);

    vi.useRealTimers();
  });
  ```

## Mocking

- **Mock at the network or module boundary, not inside components.** Use `msw` (Mock Service Worker) to intercept HTTP requests, or `vi.mock` / `jest.mock` for module-level dependencies.

  ```tsx
  // Before ❌ — injecting mock via prop (couples test to implementation)
  render(<UserCard fetchUser={mockFetchUser} userId="1" />);

  // After ✅ — mock the network layer; component code is unchanged
  // msw handler in test setup:
  server.use(
    http.get('/api/users/1', () => HttpResponse.json({ name: 'Alice' })),
  );
  render(<UserCard userId="1" />);
  expect(await screen.findByText('Alice')).toBeInTheDocument();
  ```

## Debugging

- **Use `screen.debug()` to inspect the rendered DOM** when a query unexpectedly fails.

  ```tsx
  test('shows save button', () => {
    render(<Form />);
    screen.debug(); // prints the current DOM to stdout
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
  ```

- **Use `logRoles(container)` from `@testing-library/dom`** to see which accessible roles are available in the rendered output — useful when `getByRole` queries fail.

  ```tsx
  // Before ❌ — getByRole fails with no clear reason; guessing role names
  test('save button is visible', () => {
    const { container } = render(<SaveForm />);
    // Fails: Unable to find an accessible element with the role "button"
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  // After ✅ — logRoles reveals what roles and names are actually present
  import { logRoles } from '@testing-library/dom';

  test('save button is visible', () => {
    const { container } = render(<SaveForm />);
    logRoles(container);
    // stdout output shows, e.g.:
    //   button:
    //     Name "Save changes":
    //       <button ...>Save changes</button>
    // Now use the correct accessible name:
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
  });
  ```
