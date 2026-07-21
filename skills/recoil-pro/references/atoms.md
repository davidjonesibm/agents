# Atom Design, atomFamily, and Atom Effects

Rules for designing atoms, parameterized atom families, and side-effect management via atom effects.

## Atom Keys

- **Always use globally unique, namespaced atom keys.** Duplicate keys cause silent state collisions in production (Recoil only warns in development).

  ```tsx
  // Before — generic key; collides if another module also uses 'filter'
  const filterState = atom({ key: 'filter', default: 'all' });

  // After — namespaced key prevents collision
  const filterState = atom({ key: 'todoList/filter', default: 'all' });
  ```

- **Never generate atom keys dynamically at runtime inside render.** Each unique key creates a permanent atom entry. Use `atomFamily` instead (see below).

  ```tsx
  // Before — new atom created on every render; memory leak
  function TodoItem({ id }: { id: string }) {
    const todoAtom = atom({ key: `todo-${id}`, default: null }); // ❌
    const todo = useRecoilValue(todoAtom);
    ...
  }

  // After — atomFamily creates one atom per unique parameter, memoized
  const todoItemState = atomFamily<Todo | null, string>({
    key: 'todo/item',
    default: null,
  });

  function TodoItem({ id }: { id: string }) {
    const todo = useRecoilValue(todoItemState(id));
    ...
  }
  ```

## atomFamily

- Use `atomFamily` when you need a distinct atom for each member of a collection (e.g., per-item, per-user, per-pane).

  ```tsx
  // Before — single atom holds entire map; every consumer re-renders on any item change
  const allItemsState = atom<Record<string, Item>>({ key: 'items', default: {} });

  // After — atomFamily gives each item its own atom
  const itemState = atomFamily<Item | null, string>({
    key: 'items/item',
    default: null,
  });

  function ItemView({ id }: { id: string }) {
    const item = useRecoilValue(itemState(id)); // re-renders only when this item changes
    ...
  }
  ```

- Pair `atomFamily` with a separate atom for the collection's ID list to enable iteration.

  ```tsx
  const itemIdsState = atom<string[]>({ key: 'items/ids', default: [] });
  const itemState = atomFamily<Item, string>({
    key: 'items/item',
    default: defaultItem,
  });

  // Iterate the list; each ItemRow only re-renders when its own item changes
  function ItemList() {
    const ids = useRecoilValue(itemIdsState);
    return (
      <>
        {ids.map((id) => (
          <ItemRow key={id} id={id} />
        ))}
      </>
    );
  }
  ```

- `atomFamily` parameters must be serializable (strings, numbers, plain objects). Do not use class instances, functions, or React refs as parameters.

  ```tsx
  // Before — function parameter breaks equality check; creates new atom every call
  const dataState = atomFamily({
    key: 'data',
    default: (fn: () => void) => null,
  }); // ❌

  // After — use a serializable ID
  const dataState = atomFamily<Data | null, string>({
    key: 'data',
    default: null,
  });
  ```

## Atom Defaults

- Atom `default` can be a static value, a `Promise`, a `Loadable`, or another `RecoilValue` (atom or selector). When set to a selector, the atom is initialized from it but becomes independent on write.

  ```tsx
  // Static default
  const countState = atom({ key: 'count', default: 0 });

  // Default from another atom/selector — initialized from currentUserIDState
  const userInfoState = atom({
    key: 'userInfo',
    default: selector({
      key: 'userInfo/default',
      get: ({ get }) => myFetchUserInfo(get(currentUserIDState)),
    }),
  });
  ```

## Atom Effects

- Use the `effects` array for side effects: persistence, logging, sync with external stores. Effects run in order; later effects override earlier ones for `setSelf`.

  ```tsx
  // Effect signature
  type AtomEffect<T> = (params: {
    node: RecoilState<T>;
    setSelf: (value: T | DefaultValue | Promise<T>) => void;
    onSet: (handler: (newVal: T, oldVal: T, isReset: boolean) => void) => void;
    trigger: 'get' | 'set';
  }) => void | (() => void); // return cleanup fn for subscriptions
  ```

- **Persist atom state to localStorage** — synchronously read on init, synchronously write on change.

  ```tsx
  const localStorageEffect = <T>(key: string) =>
    ({ setSelf, onSet }: Parameters<AtomEffect<T>>[0]): void => {
      const saved = localStorage.getItem(key);
      if (saved != null) setSelf(JSON.parse(saved));

      onSet((newValue, _, isReset) => {
        isReset
          ? localStorage.removeItem(key)
          : localStorage.setItem(key, JSON.stringify(newValue));
      });
    };

  const currentUserIDState = atom<number>({
    key: 'currentUserID',
    default: 1,
    effects: [localStorageEffect('current_user')],
  });
  ```

- **Use async `setSelf` to initialize from remote storage without triggering Suspense.** The atom uses its `default` value until the async read resolves.

  ```tsx
  const remoteEffect =
    (userID: string) =>
    ({ setSelf, trigger }: Parameters<AtomEffect<UserInfo>>[0]): void => {
      if (trigger === 'get') {
        // only fetch on first read, not on set
        myRemoteStorage.get(userID).then(setSelf);
      }
      // subscribe to external changes
      const unsubscribe = myRemoteStorage.onChange(userID, setSelf);
      return () => unsubscribe(); // cleanup
    };
  ```

- **Use `trigger === 'get'` guard** to run initialization only when the atom is first read, not when it's written.

  ```tsx
  // Before — effect always runs, even on write-triggered initialization
  const effect = ({ setSelf }) => {
    fetchUserData().then(setSelf); // runs on every write too ❌
  };

  // After — guard with trigger
  const effect = ({ setSelf, trigger }) => {
    if (trigger === 'get') {
      fetchUserData().then(setSelf);
    }
  };
  ```

- **Return a cleanup function from effects that set up subscriptions.** Without cleanup, subscriptions accumulate across React StrictMode double-invocations and hot reloads.

  ```tsx
  // Before — subscription not cleaned up
  const effect = ({ setSelf }) => {
    socket.on('update', setSelf);
  };

  // After — cleanup removes listener
  const effect = ({ setSelf }) => {
    socket.on('update', setSelf);
    return () => socket.off('update', setSelf);
  };
  ```

- **Use `DefaultValue` in effects to detect resets and handle them explicitly.**

  ```tsx
  import { DefaultValue } from 'recoil';

  onSet((newValue, _, isReset) => {
    if (isReset) {
      localStorage.removeItem(key); // clear persisted value on reset
    } else {
      localStorage.setItem(key, JSON.stringify(newValue));
    }
  });
  ```

- **`atomFamily` effects can be parameterized** — each family instance receives its own param.

  ```tsx
  const itemState = atomFamily<Item, string>({
    key: 'items/item',
    default: null,
    effects: (id) => [
      ({ setSelf }) => {
        fetchItem(id).then(setSelf);
      },
    ],
  });
  ```
