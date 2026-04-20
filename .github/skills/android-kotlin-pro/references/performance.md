# Performance

Target: Compose BOM 2024+, AGP 8.x+, Kotlin 2.0+.

## Compose Phases

Compose has three phases: **Composition → Layout → Drawing**. Minimize which phases re-run:

- **Composition** — state reads in `@Composable` body trigger recomposition.
- **Layout** — state reads in `Modifier.layout` or size/offset lambdas run only this phase.
- **Drawing** — state reads in `drawBehind` / `drawWithContent` run only this phase.

**Rule: Defer state reads to the latest possible phase.**

```kotlin
// Before — reads in composition, triggers all 3 phases
@Composable
fun Title(scroll: Int) {
    Column(modifier = Modifier.offset(y = scroll.dp)) { /* ... */ }
}

// After — reads in layout only, skips composition
@Composable
fun Title(scrollProvider: () -> Int) {
    Column(modifier = Modifier.offset { IntOffset(0, scrollProvider()) }) { /* ... */ }
}
```

## Stability & Skipping

- Composables with all **stable** parameters can be **skipped** when inputs haven't changed. See `references/compose.md` for stability details.

- Enable **Compose Compiler reports** to find unstable parameters:

  ```kotlin
  composeCompiler {
      reportsDestination = layout.buildDirectory.dir("compose_compiler")
      metricsDestination = layout.buildDirectory.dir("compose_compiler")
  }
  ```

- Watch for `unstable` in the reports output — fix by using `ImmutableList`, `@Stable`, or the stability config file.

## Strong Skipping Mode

- Enabled by default in Kotlin 2.0.20+. Allows Compose to skip composables even with unstable params by using instance equality (`===`).
- Lambdas capturing unstable values are auto-memoized.
- Opt out per-composable with `@NonSkippableComposable`. Opt out per-lambda with `@DontMemoize`.

## Lazy Layout Optimization

- **Always provide keys** to `items()`:

  ```kotlin
  LazyColumn {
      items(items = notes, key = { it.id }) { note -> NoteRow(note) }
  }
  ```

- **Use `contentType`** for heterogeneous lists to improve slot reuse:

  ```kotlin
  LazyColumn {
      items(feed, key = { it.id }, contentType = { it.type }) { item ->
          when (item) {
              is Header -> HeaderRow(item)
              is Post -> PostRow(item)
          }
      }
  }
  ```

- **Cache expensive computations** with `remember`:

  ```kotlin
  val sorted = remember(contacts, comparator) { contacts.sortedWith(comparator) }
  ```

- **Use `derivedStateOf`** for derived values from frequently-changing state:

  ```kotlin
  val showButton by remember { derivedStateOf { listState.firstVisibleItemIndex > 0 } }
  ```

## Baseline Profiles

Baseline Profiles provide ahead-of-time compilation hints to ART, significantly improving startup time and reducing jank.

- Add the Baseline Profile Gradle plugin:

  ```kotlin
  plugins {
      id("androidx.baselineprofile")
  }

  dependencies {
      baselineProfile(project(":baselineprofile"))
  }
  ```

- Create a `baselineprofile` module with `BaselineProfileGenerator`:

  ```kotlin
  @RunWith(AndroidJUnit4::class)
  class BaselineProfileGenerator {
      @get:Rule
      val rule = BaselineProfileRule()

      @Test
      fun generateProfile() {
          rule.collect(packageName = "com.example.app") {
              startActivityAndWait()
              // Navigate critical user journeys
          }
      }
  }
  ```

- Run with `./gradlew :app:generateBaselineProfile`.

## R8 / ProGuard

- **Always enable R8** for release builds — it removes unused code, optimizes bytecode, and obfuscates:

  ```kotlin
  android {
      buildTypes {
          release {
              isMinifyEnabled = true
              isShrinkResources = true
              proguardFiles(
                  getDefaultProguardFile("proguard-android-optimize.txt"),
                  "proguard-rules.pro",
              )
          }
      }
  }
  ```

- **Enable full R8 mode** (AGP 8+):

  ```kotlin
  android.enableR8.fullMode = true  // in gradle.properties
  ```

- Keep rules for Kotlin serialization, Retrofit, Room, and Hilt as needed.

## Startup Optimization

- **Use `App Startup` library** to initialize libraries lazily and in parallel:

  ```kotlin
  class AnalyticsInitializer : Initializer<Analytics> {
      override fun create(context: Context): Analytics {
          return Analytics.init(context)
      }
      override fun dependencies(): List<Class<out Initializer<*>>> = emptyList()
  }
  ```

- **Avoid heavy work in `Application.onCreate()`** — defer to background or use App Startup.

- **Use `SplashScreen` API** (`androidx.core:core-splashscreen`) — never a custom splash Activity.

- **Trace startup with Macrobenchmark**:

  ```kotlin
  @RunWith(AndroidJUnit4::class)
  class StartupBenchmark {
      @get:Rule
      val rule = MacrobenchmarkRule()

      @Test
      fun startupCompilationFull() {
          rule.measureRepeated(
              packageName = "com.example.app",
              metrics = listOf(StartupTimingMetric()),
              compilationMode = CompilationMode.Full(),
              iterations = 5,
              startupMode = StartupMode.COLD,
          ) {
              startActivityAndWait()
          }
      }
  }
  ```

## Image Loading

- **Use Coil** (`coil-compose`) for image loading in Compose. It handles caching, transformations, and lifecycle.

  ```kotlin
  AsyncImage(
      model = ImageRequest.Builder(LocalContext.current)
          .data(url)
          .crossfade(true)
          .build(),
      contentDescription = "Photo",
      modifier = Modifier.size(120.dp),
  )
  ```

## General Rules

- **Never perform disk/network I/O on the main thread.** Use `withContext(Dispatchers.IO)`.
- **Avoid `Modifier.clipToBounds()` on scrollable lists** — it prevents hardware layer optimization.
- **Use `Modifier.graphicsLayer` for animations** that only affect visual properties (alpha, scale, rotation) — it skips composition and layout.
- **Profile with Android Studio Profiler** and **Layout Inspector** (recomposition counts) before optimizing.
