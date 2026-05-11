# Idiomatic React Patterns and Anti-Patterns

Component design, composition, state ownership, and common mistakes — for React 19+.

## State Ownership

- **Lift state to the lowest common ancestor** that needs to share it. Don't lift higher than necessary — unneeded lifting causes excessive re-renders.

  ```tsx
  // Before ❌ — state in App, but only used by Siblings
  function App() {
    const [value, setValue] = useState('');
    return (
      <>
        <SearchBox value={value} onChange={setValue} />
        <Results query={value} />
        <UnrelatedSection /> {/* re-renders on every value change */}
      </>
    );
  }

  // After ✅ — state lifted only as high as needed
  function SearchFeature() {
    const [value, setValue] = useState('');
    return (
      <>
        <SearchBox value={value} onChange={setValue} />
        <Results query={value} />
      </>
    );
  }
  function App() {
    return (
      <>
        <SearchFeature />
        <UnrelatedSection /> {/* no longer affected */}
      </>
    );
  }
  ```

## Derived State

- **Compute derived values during render, never duplicate them in state.** Duplicated state can diverge and requires manual sync.

  ```tsx
  // Before ❌ — filteredItems duplicates items in state
  const [items, setItems] = useState(data);
  const [filteredItems, setFilteredItems] = useState([]);
  useEffect(() => setFilteredItems(items.filter((i) => i.active)), [items]);

  // After ✅ — single source of truth, derived on every render
  const [items, setItems] = useState(data);
  const filteredItems = items.filter((i) => i.active); // computed in render
  ```

## Controlled vs Uncontrolled Components

- **Prefer controlled inputs** when you need to validate, transform, or synchronize input values. Use uncontrolled inputs only for simple forms where React doesn't need to know the value until submit.

  ```tsx
  // Controlled ✅ — React owns the value
  function EmailInput() {
    const [email, setEmail] = useState('');
    return (
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value.toLowerCase())}
      />
    );
  }

  // Uncontrolled ✅ — fine for simple read-on-submit forms
  function SimpleForm() {
    const ref = useRef(null);
    function handleSubmit() {
      console.log(ref.current.value);
    }
    return <input ref={ref} type="email" />;
  }
  ```

## Composition over Inheritance

- **Compose via children and render props, never via class inheritance.** React doesn't recommend component inheritance for sharing UI logic.

  ```tsx
  // Before ❌ — inheritance to share UI
  class FancyButton extends Button { ... }

  // After ✅ — composition via children
  function FancyButton({ children, ...props }) {
    return (
      <button className="fancy" {...props}>
        {children}
      </button>
    );
  }
  ```

## Key Prop Usage

- **Always provide a stable, unique `key` on list items.** Keys must identify the item, not its position. Index keys cause stale state and animation bugs when lists reorder or filter.

  ```tsx
  // Before ❌ — index key breaks state when list reorders
  {
    items.map((item, index) => <TodoItem key={index} todo={item} />);
  }

  // After ✅ — stable key from data
  {
    items.map((item) => <TodoItem key={item.id} todo={item} />);
  }
  ```

- **Use `key` intentionally to reset component state.** Changing a component's `key` unmounts and remounts it, clearing all internal state — this is the canonical way to "reset" a child component.

  ```tsx
  // Changing key resets the form's internal state when userId changes
  <ProfileForm key={userId} userId={userId} />
  ```

## Event Handling

- **Separate event handlers from effects.** Event handlers respond to _user intent_ (always run). Effects respond to _synchronization needs_ (may re-run). Don't put event-driven logic in effects.

  ```tsx
  // Before ❌ — sending message in an effect
  useEffect(() => {
    if (shouldSend) sendMessage(message);
  }, [shouldSend, message]);

  // After ✅ — send in the event handler
  function handleSend() {
    sendMessage(message);
  }
  ```

- **Stop propagation deliberately.** Call `e.stopPropagation()` only when you consciously want to prevent parent handlers from firing. Avoid using it to paper over unexpected bubbling.

  ```tsx
  // Fine when intentional
  function Modal({ onClose }) {
    return (
      <div onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>
          {' '}
          {/* prevent close on inner click */}
          ...
        </div>
      </div>
    );
  }
  ```

## Context Design

- **Co-locate context, reducer, and provider in one file** for complex global state. Keeps the component tree clean and logic centralized.

  ```tsx
  // tasks-context.tsx
  import { createContext, useReducer, useMemo } from 'react';

  export const TasksContext = createContext(null);
  export const TasksDispatchContext = createContext(null);

  export function TasksProvider({ children }) {
    const [tasks, dispatch] = useReducer(tasksReducer, initialTasks);
    const dispatchStable = useMemo(() => dispatch, []); // dispatch is already stable

    return (
      <TasksContext value={tasks}>
        <TasksDispatchContext value={dispatchStable}>
          {children}
        </TasksDispatchContext>
      </TasksContext>
    );
  }
  ```

- **Don't put objects or arrays directly as context values without memoization.** A new object literal on every render causes all consumers to re-render.

  ```tsx
  // Before ❌ — new object every render, all consumers re-render
  <UserContext value={{ user, setUser }}>...</UserContext>;

  // After ✅ — memoized value, consumers only re-render when user changes
  const ctxValue = useMemo(() => ({ user, setUser }), [user]);
  <UserContext value={ctxValue}>...</UserContext>;
  ```

  See also `references/performance.md` for memoization details and `references/hooks.md` for `useCallback` on setters.

## Prop Naming

- **Prefix event handler props with `on`.** This is the React convention and aligns with built-in elements.

  ```tsx
  // Before ❌
  <Button clicked={handleClick} />

  // After ✅
  <Button onClick={handleClick} />
  // Custom: onPlayMovie, onUploadFile, etc.
  ```

## State Normalization

- **Flatten nested state objects.** Deeply nested state is hard to update immutably and easy to corrupt.

  ```tsx
  // Before ❌ — deeply nested, hard to update without spreading
  const [form, setForm] = useState({
    user: { address: { city: '', zip: '' } },
  });

  // After ✅ — flat shape, easy to update
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  ```

## Avoiding Anti-Patterns

- **Don't initialize state from props when the prop can change.** The initial value is only used on mount — later prop changes are ignored, leading to stale UI.

  ```tsx
  // Before ❌ — stale after userId changes
  function Profile({ userId, initialName }) {
    const [name, setName] = useState(initialName); // stale if prop changes
  }

  // After ✅ — use key to reset, or make it fully controlled
  <Profile key={userId} userId={userId} initialName={initialName} />;
  ```

- **Don't mutate state directly.** Always produce a new reference for objects and arrays.

  ```tsx
  // Before ❌ — mutating state — React won't detect the change
  items.push(newItem);
  setItems(items);

  // After ✅ — new array reference
  setItems([...items, newItem]);
  ```
