# TypeScript Patterns for React

Typing components, props, hooks, events, refs, and generics — for React 19+ with TypeScript 5+.

## Component Props

- **Prefer `interface` over `type` for component props** — it produces cleaner error messages and supports declaration merging when needed.

  ```tsx
  // Before ❌ — type alias (works, but interface preferred for props)
  type ButtonProps = {
    label: string;
    disabled?: boolean;
  };

  // After ✅
  interface ButtonProps {
    /** The text to display inside the button */
    label: string;
    /** Whether the button can be interacted with */
    disabled?: boolean;
  }

  function Button({ label, disabled }: ButtonProps) {
    return <button disabled={disabled}>{label}</button>;
  }
  ```

- **Don't use `React.FC` to annotate components.** It implicitly adds `children` to props (no longer true in React 18+, but still confusing) and wraps the return type in `ReactElement | null`, which is unnecessary and obscures generic component typing.

  ```tsx
  // Before ❌ — React.FC adds implicit complexity
  const Greeting: React.FC<{ name: string }> = ({ name }) => (
    <h1>Hello, {name}</h1>
  );

  // After ✅ — annotate props directly, return type inferred
  function Greeting({ name }: { name: string }) {
    return <h1>Hello, {name}</h1>;
  }
  ```

## Children

- **Type children as `React.ReactNode`** — it accepts JSX, strings, numbers, arrays, and `null`.

  ```tsx
  // Before ❌ — too narrow (JSX.Element excludes strings and null)
  interface CardProps {
    children: JSX.Element;
  }

  // After ✅
  interface CardProps {
    children: React.ReactNode;
  }

  function Card({ children }: CardProps) {
    return <div className="card">{children}</div>;
  }
  ```

## Event Types

- **Always type event handler parameters explicitly** when extracting them out of inline JSX. TypeScript cannot infer them in that context.

  ```tsx
  // Before ❌ — 'e' is implicitly 'any'
  function handleChange(e) {
    setValue(e.target.value);
  }

  // After ✅
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
  }

  // Common event types:
  // React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  // React.MouseEvent<HTMLButtonElement>
  // React.KeyboardEvent<HTMLInputElement>
  // React.FormEvent<HTMLFormElement>
  // React.FocusEvent<HTMLInputElement>
  ```

- **Type `useCallback` event handlers with the event handler type alias** for cleaner signatures.

  ```tsx
  // Using event handler type alias ✅
  const handleChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => setValue(e.currentTarget.value),
    [setValue],
  );
  ```

## useRef Types

- **Use `useRef<HTMLElement>(null)` for DOM refs.** The `null` initial value and generic type tell TypeScript the ref will be assigned by React.

  ```tsx
  // Before ❌ — ref typed as any or missing generic
  const inputRef = useRef(null);
  inputRef.current.focus(); // TS error: Object is possibly null

  // After ✅ — properly typed, null-safe
  const inputRef = useRef<HTMLInputElement>(null);
  function focusInput() {
    inputRef.current?.focus(); // optional chain for safety
  }
  return <input ref={inputRef} />;
  ```

- **Use `useRef<T | null>(null)` (or `useRef<T>()`) for mutable value refs** that you manage yourself (timers, subscriptions).

  ```tsx
  // Mutable timer ref — not attached to DOM
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => doSomething(), 1000);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);
  ```

## useState Types

- **Rely on type inference when the initial value clearly conveys the type.** Provide an explicit generic when the initial value is `null`, `undefined`, or an empty array.

  ```tsx
  // Inferred ✅
  const [count, setCount] = useState(0); // number
  const [name, setName] = useState(''); // string

  // Explicit generic needed ✅
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<string[]>([]);
  ```

## Generic Components

- **Use the `<T,>` trailing comma syntax in `.tsx` files** to disambiguate from JSX tags. Without it, TypeScript may parse `<T>` as a JSX element.

  ```tsx
  // Before ❌ — TypeScript may misparse <T> in .tsx
  function identity<T>(value: T): T {
    return value;
  }

  // After ✅ — trailing comma signals type parameter
  function identity<T>(value: T): T {
    return value;
  }

  // Generic component example ✅
  interface ListProps<T> {
    items: T[];
    renderItem: (item: T) => React.ReactNode;
  }

  function List<T>({ items, renderItem }: ListProps<T>) {
    return (
      <ul>
        {items.map((item, i) => (
          <li key={i}>{renderItem(item)}</li>
        ))}
      </ul>
    );
  }
  ```

## Extracting Props Types

- **Use `React.ComponentProps<typeof X>` to extract the props type of an existing component.** Avoids duplicating type definitions.

  ```tsx
  // Before ❌ — duplicated type definition
  interface ButtonProps { onClick: () => void; label: string; }
  function Button(props: ButtonProps) { ... }
  interface WrappedButtonProps { onClick: () => void; label: string; className?: string; }

  // After ✅ — extends inferred type
  function Button({ onClick, label }: { onClick: () => void; label: string }) { ... }

  type WrappedButtonProps = React.ComponentProps<typeof Button> & {
    className?: string;
  };
  function WrappedButton({ className, ...rest }: WrappedButtonProps) {
    return <Button {...rest} />;
  }
  ```

## Discriminated Union Props

- **Use discriminated unions for variant props** instead of optional boolean flags that combine illegally.

  ```tsx
  // Before ❌ — invalid combinations possible (both icon and text, or neither)
  interface BadgeProps {
    icon?: string;
    text?: string;
    count?: number;
  }

  // After ✅ — discriminated union ensures exactly one variant
  type BadgeProps =
    | { variant: 'icon'; icon: string }
    | { variant: 'text'; text: string }
    | { variant: 'count'; count: number };

  function Badge(props: BadgeProps) {
    if (props.variant === 'icon') return <img src={props.icon} />;
    if (props.variant === 'text') return <span>{props.text}</span>;
    return <sup>{props.count}</sup>;
  }
  ```

## Inline Style Props

- **Use `React.CSSProperties` for inline style objects** — it provides autocomplete and rejects invalid CSS property names.

  ```tsx
  // Before ❌ — untyped
  function Box({ style }: { style: object }) { ... }

  // After ✅
  function Box({ style }: { style: React.CSSProperties }) {
    return <div style={style} />;
  }
  ```

## React 19 TypeScript Changes

- **`ReactElement["props"]` is now `unknown` by default** (was `any`). Provide an explicit type argument when reading props from a `ReactElement`.

  ```tsx
  // Before — relied on props: any (now a TS error)
  function readTitle(el: ReactElement) {
    return el.props.title; // TS error: props is unknown
  }

  // After ✅
  function readTitle(el: ReactElement<{ title: string }>) {
    return el.props.title; // string ✅
  }
  ```
