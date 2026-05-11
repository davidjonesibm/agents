# Idiomatic Patterns and Anti-Patterns

Correct Recoil usage patterns, common anti-patterns, and selector design rules.

## Selectors for Derived State

- **Use selectors for derived data — never `useState` + `useEffect` to sync derived values.** Selectors are automatically memoized, cached, and recalculated only when dependencies change.

  ```tsx
  // Before — manual derived state with useEffect causes stale/double-render issues
  function FilteredList() {
    const items = useRecoilValue(itemsState);
    const filter = useRecoilValue(filterState);
    const [filtered, setFiltered] = useState<Item[]>([]);

    useEffect(() => {
      setFiltered(items.filter((i) => i.status === filter));
    }, [items, filter]);

    return <List items={filtered} />;
  }

  // After — selector derives filtered list automatically
  const filteredItemsState = selector<Item[]>({
    key: 'items/filtered',
    get: ({ get }) => {
      const items = get(itemsState);
      const filter = get(filterState);
      return items.filter((i) => i.status === filter);
    },
  });

  function FilteredList() {
    const filtered = useRecoilValue(filteredItemsState);
    return <List items={filtered} />;
  }
  ```

## Writable Selectors

- Use a writable selector to expose a logical read/write interface that maps to underlying atoms. This abstracts storage from consumers.

  ```tsx
  // Before — consumers must know about paneID to read/write the correct atom
  function PaneView() {
    const paneID = useContext(PaneIDContext);
    const [width, setWidth] = useRecoilState(viewWidthForPaneState(paneID));
    ...
  }

  // After — writable selector handles scope internally
  const viewWidthState = selector<number>({
    key: 'viewWidth',
    get: ({ get }) => get(viewWidthForPaneState(get(currentPaneState))),
    set: ({ get, set }, newValue) =>
      set(viewWidthForPaneState(get(currentPaneState)), newValue),
  });

  function PaneView() {
    const [width, setWidth] = useRecoilState(viewWidthState);
    ...
  }
  ```

## Async Selectors and Suspense

- Wrap components that read async selectors with `React.Suspense` and `ErrorBoundary`. Recoil throws a Promise (for Suspense) or an error on selector failure.

  ```tsx
  // Before — async selector read without Suspense; throws in render
  function UserInfo({ userID }: { userID: number }) {
    const user = useRecoilValue(userInfoQuery(userID)); // throws Promise ❌
    return <div>{user.name}</div>;
  }

  // After — wrapped with Suspense and ErrorBoundary
  const userInfoQuery = selectorFamily<User, number>({
    key: 'userInfo/query',
    get: (userID) => async () => {
      const res = await fetchUser(userID);
      if (res.error) throw res.error;
      return res.data;
    },
  });

  function App() {
    return (
      <RecoilRoot>
        <ErrorBoundary fallback={<div>Error</div>}>
          <React.Suspense fallback={<div>Loading…</div>}>
            <UserInfo userID={1} />
          </React.Suspense>
        </ErrorBoundary>
      </RecoilRoot>
    );
  }
  ```

- Use `useRecoilValueLoadable` to handle async state without Suspense (see `references/api.md`).

## selectorFamily for Parameterized Queries

- Use `selectorFamily` for parameterized derived data or async queries. Each unique parameter produces a memoized, cached selector instance.

  ```tsx
  // Before — manually recreating derived state per-component with useMemo
  function UserStats({ userID }: { userID: number }) {
    const allStats = useRecoilValue(allStatsState);
    const stats = useMemo(() => allStats[userID], [allStats, userID]);
    ...
  }

  // After — selectorFamily caches one selector per userID
  const userStatsQuery = selectorFamily<Stats, number>({
    key: 'userStats/query',
    get: (userID) => async () => {
      return await fetchStats(userID);
    },
  });

  function UserStats({ userID }: { userID: number }) {
    const stats = useRecoilValue(userStatsQuery(userID));
    ...
  }
  ```

## Normalized State

- **Normalize relational data using `atomFamily` + an ID-list atom** instead of storing large nested objects in a single atom. This scopes re-renders to only the affected item (see also `references/atoms.md` for the full atomFamily + ID-list pattern with iteration examples).

  ```tsx
  // Before — one atom for entire list; every change re-renders all consumers
  const todosState = atom<Todo[]>({ key: 'todos', default: [] });

  // After — normalized: ID list + per-item atom
  const todoIdsState = atom<string[]>({ key: 'todos/ids', default: [] });
  const todoItemState = atomFamily<Todo, string>({
    key: 'todos/item',
    default: { id: '', text: '', done: false },
  });
  ```

## Debugging State

- Use a `DebugObserver` component inside `<RecoilRoot>` during development to log all atom mutations. Remove from production builds.

  ```tsx
  function DebugObserver(): React.ReactElement | null {
    const snapshot = useRecoilSnapshot();
    useEffect(() => {
      for (const node of snapshot.getNodes_UNSTABLE({ isModified: true })) {
        console.debug('[Recoil]', node.key, snapshot.getLoadable(node));
      }
    }, [snapshot]);
    return null;
  }

  // Development only — wrap with environment check
  function App() {
    return (
      <RecoilRoot>
        {process.env.NODE_ENV === 'development' && <DebugObserver />}
        <YourApp />
      </RecoilRoot>
    );
  }
  ```

## Avoiding Atom Key Conflicts in Large Codebases

- Use a consistent naming convention such as `domain/atom-name` or `feature/atom-name` to prevent key collisions across teams and modules.

  ```tsx
  // Before — flat, collision-prone keys
  const loadingState = atom({ key: 'loading', default: false });
  const userState = atom({ key: 'user', default: null });

  // After — namespaced keys
  const authLoadingState = atom({ key: 'auth/loading', default: false });
  const authCurrentUserState = atom({ key: 'auth/currentUser', default: null });
  ```

## Time-Travel with Snapshots

- Use `useGotoRecoilSnapshot` with a history of `useRecoilSnapshot` values to implement undo/time-travel. Store snapshot IDs to deduplicate.

  ```tsx
  // Before — storing the raw snapshot object without deduplication adds a new entry
  // on every render, including duplicate snapshots from unrelated atom changes
  function TimeTravelObserver() {
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const snapshot = useRecoilSnapshot();

    useEffect(() => {
      setSnapshots((prev) => [...prev, snapshot]); // ❌ duplicates accumulate
    }, [snapshot]);

    const gotoSnapshot = useGotoRecoilSnapshot();
    return (
      <ol>
        {snapshots.map((s, i) => (
          <li key={i}>
            <button onClick={() => gotoSnapshot(s)}>Restore {i}</button>
          </li>
        ))}
      </ol>
    );
  }
  ```

  ```tsx
  // After — deduplicate by snapshot ID so each distinct state is recorded once
  function TimeTravelObserver() {
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const snapshot = useRecoilSnapshot();

    useEffect(() => {
      if (snapshots.every((s) => s.getID() !== snapshot.getID())) {
        setSnapshots((prev) => [...prev, snapshot]);
      }
    }, [snapshot]);

    const gotoSnapshot = useGotoRecoilSnapshot();

    return (
      <ol>
        {snapshots.map((s, i) => (
          <li key={i}>
            <button onClick={() => gotoSnapshot(s)}>Restore {i}</button>
          </li>
        ))}
      </ol>
    );
  }
  ```

  **Note:** `useRecoilSnapshot` re-renders on every state change — restrict to dev/debug components only.
