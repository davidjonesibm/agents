# TypeScript Patterns

Typing atoms, selectors, atom families, selector families, hooks, and Recoil-specific types.

## Typing Atoms

- Always provide an explicit type parameter to `atom<T>`. Without it, the type is inferred from `default`, which may be too narrow or accidentally `null`.

  ```tsx
  // Before — type inferred as 'null'; breaks downstream type inference
  const currentUserState = atom({ key: 'auth/currentUser', default: null });

  // After — explicit generic ensures correct type
  import { atom } from 'recoil';

  type User = { id: number; name: string; email: string };

  const currentUserState = atom<User | null>({
    key: 'auth/currentUser',
    default: null,
  });
  ```

## Typing Selectors

- Provide an explicit `T` to `selector<T>`. Read-only selectors return `RecoilValueReadOnly<T>`; writable selectors (with `set`) return `RecoilState<T>`.

  ```tsx
  import { selector } from 'recoil';

  // Read-only selector — returns RecoilValueReadOnly<string>
  const displayNameState = selector<string>({
    key: 'auth/displayName',
    get: ({ get }) => {
      const user = get(currentUserState);
      return user?.name ?? 'Guest';
    },
  });

  // Writable selector — returns RecoilState<number>
  const magnifiedFontSizeState = selector<number>({
    key: 'ui/magnifiedFontSize',
    get: ({ get }) => get(fontSizeState) * 2,
    set: ({ set }, newValue) =>
      set(
        fontSizeState,
        newValue instanceof DefaultValue ? newValue : newValue / 2,
      ),
  });
  ```

## Typing atomFamily

- Provide both the value type `T` and the parameter type `P` to `atomFamily<T, P>`. Parameters must be serializable; use `string | number | readonly string[]` as parameter types.

  ```tsx
  import { atomFamily } from 'recoil';

  type Todo = { id: string; text: string; done: boolean };

  // Before — no type parameters; types are 'unknown'
  const todoItemState = atomFamily({ key: 'todos/item', default: null });

  // After — explicit type parameters
  const todoItemState = atomFamily<Todo | null, string>({
    key: 'todos/item',
    default: null,
  });

  // Usage — TypeScript knows item is Todo | null
  const item = useRecoilValue(todoItemState('abc-123'));
  ```

## Typing selectorFamily

- Provide `T` (return type) and `P` (parameter type) to `selectorFamily<T, P>`. Parameters must be serializable.

  ```tsx
  import { selectorFamily } from 'recoil';

  type UserData = { id: number; name: string };

  const userDataQuery = selectorFamily<UserData, number>({
    key: 'users/query',
    get: (userID: number) => async (): Promise<UserData> => {
      const res = await fetchUser(userID);
      if (res.error) throw res.error;
      return res.data;
    },
  });

  // Usage — TypeScript infers UserData
  const user = useRecoilValue(userDataQuery(42));
  ```

## RecoilState and RecoilValueReadOnly

- Use `RecoilState<T>` for writeable atom/selector references and `RecoilValueReadOnly<T>` for read-only selector references in function signatures and utility types.

  ```tsx
  import { RecoilState, RecoilValueReadOnly, useRecoilValue } from 'recoil';

  // Before — generic 'any' loses type safety
  function useAtomLogger(state: any) {
    const value = useRecoilValue(state);
    console.log(value);
  }

  // After — typed parameter; works with atoms and selectors
  function useAtomLogger<T>(state: RecoilState<T> | RecoilValueReadOnly<T>) {
    const value = useRecoilValue(state);
    console.log(value);
  }
  ```

## SetterOrUpdater

- Use `SetterOrUpdater<T>` to type a setter function received from `useRecoilState` or `useSetRecoilState`, e.g., when passing as a prop.

  ```tsx
  import { SetterOrUpdater } from 'recoil';

  // Before — setter typed as 'any' or Function
  function FormContent({ setSelf }: { setSelf: any }) {
    return <button onClick={() => setSelf('new')}>Set</button>;
  }

  // After — correctly typed setter
  function FormContent({ setSelf }: { setSelf: SetterOrUpdater<string> }) {
    return <button onClick={() => setSelf('new')}>Set</button>;
  }

  function Form() {
    const setSelf = useSetRecoilState(valueState);
    return <FormContent setSelf={setSelf} />;
  }
  ```

## DefaultValue in Writable Selectors

- In writable selector `set` handlers, the `newValue` parameter is `T | DefaultValue`. Use `instanceof DefaultValue` to detect a reset and propagate it correctly.

  ```tsx
  // Before — newValue cast to number; crashes when caller triggers a reset
  import { selector } from 'recoil';

  const celsiusState = selector<number>({
    key: 'temp/celsius',
    get: ({ get }) => (get(fahrenheitState) - 32) * (5 / 9),
    set: ({ set }, newValue) => {
      set(fahrenheitState, (newValue as number) * (9 / 5) + 32); // ❌ throws on reset
    },
  });
  ```

  ```tsx
  // After — propagate DefaultValue (reset signal) instead of coercing to number
  import { DefaultValue, selector } from 'recoil';

  const celsiusState = selector<number>({
    key: 'temp/celsius',
    get: ({ get }) => (get(fahrenheitState) - 32) * (5 / 9),
    set: ({ set }, newValue) => {
      set(
        fahrenheitState,
        newValue instanceof DefaultValue ? newValue : newValue * (9 / 5) + 32,
      );
    },
  });
  ```

## Typing Atom Effects

- Use the `AtomEffect<T>` type from Recoil to type custom effect factories.

  ```tsx
  import { AtomEffect, atom } from 'recoil';

  function localStorageEffect<T>(key: string): AtomEffect<T> {
    return ({ setSelf, onSet }) => {
      const saved = localStorage.getItem(key);
      if (saved != null) setSelf(JSON.parse(saved) as T);

      onSet((newValue, _, isReset) => {
        isReset
          ? localStorage.removeItem(key)
          : localStorage.setItem(key, JSON.stringify(newValue));
      });
    };
  }

  const themeState = atom<'light' | 'dark'>({
    key: 'ui/theme',
    default: 'light',
    effects: [localStorageEffect<'light' | 'dark'>('theme')],
  });
  ```

## Typing useRecoilCallback

- Provide the `Args` and `ReturnValue` generics explicitly when the inferred types are ambiguous.

  ```tsx
  import { useRecoilCallback } from 'recoil';

  // Typed callback: takes a userID number, returns void
  const prefetch = useRecoilCallback<[number], void>(
    ({ snapshot }) =>
      (userID: number) => {
        snapshot.getLoadable(userInfoQuery(userID));
      },
    [],
  );
  ```
