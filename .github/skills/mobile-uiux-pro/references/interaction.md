# Interaction Design: Gestures, Touch Feedback, and Input

Target: Apple HIG gesture conventions, Material Design 3 interaction patterns, WCAG 2.2 pointer input requirements.

## Standard Gestures

### Universal (Platform-Expected)

| Gesture            | Action                                 | Notes                                                              |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------ |
| Tap                | Activate control, select item          | Primary interaction on both platforms                              |
| Long press         | Context menu, secondary actions        | iOS: context menu. Android: tooltip (short), context menu (long)   |
| Swipe (horizontal) | Navigate back, reveal actions, dismiss | iOS: back nav from leading edge. Android: predictive back          |
| Swipe (vertical)   | Scroll, pull-to-refresh, dismiss sheet | Both platforms                                                     |
| Pinch              | Zoom in/out                            | Both platforms; must have single-pointer alternative (WCAG 2.5.1)  |
| Drag               | Move objects, reorder                  | Must have non-drag alternative (WCAG 2.5.7)                        |
| Two-finger scroll  | Scroll content                         | Trackpad/iPad; content should also scroll with single-finger touch |

### iOS-Specific Gestures

- **Swipe from leading edge**: navigate back in a navigation stack.
- **Swipe down on sheet**: dismiss the presented sheet.
- **Long press**: show context menu (UIContextMenuInteraction / `.contextMenu` modifier).
- **Scroll with rubber-band**: elastic overscroll at content boundaries.
- Apple Pencil: supports hover, pressure, tilt — design for these when supporting Pencil input on iPadOS.

### Android-Specific Gestures

- **Predictive back swipe**: system gesture from either edge; shows a preview of the previous screen.
- **Swipe to dismiss (SwipeToDismissBox)**: dismiss notifications, list items.
- **Ripple effect**: visual touch feedback on every interactive element.
- System back gesture area: the outer 24dp of both screen edges are reserved for system back.

## Pull-to-Refresh

- Both platforms support pull-to-refresh but implement it differently.

  ```swift
  // iOS: Built-in refreshable
  List(items) { item in
      ItemRow(item)
  }
  .refreshable {
      await viewModel.reload()
  }
  ```

  ```kotlin
  // Android M3: PullToRefreshBox (Material 3)
  PullToRefreshBox(
      isRefreshing = isRefreshing,
      onRefresh = { viewModel.reload() }
  ) {
      LazyColumn { items(data) { ItemCard(it) } }
  }
  ```

## Swipe Actions on List Items

```swift
// iOS: Leading and trailing swipe actions
List {
    ForEach(items) { item in
        ItemRow(item)
            .swipeActions(edge: .trailing) {
                Button(role: .destructive) { delete(item) } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
            .swipeActions(edge: .leading) {
                Button { pin(item) } label: {
                    Label("Pin", systemImage: "pin")
                }
                .tint(.orange)
            }
    }
}
```

```kotlin
// Android: SwipeToDismissBox
SwipeToDismissBox(
    state = dismissState,
    backgroundContent = {
        Box(Modifier.fillMaxSize().background(Color.Red).padding(16.dp)) {
            Icon(Icons.Default.Delete, "Delete", Modifier.align(Alignment.CenterEnd))
        }
    }
) {
    ItemCard(item)
}
```

## Haptic Feedback

### iOS Haptics

- Use `UIImpactFeedbackGenerator` for physical interactions: `.light`, `.medium`, `.heavy`, `.soft`, `.rigid`.
- Use `UINotificationFeedbackGenerator` for outcomes: `.success`, `.warning`, `.error`.
- Use `UISelectionFeedbackGenerator` for selection changes (e.g., scrolling through a picker).

  ```swift
  // Haptic on destructive action confirmation
  let generator = UINotificationFeedbackGenerator()
  generator.notificationOccurred(.warning)
  ```

### Android Haptics

- Use `HapticFeedbackType.LongPress` for long-press confirmation.
- Use `HapticFeedbackType.TextHandleMove` for text selection.
- Use `View.performHapticFeedback()` for custom interactions.

  ```kotlin
  val haptic = LocalHapticFeedback.current
  Button(onClick = {
      haptic.performHapticFeedback(HapticFeedbackType.LongPress)
      onAction()
  }) { Text("Confirm") }
  ```

## Touch Feedback

### iOS

- System controls provide built-in highlight states.
- Custom buttons: show pressed state (scale down, opacity change, or color shift).
- Buttons within Liquid Glass materials use system-provided active states.

### Android

- **Ripple effect** is mandatory for all interactive elements. The system provides it automatically for standard components.
- Custom `clickable` modifiers should include `indication = rememberRipple()` (or use `Modifier.clickable` which includes it by default).

  ```kotlin
  // Before: No touch feedback on custom clickable
  Box(modifier = Modifier
      .clickable(indication = null, interactionSource = remember { MutableInteractionSource() }) {
          onAction()
      })

  // After: Ripple feedback included
  Box(modifier = Modifier.clickable { onAction() })
  ```

## Loading States

- Use **skeleton screens** or shimmer placeholders instead of blank screens or spinners for content loading.
- Show a **progress indicator** for actions that take >1 second but have a known completion (determinate progress bar).
- Use **indeterminate indicator** for actions with unknown duration.
- **Never** block the entire UI with a full-screen loading overlay for non-destructive operations.
- Provide cancel/retry affordances for network operations.

  ```swift
  // Before: Full-screen spinner
  if isLoading {
      ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  // After: Skeleton placeholder
  if isLoading {
      ForEach(0..<5) { _ in
          SkeletonRow()
              .redacted(reason: .placeholder)
      }
  } else {
      ForEach(items) { item in ItemRow(item) }
  }
  ```

## Destructive Actions

- Always require **confirmation** before destructive operations (delete, discard, sign out).
- Use **red/destructive** button role to signal danger.
- Add haptic feedback (`.warning`) on iOS.
- Place destructive actions in hard-to-accidentally-tap positions (not at the primary action location).

  ```swift
  // Destructive action with confirmation
  Button("Delete Account", role: .destructive) { showDeleteConfirmation = true }
  .confirmationDialog("Delete your account?", isPresented: $showDeleteConfirmation) {
      Button("Delete", role: .destructive) { deleteAccount() }
      Button("Cancel", role: .cancel) {}
  } message: {
      Text("This action cannot be undone.")
  }
  ```

## Gesture Conflicts

- Horizontal scroll views at the screen's leading edge conflict with iOS swipe-back and Android predictive back gestures.
- M3: the outer **24dp** of both screen edges are reserved for system back. Avoid placing horizontally scrollable content or drag targets in this zone.
- When nesting scrollable views, ensure gesture priority is set correctly — inner scroll should not block outer navigation gestures.
- Drag handles in split-pane layouts take priority over system back gestures (M3 specification).

## Accessibility Requirements for Gestures

- **WCAG 2.5.1**: Multipoint or path-based gestures must have single-pointer alternatives (see `references/accessibility.md`).
- **WCAG 2.5.7**: Dragging must have non-drag alternatives (see `references/accessibility.md`).
- Simple, single-finger gestures should be prioritized for frequent interactions.
- Avoid complex, multi-finger, or multi-hand gestures (Apple HIG Accessibility guidance).

## Input Methods Beyond Touch

### iPadOS

- Support trackpad/mouse hover states and right-click context menus.
- Support Apple Pencil hover (iPadOS 16.1+) for preview states.
- All interactions achievable via keyboard when Full Keyboard Access is enabled.

### Android

- Support mouse/trackpad hover and secondary click.
- Support stylus input with pressure sensitivity where relevant.
- Physical keyboard: Tab/Shift+Tab for focus traversal, Enter/Space for activation.
