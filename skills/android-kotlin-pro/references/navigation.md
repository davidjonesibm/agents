# Navigation Compose

Target: Navigation Compose 2.8+ with type-safe routes (KotlinX Serialization), or Navigation 3 (preview).

## Type-Safe Routes (Navigation 2.8+)

- Define routes as `@Serializable` data classes or objects. Never use raw string routes.

  ```kotlin
  // Before — raw strings, no compile-time safety
  composable("profile/{userId}") { backStackEntry ->
      val userId = backStackEntry.arguments?.getString("userId")
  }

  // After — type-safe with KotlinX Serialization
  @Serializable
  data class ProfileRoute(val userId: String)

  @Serializable
  data object HomeRoute

  @Serializable
  data object SettingsRoute
  ```

## NavHost Setup

```kotlin
@Composable
fun AppNavHost(
    navController: NavHostController = rememberNavController(),
    modifier: Modifier = Modifier,
) {
    NavHost(
        navController = navController,
        startDestination = HomeRoute,
        modifier = modifier,
    ) {
        composable<HomeRoute> {
            HomeScreen(onNavigateToProfile = { userId ->
                navController.navigate(ProfileRoute(userId))
            })
        }
        composable<ProfileRoute> { backStackEntry ->
            val route: ProfileRoute = backStackEntry.toRoute()
            ProfileScreen(userId = route.userId)
        }
        composable<SettingsRoute> {
            SettingsScreen()
        }
    }
}
```

## Navigation Patterns

- **Hoist `NavController` to the top-level composable** (usually `MainActivity` or the app-level composable). Never pass `NavController` into child composables — pass callback lambdas instead.

  ```kotlin
  // Before — tight coupling
  @Composable
  fun HomeScreen(navController: NavController) {
      Button(onClick = { navController.navigate(ProfileRoute("123")) }) { /* ... */ }
  }

  // After — decoupled
  @Composable
  fun HomeScreen(onNavigateToProfile: (String) -> Unit) {
      Button(onClick = { onNavigateToProfile("123") }) { /* ... */ }
  }
  ```

- **Use `navController.navigate() { popUpTo() }` for login flows** to clear the back stack:

  ```kotlin
  navController.navigate(HomeRoute) {
      popUpTo(LoginRoute) { inclusive = true }
  }
  ```

- **Use `launchSingleTop = true`** to avoid duplicate destinations on the stack:

  ```kotlin
  navController.navigate(SettingsRoute) { launchSingleTop = true }
  ```

## Nested Navigation Graphs

- Group related screens into nested graphs for modularity:

  ```kotlin
  NavHost(navController = navController, startDestination = "auth") {
      navigation<AuthGraph>(startDestination = LoginRoute) {
          composable<LoginRoute> { /* ... */ }
          composable<RegisterRoute> { /* ... */ }
      }
      composable<HomeRoute> { /* ... */ }
  }

  @Serializable
  data object AuthGraph
  ```

## Deep Links

```kotlin
composable<ProfileRoute>(
    deepLinks = listOf(
        navDeepLink<ProfileRoute>(basePath = "https://example.com/profile")
    )
)
```

## ViewModel Scoping with Navigation

- Use `hiltViewModel()` inside a `composable` — it is automatically scoped to that nav destination's `ViewModelStoreOwner`.

- For shared ViewModels across a nested graph, scope to the nav graph:

  ```kotlin
  composable<StepOneRoute> {
      val sharedViewModel: OnboardingViewModel =
          hiltViewModel(viewModelStoreOwner = it.rememberParentEntry(navController))
  }
  ```

## Navigation 3 (Preview — developer.android.com/guide/navigation/navigation-3)

Navigation 3 is a new Compose-first navigation library (in preview). Key differences:

- **Back stack is a `MutableList` you own**, not hidden inside `NavController`.
- **`NavDisplay`** renders the current back stack entries.
- **`entryProvider`** maps route keys to composable content.
- Supports **multiple back stacks** for bottom navigation natively.

  ```kotlin
  val backStack = rememberMutableStateListOf(HomeRoute)

  NavDisplay(
      backStack = backStack,
      entryProvider = { route ->
          when (route) {
              is HomeRoute -> NavEntry(route) { HomeScreen() }
              is ProfileRoute -> NavEntry(route) { ProfileScreen(route.userId) }
          }
      },
      onBack = { backStack.removeLastOrNull() }
  )
  ```

Only adopt Navigation 3 when it reaches stable. Use Navigation 2.8+ with type-safe routes for production.

## Gradle Setup

```kotlin
plugins {
    kotlin("plugin.serialization") version "2.0.21"
}

dependencies {
    implementation(libs.navigation.compose)         // 2.9+
    implementation(libs.kotlinx.serialization.json)
    androidTestImplementation(libs.navigation.testing)
}
```
