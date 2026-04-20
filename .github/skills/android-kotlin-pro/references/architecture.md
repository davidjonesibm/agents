# Architecture — MVVM / MVI / ViewModel / UiState

Target: AndroidX Lifecycle 2.8+, Kotlin 2.0+.

## MVVM with Unidirectional Data Flow (UDF)

- Use **ViewModel** as the single source of truth for screen-level state. Expose a single `StateFlow<UiState>` and accept user intents via functions.

  ```kotlin
  // Before — multiple exposed LiveData, bidirectional
  class ProfileViewModel : ViewModel() {
      val name = MutableLiveData<String>()
      val loading = MutableLiveData<Boolean>()
      val error = MutableLiveData<String?>()
  }

  // After — single sealed UiState, unidirectional
  data class ProfileUiState(
      val name: String = "",
      val isLoading: Boolean = false,
      val error: String? = null,
  )

  class ProfileViewModel @Inject constructor(
      private val repository: ProfileRepository,
  ) : ViewModel() {
      private val _uiState = MutableStateFlow(ProfileUiState())
      val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

      fun loadProfile(userId: String) {
          viewModelScope.launch {
              _uiState.update { it.copy(isLoading = true) }
              repository.getProfile(userId)
                  .onSuccess { profile ->
                      _uiState.update { it.copy(name = profile.name, isLoading = false) }
                  }
                  .onFailure { e ->
                      _uiState.update { it.copy(error = e.message, isLoading = false) }
                  }
          }
      }
  }
  ```

## MVI (Model-View-Intent) Pattern

- For complex screens, define explicit **Intent/Event** sealed classes to formalize all user actions:

  ```kotlin
  sealed interface ProfileIntent {
      data class LoadProfile(val userId: String) : ProfileIntent
      data object Retry : ProfileIntent
      data class UpdateName(val name: String) : ProfileIntent
  }

  class ProfileViewModel @Inject constructor(
      private val repository: ProfileRepository,
  ) : ViewModel() {
      private val _uiState = MutableStateFlow(ProfileUiState())
      val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

      fun onIntent(intent: ProfileIntent) {
          when (intent) {
              is ProfileIntent.LoadProfile -> loadProfile(intent.userId)
              is ProfileIntent.Retry -> retry()
              is ProfileIntent.UpdateName -> updateName(intent.name)
          }
      }
  }
  ```

## One-Off Events (Side Effects)

- **Never model one-off events (navigation, snackbar, toast) as `StateFlow` state.** Use `SharedFlow` or `Channel`:

  ```kotlin
  // Before — unreliable, event can be missed or replayed
  data class UiState(val navigateToHome: Boolean = false)

  // After — Channel for one-shot events consumed exactly once
  class LoginViewModel @Inject constructor(/*...*/) : ViewModel() {
      private val _events = Channel<LoginEvent>(Channel.BUFFERED)
      val events: Flow<LoginEvent> = _events.receiveAsFlow()

      fun onLoginSuccess() {
          viewModelScope.launch { _events.send(LoginEvent.NavigateHome) }
      }
  }

  sealed interface LoginEvent {
      data object NavigateHome : LoginEvent
      data class ShowError(val message: String) : LoginEvent
  }
  ```

## Collecting State in Compose

- **Always use `collectAsStateWithLifecycle()`** instead of `collectAsState()`. It respects the lifecycle and stops collection when the UI is not visible, saving resources.

  ```kotlin
  // Before
  val uiState by viewModel.uiState.collectAsState()

  // After
  val uiState by viewModel.uiState.collectAsStateWithLifecycle()
  ```

  Requires: `implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8+")`

## ViewModel Best Practices

- **Keep ViewModels free of Android framework references** (`Context`, `Activity`, `View`). Use `SavedStateHandle` for process-death restoration.

- **Use `viewModelScope`** for all coroutine launches — it auto-cancels on ViewModel clearing.

- **Prefer constructor injection** via Hilt `@HiltViewModel`. Avoid `ViewModelProvider.Factory` boilerplate.

  ```kotlin
  @HiltViewModel
  class TaskViewModel @Inject constructor(
      private val savedStateHandle: SavedStateHandle,
      private val taskRepository: TaskRepository,
  ) : ViewModel()
  ```

- **Never expose `MutableStateFlow` publicly.** Always expose `StateFlow` via `.asStateFlow()`.

  ```kotlin
  // Before — mutable state exposed
  val uiState = MutableStateFlow(HomeUiState())

  // After — immutable public API
  private val _uiState = MutableStateFlow(HomeUiState())
  val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()
  ```

## Screen-Level Composable Pattern

- Screen composables receive the ViewModel. Inner composables receive data + callbacks (no ViewModel dependency).

  ```kotlin
  @Composable
  fun ProfileScreen(viewModel: ProfileViewModel = hiltViewModel()) {
      val uiState by viewModel.uiState.collectAsStateWithLifecycle()
      ProfileContent(
          name = uiState.name,
          isLoading = uiState.isLoading,
          onRetry = { viewModel.onIntent(ProfileIntent.Retry) },
      )
  }

  @Composable
  fun ProfileContent(
      name: String,
      isLoading: Boolean,
      onRetry: () -> Unit,
  ) {
      // Pure UI — no ViewModel reference, fully previewable
  }
  ```

## Repository Pattern

- Repositories abstract data sources (network, database, cache). They return **`Flow`** for observable data or **`Result<T>`** / **`suspend`** for one-shot operations.

  ```kotlin
  class TaskRepository @Inject constructor(
      private val taskDao: TaskDao,
      private val api: TaskApi,
  ) {
      fun observeTasks(): Flow<List<Task>> = taskDao.observeAll()

      suspend fun refreshTasks(): Result<Unit> = runCatching {
          val tasks = api.fetchTasks()
          taskDao.upsertAll(tasks)
      }
  }
  ```

## UiState Design

- Use a **single data class** with default values. Avoid sealed classes for top-level state unless loading/error/success are truly mutually exclusive.

  ```kotlin
  data class HomeUiState(
      val items: ImmutableList<Item> = persistentListOf(),
      val isLoading: Boolean = false,
      val error: String? = null,
      val searchQuery: String = "",
  )
  ```

- For mutually exclusive states, use sealed interface:

  ```kotlin
  sealed interface DetailUiState {
      data object Loading : DetailUiState
      data class Success(val item: Item) : DetailUiState
      data class Error(val message: String) : DetailUiState
  }
  ```
