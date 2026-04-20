# Hilt — Dependency Injection

Target: Hilt 2.51+, KSP (not KAPT).

## Application Setup

- Annotate the `Application` class with `@HiltAndroidApp`. Injection happens automatically in `super.onCreate()`.

  ```kotlin
  @HiltAndroidApp
  class MyApplication : Application()
  ```

## Activity / Fragment Injection

- Annotate entry points with `@AndroidEntryPoint`:

  ```kotlin
  @AndroidEntryPoint
  class MainActivity : ComponentActivity() {
      @Inject lateinit var analytics: AnalyticsService
  }
  ```

## ViewModel Injection

- Use `@HiltViewModel` + `@Inject constructor`. Never manually create `ViewModelProvider.Factory`.

  ```kotlin
  // Before — manual factory
  class MyViewModelFactory(private val repo: Repo) : ViewModelProvider.Factory { /* ... */ }

  // After — Hilt handles it
  @HiltViewModel
  class MyViewModel @Inject constructor(
      private val savedStateHandle: SavedStateHandle,
      private val repository: MyRepository,
  ) : ViewModel()
  ```

- Retrieve in Compose with `hiltViewModel()`:

  ```kotlin
  @Composable
  fun MyScreen(viewModel: MyViewModel = hiltViewModel()) { /* ... */ }
  ```

## Modules

- Use `@Module` + `@InstallIn` to provide bindings. Prefer `object` for modules with only `@Provides`.

  ```kotlin
  @Module
  @InstallIn(SingletonComponent::class)
  object NetworkModule {
      @Provides
      @Singleton
      fun provideRetrofit(): Retrofit =
          Retrofit.Builder()
              .baseUrl("https://api.example.com/")
              .addConverterFactory(GsonConverterFactory.create())
              .build()

      @Provides
      @Singleton
      fun provideApiService(retrofit: Retrofit): ApiService =
          retrofit.create(ApiService::class.java)
  }
  ```

- Use `abstract class` for `@Binds`:

  ```kotlin
  @Module
  @InstallIn(SingletonComponent::class)
  abstract class RepositoryModule {
      @Binds
      @Singleton
      abstract fun bindTaskRepository(impl: TaskRepositoryImpl): TaskRepository
  }
  ```

## Component Hierarchy & Scopes

| Component                   | Scope                     | Lifecycle                           |
| --------------------------- | ------------------------- | ----------------------------------- |
| `SingletonComponent`        | `@Singleton`              | Application                         |
| `ActivityRetainedComponent` | `@ActivityRetainedScoped` | ViewModel (survives config changes) |
| `ViewModelComponent`        | `@ViewModelScoped`        | ViewModel                           |
| `ActivityComponent`         | `@ActivityScoped`         | Activity                            |
| `FragmentComponent`         | `@FragmentScoped`         | Fragment                            |
| `ServiceComponent`          | `@ServiceScoped`          | Service                             |

- **Default to unscoped bindings.** Only scope when you need a shared instance within that lifecycle.

  ```kotlin
  @Module
  @InstallIn(ViewModelComponent::class)
  object FeatureModule {
      // Unscoped — new instance per injection
      @Provides
      fun provideFormatter(): DateFormatter = DateFormatter()

      // Scoped — shared within the ViewModel
      @Provides
      @ViewModelScoped
      fun provideCache(): FeatureCache = FeatureCache()
  }
  ```

## Qualifiers

- Use `@Qualifier` annotations to distinguish bindings of the same type:

  ```kotlin
  @Qualifier
  @Retention(AnnotationRetention.BINARY)
  annotation class IoDispatcher

  @Qualifier
  @Retention(AnnotationRetention.BINARY)
  annotation class DefaultDispatcher

  @Module
  @InstallIn(SingletonComponent::class)
  object DispatcherModule {
      @Provides
      @IoDispatcher
      fun provideIoDispatcher(): CoroutineDispatcher = Dispatchers.IO

      @Provides
      @DefaultDispatcher
      fun provideDefaultDispatcher(): CoroutineDispatcher = Dispatchers.Default
  }
  ```

## Testing with Hilt

- Use `@HiltAndroidTest` and `HiltAndroidRule` for instrumented tests:

  ```kotlin
  @HiltAndroidTest
  class MainActivityTest {
      @get:Rule
      val hiltRule = HiltAndroidRule(this)

      @Inject lateinit var repository: TaskRepository

      @Before
      fun setup() {
          hiltRule.inject()
      }
  }
  ```

- Use `@UninstallModules` + `@TestInstallIn` to replace production modules with test doubles.

## Common Mistakes

- **Do not inject into non-Hilt-managed classes** (plain Kotlin classes, custom views without `@AndroidEntryPoint`). Use `@EntryPoint` for escape hatches.

- **Do not use `@Provides` and `@Binds` in the same `object` module.** Separate them: `@Binds` in an `abstract class`, `@Provides` in an `object`.

- **Do not scope everything to `@Singleton`.** Over-scoping wastes memory and hides lifecycle bugs.

## Gradle Setup (KSP)

```kotlin
// build.gradle.kts
plugins {
    id("com.google.devtools.ksp")
    id("com.google.dagger.hilt.android")
}

dependencies {
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose) // for hiltViewModel()
}
```
