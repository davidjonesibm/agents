# Jetpack Compose — Patterns & State Management

Target: Compose BOM 2024+, Compose Compiler merged into Kotlin 2.0+.

## State Hoisting

- **Always hoist state out of leaf composables.** The composable receives the current value and an `onValueChange` callback. This makes composables stateless, reusable, and testable.

  ```kotlin
  // Before — stateful, hard to test
  @Composable
  fun SearchBar() {
      var query by remember { mutableStateOf("") }
      TextField(value = query, onValueChange = { query = it })
  }

  // After — stateless, state hoisted to caller
  @Composable
  fun SearchBar(query: String, onQueryChange: (String) -> Unit) {
      TextField(value = query, onValueChange = onQueryChange)
  }
  ```

- **Expose both stateful and stateless versions** when a component is reused widely. The stateful wrapper provides convenience; the stateless version enables full control.

  ```kotlin
  // Stateless (primary API)
  @Composable
  fun Counter(count: Int, onIncrement: () -> Unit) { /* ... */ }

  // Stateful convenience wrapper
  @Composable
  fun Counter() {
      var count by rememberSaveable { mutableStateOf(0) }
      Counter(count = count, onIncrement = { count++ })
  }
  ```

- **Use `rememberSaveable`** for state that must survive configuration changes (process death). Use plain `remember` only for transient UI state.

## Recomposition

- **State reads determine recomposition scope.** Only composable functions that read a changed `State` object recompose. Move state reads as close to where they are used as possible.

  ```kotlin
  // Before — entire composable recomposes when padding changes
  @Composable
  fun MyScreen() {
      var padding by remember { mutableStateOf(8.dp) }
      Column(modifier = Modifier.padding(padding)) {
          ExpensiveChild() // recomposes unnecessarily
      }
  }

  // After — isolate the state read
  @Composable
  fun MyScreen() {
      var padding by remember { mutableStateOf(8.dp) }
      PaddedColumn(paddingProvider = { padding }) {
          ExpensiveChild()
      }
  }
  ```

- **Use `derivedStateOf`** to transform rapidly-changing state into a value that changes less often, limiting downstream recompositions.

  ```kotlin
  val listState = rememberLazyListState()
  val showButton by remember {
      derivedStateOf { listState.firstVisibleItemIndex > 0 }
  }
  AnimatedVisibility(visible = showButton) {
      ScrollToTopButton()
  }
  ```

- **Never allocate objects inside a composable body** that are passed as parameters to child composables (lambdas, data classes, lists). Wrap with `remember` or hoist.

## Side Effects

- **`LaunchedEffect(key)`** — run a suspend function tied to composition lifecycle. Cancels and re-launches when `key` changes.

  ```kotlin
  LaunchedEffect(userId) {
      val profile = repository.getProfile(userId)
      // update state
  }
  ```

- **`DisposableEffect(key)`** — register/unregister observers or resources. Must include `onDispose`.

  ```kotlin
  DisposableEffect(lifecycleOwner) {
      val observer = LifecycleEventObserver { _, event -> /* ... */ }
      lifecycleOwner.lifecycle.addObserver(observer)
      onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
  }
  ```

- **`rememberUpdatedState(value)`** — capture the latest value of a parameter inside a long-lived effect without restarting the effect.

  ```kotlin
  @Composable
  fun Timer(onTick: () -> Unit) {
      val currentOnTick by rememberUpdatedState(onTick)
      LaunchedEffect(Unit) {
          while (true) {
              delay(1000)
              currentOnTick()
          }
      }
  }
  ```

- **`rememberCoroutineScope()`** — launch coroutines from event callbacks (e.g., button clicks) outside of composition.

  ```kotlin
  val scope = rememberCoroutineScope()
  Button(onClick = { scope.launch { scrollState.animateScrollTo(0) } }) {
      Text("Scroll to top")
  }
  ```

- **Never call suspend functions directly in a composable body.** Use `LaunchedEffect` or `rememberCoroutineScope`.

## Stability & `@Stable` / `@Immutable`

- Compose skips recomposition of a composable when all its parameters are stable and unchanged. Ensure model classes used as parameters are **stable**.

- **`data class` with only `val` properties of primitive/String types is automatically stable.**

  ```kotlin
  // Stable — Compose can skip recomposition
  data class Contact(val name: String, val number: String)
  ```

- **`List<T>`, `Set<T>`, `Map<K,V>` are unstable** because they are interfaces that could be mutable. Use `kotlinx.collections.immutable` (`ImmutableList`, `PersistentList`).

  ```kotlin
  // Before — unstable, prevents skipping
  @Composable
  fun SnackList(snacks: List<Snack>) { /* ... */ }

  // After — stable, enables skipping
  @Composable
  fun SnackList(snacks: ImmutableList<Snack>) { /* ... */ }
  ```

- **Use `@Stable`** on interfaces or classes that follow the stability contract (equals is consistent, public properties notify Compose of changes via `MutableState`).

  ```kotlin
  @Stable
  interface UiState<T> {
      val value: T?
      val isLoading: Boolean
  }
  ```

- **Use `@Immutable`** on types whose public properties never change after construction.

- **Stability configuration file** — use when you can't annotate classes (e.g., third-party types):

  ```text
  // stability_config.conf
  java.time.LocalDateTime
  com.example.datalayer.*
  ```

  ```kotlin
  // build.gradle.kts
  composeCompiler {
      stabilityConfigurationFile = rootProject.layout.projectDirectory.file("stability_config.conf")
  }
  ```

## Compose Compiler Reports

- Enable compiler reports to diagnose stability issues:

  ```kotlin
  composeCompiler {
      reportsDestination = layout.buildDirectory.dir("compose_compiler")
      metricsDestination = layout.buildDirectory.dir("compose_compiler")
  }
  ```

- Look for `unstable` parameters in the report output — these prevent skipping.

## Strong Skipping Mode

- Enabled by default in Kotlin 2.0.20+. For earlier versions:

  ```kotlin
  composeCompiler { enableStrongSkippingMode = true }
  ```

- With strong skipping, composables with **unstable** parameters can still be skipped if the runtime detects instance equality (`===`). Lambdas capturing unstable values are auto-memoized with `remember`.

- Use `@NonSkippableComposable` to opt out a specific composable from skipping.

- Use `@DontMemoize` on a lambda to prevent automatic memoization.

## Lists & Lazy Layouts

- **Always provide stable keys to `items()`** in `LazyColumn` / `LazyRow`:

  ```kotlin
  LazyColumn {
      items(items = notes, key = { it.id }) { note ->
          NoteRow(note)
      }
  }
  ```

- **Cache expensive computations with `remember`**, especially sorting/filtering in lazy layouts:

  ```kotlin
  val sorted = remember(contacts, comparator) {
      contacts.sortedWith(comparator)
  }
  LazyColumn {
      items(sorted) { /* ... */ }
  }
  ```

- Use `contentType` in `items()` to help Compose reuse composition slots for different item types.

## Lambda Best Practices

- **Use lambda-based modifiers** for frequently-changing state to defer reads to layout/draw phase:

  ```kotlin
  // Before — recomposes on every scroll
  Modifier.offset(x = 0.dp, y = scrollOffset.dp)

  // After — only layout phase re-runs
  Modifier.offset { IntOffset(x = 0, y = scrollOffset) }
  ```

- **Use `Modifier.drawBehind`** for animated colors/backgrounds to confine state reads to draw phase:

  ```kotlin
  val color by animateColorBetween(Color.Cyan, Color.Magenta)
  Box(Modifier.fillMaxSize().drawBehind { drawRect(color) })
  ```
