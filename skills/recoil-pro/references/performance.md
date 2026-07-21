# Performance Best Practices

Selector memoization, atom granularity, re-render minimization, and pre-fetching patterns.

## Selector Memoization

- **Use selectors for derived data — they are automatically memoized.** Recoil caches selector results and only recomputes when dependencies change. Do not wrap selector reads in `useMemo`.

  ```tsx
  // Before — useMemo used redundantly on selector-derived value
  function TodoStats() {
    const todos = useRecoilValue(todoListState);
    const completedCount = useMemo(
      () => todos.filter((t) => t.done).length,
      [todos],
    );
    return <span>{completedCount} done</span>;
  }

  // After — put derivation in a selector; no useMemo needed
  const completedCountState = selector<number>({
    key: 'todos/completedCount',
    get: ({ get }) => get(todoListState).filter((t) => t.done).length,
  });

  function TodoStats() {
    const completedCount = useRecoilValue(completedCountState);
    return <span>{completedCount} done</span>;
  }
  ```

## Atom Granularity

- **Split large atoms into smaller atoms to minimize re-renders.** A component subscribed to a fine-grained atom re-renders only when that atom changes, not when unrelated state changes.

  ```tsx
  // Before — one large user object; any field change re-renders all consumers
  const userState = atom<{ name: string; email: string; preferences: Prefs }>({
    key: 'user',
    default: { name: '', email: '', preferences: {} },
  });

  // After — split into independent atoms
  const userNameState = atom<string>({ key: 'user/name', default: '' });
  const userEmailState = atom<string>({ key: 'user/email', default: '' });
  const userPrefsState = atom<Prefs>({ key: 'user/preferences', default: {} });
  ```

- For collections, use a normalized `atomFamily` + ID list instead of a single atom of an array (see `references/atoms.md` for the pattern). This ensures only the affected item triggers a re-render.

## React.memo with Recoil

- Wrap leaf components that subscribe to atoms with `React.memo` to prevent parent-caused re-renders. Recoil's subscription already prevents re-renders from unrelated atoms, but `React.memo` stops parent re-renders from cascading.

  ```tsx
  // Before — TodoItem re-renders whenever its parent re-renders
  function TodoItem({ id }: { id: string }) {
    const item = useRecoilValue(todoItemState(id));
    return <li>{item.text}</li>;
  }

  // After — React.memo prevents re-renders not caused by state change
  const TodoItem = React.memo(function TodoItem({ id }: { id: string }) {
    const item = useRecoilValue(todoItemState(id));
    return <li>{item.text}</li>;
  });
  ```

## Pre-fetching with useRecoilCallback

- **Pre-fetch selector data on user interaction** using `useRecoilCallback` to start loading before the component that needs the data mounts. This eliminates render waterfalls.

  ```tsx
  // Before — data fetched only after component mounts (waterfall)
  function UserList() {
    const users = useRecoilValue(usersState);
    return (
      <>
        {users.map((u) => (
          <UserDetail key={u.id} userID={u.id} /> // each mounts, then fetches
        ))}
      </>
    );
  }

  // After — pre-fetch on hover/click before navigating
  function UserList() {
    const users = useRecoilValue(usersState);
    const prefetch = useRecoilCallback(
      ({ snapshot }) =>
        (userID: number) => {
          snapshot.getLoadable(userInfoQuery(userID)); // kicks off the async selector
        },
      [],
    );

    return (
      <>
        {users.map((u) => (
          <li
            key={u.id}
            onMouseEnter={() => prefetch(u.id)} // pre-fetch on hover
          >
            <UserDetail userID={u.id} />
          </li>
        ))}
      </>
    );
  }
  ```

## Selector Cache Policy

- For `selectorFamily` instances that receive many distinct parameters, configure `cachePolicy_UNSTABLE` to limit memory usage.

  ```tsx
  // Before — default 'keep-all' cache retains all computed values indefinitely
  const userDataQuery = selectorFamily<UserData, number>({
    key: 'userData/query',
    get: (userID) => async () => fetchUserData(userID),
  });

  // After — LRU cache limits retained entries
  const userDataQuery = selectorFamily<UserData, number>({
    key: 'userData/query',
    get: (userID) => async () => fetchUserData(userID),
    cachePolicy_UNSTABLE: { eviction: 'lru', maxSize: 200 },
  });
  ```

  Available policies: `{ eviction: 'keep-all' }` (default), `{ eviction: 'lru', maxSize: N }`, `{ eviction: 'most-recent' }`.

  **Note:** `cachePolicy_UNSTABLE` is marked unstable and may change in future versions.

## Avoiding Waterfall Queries

- **Use parallel `selectorFamily` subscriptions instead of sequential reads** to avoid request waterfalls in async selectors.

  ```tsx
  // Before — sequential: friendsInfo waits for currentUser to finish
  const friendsInfoQuery = selector({
    key: 'friendsInfo',
    get: async ({ get }) => {
      const user = await get(currentUserQuery);  // must resolve first
      return await fetchFriends(user.id);
    },
  });

  // After — pass IDs as parameters so both queries can run in parallel
  const friendsInfoQuery = selectorFamily<Friend[], number>({
    key: 'friendsInfo',
    get: (userID) => async () => fetchFriends(userID),
  });

  function UserDashboard() {
    const user = useRecoilValue(currentUserQuery);
    const friends = useRecoilValue(friendsInfoQuery(user.id)); // parallel render
    ...
  }
  ```

## useRecoilValueLoadable for Non-Blocking UIs

- Prefer `useRecoilValueLoadable` over `Suspense` boundaries when you need inline loading states within the component rather than full subtree fallbacks (see `references/api.md`).

  ```tsx
  // Before — Suspense fallback replaces entire component tree
  <Suspense fallback={<Spinner />}>
    <UserPanel /> {/* entire panel replaced on load */}
  </Suspense>;

  // After — loadable shows inline state within the component
  function UserPanel() {
    const loadable = useRecoilValueLoadable(currentUserQuery);
    return (
      <div>
        <Header />
        {loadable.state === 'loading' ? (
          <Skeleton />
        ) : (
          <UserInfo user={loadable.contents} />
        )}
      </div>
    );
  }
  ```
