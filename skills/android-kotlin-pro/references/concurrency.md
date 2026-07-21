# Kotlin Coroutines & Flow

Target: kotlinx.coroutines 1.9+, Lifecycle 2.8+.

## Structured Concurrency

- **Always use structured concurrency.** Launch coroutines within a defined scope (`viewModelScope`, `lifecycleScope`, `coroutineScope {}`). Never use `GlobalScope`.

  ```kotlin
  // Before — unstructured, leak-prone
  GlobalScope.launch { repository.sync() }

  // After — scoped, auto-cancelled
  viewModelScope.launch { repository.sync() }
  ```

- **Use `coroutineScope { }` in suspend functions** to create child scopes that enforce structured cancellation:

  ```kotlin
  suspend fun fetchDashboard(): Dashboard = coroutineScope {
      val profile = async { api.getProfile() }
      val stats = async { api.getStats() }
      Dashboard(profile.await(), stats.await())
  }
  ```

## Dispatchers

- **`Dispatchers.Main.immediate`** — default for `viewModelScope`. Use for state updates.
- **`Dispatchers.IO`** — network, disk, database. Switch with `withContext(Dispatchers.IO)`.
- **`Dispatchers.Default`** — CPU-intensive work (sorting, parsing).

- **Inject dispatchers** for testability instead of hardcoding:

  ```kotlin
  class TaskRepository @Inject constructor(
      private val api: TaskApi,
      @IoDispatcher private val ioDispatcher: CoroutineDispatcher,
  ) {
      suspend fun fetchTasks(): List<Task> = withContext(ioDispatcher) {
          api.getTasks()
      }
  }
  ```

## StateFlow & SharedFlow

- **`StateFlow`** — holds a single current value, replays the latest to new collectors. Use for UI state.

  ```kotlin
  private val _uiState = MutableStateFlow(HomeUiState())
  val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()
  ```

- **`SharedFlow`** — broadcasts to all collectors without state retention. Use for events that multiple consumers may observe.

  ```kotlin
  private val _events = MutableSharedFlow<UiEvent>()
  val events: SharedFlow<UiEvent> = _events.asSharedFlow()
  ```

- **Use `Channel` for one-shot events** consumed by exactly one collector:

  ```kotlin
  private val _navEvents = Channel<NavEvent>(Channel.BUFFERED)
  val navEvents: Flow<NavEvent> = _navEvents.receiveAsFlow()
  ```

## Collecting Flows in Compose

- **Always use `collectAsStateWithLifecycle()`** — it stops collection when the UI is not visible (STOPPED), saving resources.

  ```kotlin
  // Before — collects even when app is backgrounded
  val state by viewModel.uiState.collectAsState()

  // After — lifecycle-aware
  val state by viewModel.uiState.collectAsStateWithLifecycle()
  ```

- For one-off events in Compose, use `LaunchedEffect` + `collect`:

  ```kotlin
  LaunchedEffect(Unit) {
      viewModel.navEvents.collect { event ->
          when (event) {
              is NavEvent.NavigateHome -> navController.navigate(HomeRoute)
          }
      }
  }
  ```

## Flow Operators

- **`map` / `filter`** — transform or filter emissions.
- **`combine`** — merge multiple flows into one, emitting when any source emits.

  ```kotlin
  val uiState: StateFlow<SearchUiState> = combine(
      searchQuery,
      repository.observeItems(),
  ) { query, items ->
      SearchUiState(
          results = items.filter { it.name.contains(query, ignoreCase = true) },
          query = query,
      )
  }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), SearchUiState())
  ```

- **`stateIn`** — convert a cold `Flow` to a hot `StateFlow`. Use `SharingStarted.WhileSubscribed(5000)` to keep upstream alive 5s after the last collector disappears (survives config changes).

  ```kotlin
  val tasks: StateFlow<List<Task>> = taskDao.observeAll()
      .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
  ```

- **`flatMapLatest`** — switch to a new flow when the source emits, cancelling the previous collection:

  ```kotlin
  val results: Flow<List<Result>> = searchQuery
      .debounce(300)
      .flatMapLatest { query -> repository.search(query) }
  ```

## Exception Handling

- **Use `try/catch` inside `launch` blocks** or install a `CoroutineExceptionHandler` on the scope.

  ```kotlin
  viewModelScope.launch {
      try {
          repository.sync()
      } catch (e: IOException) {
          _uiState.update { it.copy(error = "Network error") }
      }
  }
  ```

- **Use `supervisorScope` or `SupervisorJob()`** when child failures should not cancel siblings:

  ```kotlin
  supervisorScope {
      launch { syncModule1() } // failure here won't cancel module2
      launch { syncModule2() }
  }
  ```

- **Never silently swallow `CancellationException`** — always rethrow it:

  ```kotlin
  try {
      suspendingWork()
  } catch (e: CancellationException) {
      throw e // Must rethrow!
  } catch (e: Exception) {
      handleError(e)
  }
  ```

## Cancellation

- Coroutines are **cooperative** — they only cancel at suspension points. For CPU-bound loops, check `isActive` or call `ensureActive()`:

  ```kotlin
  suspend fun processItems(items: List<Item>) = coroutineScope {
      for (item in items) {
          ensureActive()
          process(item)
      }
  }
  ```

## Testing Coroutines

- Use `kotlinx-coroutines-test` with `runTest`, `TestDispatcher`, and `advanceUntilIdle()`. See `references/testing.md` for details.
