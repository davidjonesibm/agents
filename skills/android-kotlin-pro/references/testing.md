# Testing

Target: JUnit 5, MockK 1.13+, Turbine 1.1+, Compose Testing BOM 2024+, kotlinx-coroutines-test 1.9+.

## Unit Testing ViewModels

- **Use `runTest` from `kotlinx-coroutines-test`** for testing coroutine-based code. It uses `TestDispatcher` and auto-advances virtual time.

  ```kotlin
  @Test
  fun `loadTasks updates state to success`() = runTest {
      val fakeRepo = FakeTaskRepository(tasks = listOf(Task("1", "Test")))
      val viewModel = TaskViewModel(fakeRepo)

      viewModel.loadTasks()

      assertEquals(
          TaskUiState(items = listOf(Task("1", "Test")), isLoading = false),
          viewModel.uiState.value,
      )
  }
  ```

- **Inject `TestDispatcher`** via constructor for ViewModels that use explicit dispatchers:

  ```kotlin
  @Test
  fun `sync uses IO dispatcher`() = runTest {
      val testDispatcher = StandardTestDispatcher(testScheduler)
      val viewModel = SyncViewModel(repository, testDispatcher)

      viewModel.sync()
      advanceUntilIdle()

      assertTrue(viewModel.uiState.value.isSynced)
  }
  ```

## Testing Flows with Turbine

- **Use Turbine** to test `Flow` / `StateFlow` emissions declaratively:

  ```kotlin
  @Test
  fun `search emits filtered results`() = runTest {
      val viewModel = SearchViewModel(fakeRepo)

      viewModel.results.test {
          assertEquals(emptyList(), awaitItem()) // initial

          viewModel.onQueryChanged("kotlin")
          assertEquals(listOf(kotlinResult), awaitItem())

          cancelAndConsumeRemainingEvents()
      }
  }
  ```

- **`awaitItem()`** — waits for the next emission.
- **`awaitError()`** — waits for an error.
- **`expectNoEvents()`** — asserts no emissions within a timeout.
- **`cancelAndConsumeRemainingEvents()`** — clean up at test end.

## MockK

- Use **MockK** as the Kotlin-first mocking library (not Mockito):

  ```kotlin
  @Test
  fun `repository calls API on refresh`() = runTest {
      val api = mockk<TaskApi>()
      val dao = mockk<TaskDao>(relaxed = true)
      coEvery { api.getTasks() } returns listOf(Task("1", "Test"))

      val repo = TaskRepository(api, dao)
      repo.refresh()

      coVerify { api.getTasks() }
      coVerify { dao.upsertAll(any()) }
  }
  ```

- **`coEvery` / `coVerify`** — for suspend functions.
- **`every` / `verify`** — for regular functions.
- **`relaxed = true`** — auto-stubs all functions with default values (use sparingly).
- **`slot<T>()`** — capture arguments for assertion.

## Compose UI Testing

- **Use `createComposeRule()`** for pure Compose tests (no Activity needed):

  ```kotlin
  @get:Rule
  val composeTestRule = createComposeRule()

  @Test
  fun `counter increments on button click`() {
      composeTestRule.setContent {
          CounterScreen()
      }

      composeTestRule.onNodeWithText("Count: 0").assertIsDisplayed()
      composeTestRule.onNodeWithText("Increment").performClick()
      composeTestRule.onNodeWithText("Count: 1").assertIsDisplayed()
  }
  ```

- **Use `createAndroidComposeRule<Activity>()`** when you need an Activity context (e.g., for navigation, Hilt).

## Compose Finders & Matchers

```kotlin
// By text
composeTestRule.onNodeWithText("Submit")
composeTestRule.onAllNodesWithText("Item")

// By content description
composeTestRule.onNodeWithContentDescription("Close")

// By test tag
composeTestRule.onNodeWithTag("email_input")

// Compound matchers
composeTestRule.onNode(hasText("Submit") and hasClickAction())

// Hierarchical matchers
composeTestRule.onNode(hasParent(hasText("Form")))

// Unmerged tree (for inspecting individual children)
composeTestRule.onNodeWithText("World", useUnmergedTree = true)
```

## Compose Assertions

```kotlin
composeTestRule.onNodeWithText("Title").assertIsDisplayed()
composeTestRule.onNodeWithText("Title").assertExists()
composeTestRule.onNodeWithTag("button").assertIsEnabled()
composeTestRule.onAllNodesWithContentDescription("Star").assertCountEquals(5)
composeTestRule.onNode(matcher).assert(hasText("Expected"))
```

## Compose Actions

```kotlin
composeTestRule.onNodeWithTag("input").performTextInput("hello")
composeTestRule.onNodeWithText("Submit").performClick()
composeTestRule.onNodeWithTag("list").performScrollToIndex(10)
composeTestRule.onNodeWithTag("item").performTouchInput { swipeLeft() }
```

## Test Tags

- **Use `Modifier.testTag("identifier")` for test-specific identifiers** — prefer this over content description for non-semantic selectors:

  ```kotlin
  // In production code
  TextField(
      value = email,
      onValueChange = { onEmailChange(it) },
      modifier = Modifier.testTag("email_input"),
  )

  // In test
  composeTestRule.onNodeWithTag("email_input").performTextInput("test@example.com")
  ```

- **Enable `testTagsAsResourceId`** for UiAutomator interop:

  ```kotlin
  Scaffold(modifier = Modifier.semantics { testTagsAsResourceId = true }) { /* ... */ }
  ```

## Semantics Tree Debugging

- Print the semantics tree to diagnose test failures:

  ```kotlin
  composeTestRule.onRoot().printToLog("TEST")
  composeTestRule.onRoot(useUnmergedTree = true).printToLog("TEST_UNMERGED")
  ```

## Custom Semantics for Testing

- Define custom semantics properties for domain-specific assertions:

  ```kotlin
  val PickedDateKey = SemanticsPropertyKey<Long>("PickedDate")
  var SemanticsPropertyReceiver.pickedDate by PickedDateKey

  // In composable
  DatePicker(modifier = Modifier.semantics { pickedDate = selectedDate })

  // In test
  composeTestRule.onNode(SemanticsMatcher.expectValue(PickedDateKey, expectedTimestamp)).assertExists()
  ```

## Compose Test Synchronization

- Compose tests auto-synchronize — assertions wait for recomposition to settle.
- For animations or custom clocks, use `mainClock.advanceTimeBy()`:

  ```kotlin
  composeTestRule.mainClock.autoAdvance = false
  composeTestRule.mainClock.advanceTimeBy(500)
  ```

- Use `waitUntil` for async content:

  ```kotlin
  composeTestRule.waitUntil(timeoutMillis = 3000) {
      composeTestRule.onAllNodesWithTag("item").fetchSemanticsNodes().isNotEmpty()
  }
  ```

## Fake Repositories over Mocks

- **Prefer fakes over mocks for repositories** — they are simpler, safer, and more readable:

  ```kotlin
  class FakeTaskRepository : TaskRepository {
      private val tasks = mutableListOf<Task>()

      override fun observeAll(): Flow<List<Task>> = flowOf(tasks.toList())
      override suspend fun add(task: Task) { tasks.add(task) }
      override suspend fun delete(id: String) { tasks.removeAll { it.id == id } }
  }
  ```

## Test Dependencies

```kotlin
dependencies {
    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)

    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
    androidTestImplementation(libs.hilt.android.testing)
    kspAndroidTest(libs.hilt.compiler)
}
```
