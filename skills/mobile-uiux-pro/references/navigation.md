# Navigation Architecture

Target: Apple HIG navigation patterns, Material Design 3 navigation components.

## Navigation Philosophy

### iOS (Apple HIG)

- Navigation should be **invisible** — users should always know where they are and how to get back.
- Prefer **flat navigation** (tab bars) for apps with peer content areas.
- Use **hierarchical navigation** (navigation stacks) for drill-down content.
- Support standard **swipe-back gesture** from the leading edge.

### Android (M3)

- Navigation adapts to window size class — the component changes, but the destinations stay consistent.
- Place navigation at the **leading edge** (or bottom for compact).
- Navigation should be ergonomic — reachable without stretching.

## Tab-Based Navigation

### iOS Tab Bars

- Use for 3–5 top-level destinations.
- Tab bar stays at the **bottom** on iPhone, can move to **top** on iPad (coexisting with toolbar).
- **Never disable or hide tabs** — if a section is empty, show a `ContentUnavailableView`.
- Labels: single-word, placed beneath or beside icons.
- Icons: use SF Symbols for automatic scaling/adaptation.
- Tab bar remains visible during sub-navigation to maintain context; only hide in modal views.

  ```swift
  // Before: Conditionally showing tabs
  TabView {
      if viewModel.hasMessages {
          Tab("Messages", systemImage: "message") { MessagesView() }
      }
      Tab("Settings", systemImage: "gear") { SettingsView() }
  }

  // After: All tabs always present
  TabView {
      Tab("Messages", systemImage: "message") {
          if viewModel.hasMessages { MessagesView() }
          else { ContentUnavailableView("No Messages", systemImage: "message") }
      }
      Tab("Settings", systemImage: "gear") { SettingsView() }
  }
  ```

### Android Navigation Bar (Bottom)

- Use for 3–5 primary destinations in compact window sizes.
- Each destination: icon + text label.
- Auto-adapts to orbiter placement in Android XR.
- Replace with Navigation Rail on medium windows, Navigation Drawer on expanded windows.

## Adaptive Navigation (M3)

- Use `NavigationSuiteScaffold` to automatically switch between navigation components:

| Window Size | Component         | Placement                 |
| ----------- | ----------------- | ------------------------- |
| Compact     | Navigation Bar    | Bottom                    |
| Medium      | Navigation Rail   | Side (leading)            |
| Expanded    | Navigation Drawer | Side (leading, permanent) |

```kotlin
// Adaptive navigation that swaps automatically
NavigationSuiteScaffold(
    navigationSuiteItems = {
        items.forEach { item ->
            item(
                selected = currentRoute == item.route,
                onClick = { navigate(item.route) },
                icon = { Icon(item.icon, contentDescription = item.label) },
                label = { Text(item.label) }
            )
        }
    }
) {
    NavHost(navController, startDestination) { /* ... */ }
}
```

## Navigation Drawers

### M3 Drawer Types

| Type                        | Use Case                         | Content Wrapper        |
| --------------------------- | -------------------------------- | ---------------------- |
| ModalNavigationDrawer       | Compact/medium, overlays content | ModalDrawerSheet       |
| DismissibleNavigationDrawer | Medium, pushes content           | DismissibleDrawerSheet |
| PermanentNavigationDrawer   | Expanded+, always visible        | PermanentDrawerSheet   |

### iOS Sidebars

- Sidebars float above content, providing a broad, flat view of app hierarchy.
- Best suited for layouts with abundant horizontal and vertical space (iPad, Mac).
- Not appropriate for iPhone-only layouts.

## Hierarchical / Stack Navigation

### iOS NavigationStack

- Push/pop model with automatic back button and swipe-back gesture.
- Large titles help orientation — they shrink to standard size on scroll.
- Keep navigation hierarchy shallow (recommended: ≤3 levels deep for most flows).

### Android NavHost

- Navigation between composable destinations using routes.
- Predictive back gesture: the system shows a preview of the previous destination while the user swipes back.
- Support deep linking for all primary destinations.

## Modal Presentation

### iOS Sheets

- Sheets slide up from the bottom on iPhone, appear as centered overlays on iPad.
- Support swipe-to-dismiss unless the task requires explicit confirmation (e.g., unsaved changes).
- Use for focused, temporary tasks that don't need the full navigation context.
- Alerts: keep titles short and messages brief — avoid scrollable alerts.

### M3 Dialogs and Bottom Sheets

- **Bottom sheets**: use for iOS Action Sheet equivalents, picker content, and secondary controls.
- **Fullscreen dialog**: use for large modal views that need full attention (replaces iOS full-screen sheets).
- **System dialogs**: use for critical confirmations that require user acknowledgment (replaces iOS system alerts).
- **Snackbar**: use for transient feedback that was previously shown in an iOS top bar.

  ```kotlin
  // Before: Using dialog for transient feedback
  AlertDialog(
      onDismissRequest = { },
      title = { Text("Saved") },
      confirmButton = { TextButton(onClick = dismiss) { Text("OK") } }
  )

  // After: Snackbar for transient feedback
  snackbarHostState.showSnackbar("Saved successfully")
  ```

## Deep Linking

- All primary destinations should be deep-linkable via URL schemes and Universal Links (iOS) / App Links (Android).
- Deep links must restore the full navigation context — user should be able to navigate back from a deep-linked destination.
- Handle invalid/expired deep links gracefully with fallback to a reasonable default screen.

## State Preservation

- Preserve navigation state across configuration changes (rotation, multitasking transitions, process recreation).
- On iOS, use `@SceneStorage` for lightweight state or navigation path encoding.
- On Android, use `rememberSaveable` and `SavedStateHandle` for ViewModel-level state.
- Users should return to the same screen and scroll position after backgrounding the app.

## Back Navigation

### iOS

- Standard swipe-back from leading edge — never override or disable this.
- Custom back buttons must use `<` chevron and the previous screen's title as label.

### Android

- Support **predictive back** gesture (system-level back with peek animation).
- Handle system back properly in all nested navigation graphs.
- In-app back should navigate within the app's hierarchy before exiting.

  ```kotlin
  // Support predictive back in Compose navigation
  NavHost(
      navController = navController,
      startDestination = "home",
      // System handles predictive back animation automatically
      // with navigation-compose 2.8+
  ) { /* ... */ }
  ```

## Anti-Patterns

- **Never**: Use a hamburger menu as the sole primary navigation on iOS — use tab bars.
- **Never**: Nest more than one modal on top of another modal.
- **Never**: Hide the tab bar and replace it with a custom back button (breaks user mental model).
- **Never**: Open external links in a full-screen push — use `SFSafariViewController` (iOS) or Custom Tabs (Android).
- **Never**: Break swipe-back gestures with horizontal scroll views placed at the leading edge without proper gesture priority.
