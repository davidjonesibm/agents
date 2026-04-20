# Material Design 3 in Compose

Target: `androidx.compose.material3` (M3), BOM 2024+.

## Migration from M2

- **Never use `androidx.compose.material` (M2) in new code.** Use `androidx.compose.material3` exclusively.

  ```kotlin
  // Before (M2)
  import androidx.compose.material.Text
  import androidx.compose.material.Button

  // After (M3)
  import androidx.compose.material3.Text
  import androidx.compose.material3.Button
  ```

## Theme Setup

- Use `MaterialTheme` with M3 color schemes. Use `dynamicColorScheme()` on Android 12+ for dynamic color.

  ```kotlin
  @Composable
  fun AppTheme(
      darkTheme: Boolean = isSystemInDarkTheme(),
      dynamicColor: Boolean = true,
      content: @Composable () -> Unit,
  ) {
      val colorScheme = when {
          dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
              val context = LocalContext.current
              if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
          }
          darkTheme -> darkColorScheme()
          else -> lightColorScheme()
      }

      MaterialTheme(
          colorScheme = colorScheme,
          typography = AppTypography,
          content = content,
      )
  }
  ```

- **Define custom color schemes** with `lightColorScheme()` / `darkColorScheme()` when not using dynamic color:

  ```kotlin
  private val LightColors = lightColorScheme(
      primary = Color(0xFF6750A4),
      onPrimary = Color.White,
      primaryContainer = Color(0xFFEADDFF),
      // ... fill all roles
  )
  ```

## Typography

```kotlin
val AppTypography = Typography(
    displayLarge = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 57.sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 28.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 16.sp),
    labelSmall = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Medium, fontSize = 11.sp),
)
```

## Scaffold

- Use M3 `Scaffold` with proper `innerPadding` applied to content:

  ```kotlin
  Scaffold(
      topBar = {
          TopAppBar(
              title = { Text("My App") },
              colors = TopAppBarDefaults.topAppBarColors(
                  containerColor = MaterialTheme.colorScheme.primaryContainer,
                  titleContentColor = MaterialTheme.colorScheme.primary,
              ),
          )
      },
      floatingActionButton = {
          FloatingActionButton(onClick = { /* ... */ }) {
              Icon(Icons.Default.Add, contentDescription = "Add")
          }
      },
  ) { innerPadding ->
      // ALWAYS apply innerPadding to content
      LazyColumn(
          contentPadding = innerPadding,
          modifier = Modifier.fillMaxSize(),
      ) { /* ... */ }
  }
  ```

- **Always apply `innerPadding`** from the `content` lambda. Forgetting this causes content to render behind system bars or the top bar.

## TopAppBar Scroll Behaviors

```kotlin
// Pinned — always visible
val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()

// Enter always — collapses on scroll up, expands on scroll down
val scrollBehavior = TopAppBarDefaults.enterAlwaysScrollBehavior()

// Exit until collapsed — collapses until only title visible
val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()

// Connect to Scaffold
Scaffold(
    modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
    topBar = {
        TopAppBar(title = { Text("Title") }, scrollBehavior = scrollBehavior)
    },
) { /* ... */ }
```

## Bottom Navigation

```kotlin
NavigationBar {
    items.forEachIndexed { index, item ->
        NavigationBarItem(
            icon = { Icon(item.icon, contentDescription = item.label) },
            label = { Text(item.label) },
            selected = selectedIndex == index,
            onClick = { onItemSelected(index) },
        )
    }
}
```

## Navigation Drawer

```kotlin
val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
val scope = rememberCoroutineScope()

ModalNavigationDrawer(
    drawerContent = {
        ModalDrawerSheet {
            NavigationDrawerItem(
                label = { Text("Home") },
                selected = true,
                onClick = { scope.launch { drawerState.close() } },
            )
        }
    },
    drawerState = drawerState,
) {
    Scaffold(/* ... */) { /* ... */ }
}
```

## Common Components

| M2 (deprecated)          | M3 (use this)                                           |
| ------------------------ | ------------------------------------------------------- |
| `BottomNavigation`       | `NavigationBar`                                         |
| `BottomNavigationItem`   | `NavigationBarItem`                                     |
| `TopAppBar` (material)   | `TopAppBar` (material3)                                 |
| `AlertDialog` (material) | `AlertDialog` (material3)                               |
| `TextField` (material)   | `TextField` / `OutlinedTextField` (material3)           |
| `FloatingActionButton`   | `FloatingActionButton` / `ExtendedFloatingActionButton` |
| N/A                      | `NavigationRail` (tablets)                              |

## Adaptive Layout

- Use `NavigationRail` on tablets/foldables instead of `NavigationBar`.
- Use `windowSizeClass` to choose layouts:

  ```kotlin
  val windowSizeClass = currentWindowAdaptiveInfo().windowSizeClass
  when {
      windowSizeClass.windowWidthSizeClass == WindowWidthSizeClass.EXPANDED -> ListDetailLayout()
      else -> SinglePaneLayout()
  }
  ```

## Color Roles

- Always use semantic color roles from `MaterialTheme.colorScheme` — never hardcode colors:

  ```kotlin
  // Before — hardcoded
  Text(text = "Error", color = Color.Red)

  // After — semantic
  Text(text = "Error", color = MaterialTheme.colorScheme.error)
  ```
