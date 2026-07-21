# Responsive Layouts

Target: Apple HIG layout guidelines, Material Design 3 layout system (window size classes, canonical layouts).

## Platform Units

| Platform   | Unit                            | Relationship                                                               |
| ---------- | ------------------------------- | -------------------------------------------------------------------------- |
| iOS/iPadOS | Points (pt)                     | 1pt = 1–3 hardware pixels depending on display scale (@1x, @2x, @3x)       |
| Android    | Density-independent pixels (dp) | 1dp = 1px at 160dpi; device has a density bucket (mdpi, hdpi, xhdpi, etc.) |
| Web/WCAG   | CSS pixels (px)                 | Resolution-independent logical unit                                        |

## Safe Areas

### iOS/iPadOS

- Always extend content to fill the screen — backgrounds and artwork reach all edges.
- Respect safe area insets for interactive content (notch, Dynamic Island, home indicator, rounded corners).
- Scrollable content continues to the bottom/sides of the screen, scrolling beneath system UI.
- Navigation components (sidebars, tab bars) conceptually appear **on top of** the content plane.

  ```swift
  // Before: Content clipped by safe area
  VStack { content }
      .padding()

  // After: Background extends to edges, content respects safe area
  ZStack {
      Color.background.ignoresSafeArea()
      VStack { content }
  }
  ```

### Android

- Use `WindowInsets` APIs to handle system bars, keyboard, and display cutouts.
- Edge-to-edge layout: draw behind system bars, pad content inward.

  ```kotlin
  // Enable edge-to-edge
  enableEdgeToEdge()

  Scaffold(
      modifier = Modifier.fillMaxSize(),
      contentWindowInsets = ScaffoldDefaults.contentWindowInsets
  ) { innerPadding ->
      Content(modifier = Modifier.padding(innerPadding))
  }
  ```

## Adaptive Breakpoints

### Material Design 3 Window Size Classes

| Class       | Width       | Typical Devices                    |
| ----------- | ----------- | ---------------------------------- |
| Compact     | <600dp      | Phone portrait                     |
| Medium      | 600–839dp   | Tablet portrait, foldable unfolded |
| Expanded    | 840–1199dp  | Tablet landscape, desktop          |
| Large       | 1200–1599dp | Large desktop                      |
| Extra-large | ≥1600dp     | Ultra-wide displays                |

### iOS/iPadOS Size Classes

| Scenario                 | Horizontal      | Vertical |
| ------------------------ | --------------- | -------- |
| iPhone portrait          | Compact         | Regular  |
| iPhone landscape         | Compact/Regular | Compact  |
| iPad full-screen         | Regular         | Regular  |
| iPad Split View (narrow) | Compact         | Regular  |
| iPad Split View (half+)  | Regular         | Regular  |

## Canonical Layouts (M3)

### Feed Layout

- Compact: single-column, full-width stacked cards.
- Medium+: multi-column grid; increase columns as window width grows.

### List-Detail Layout

- Compact: single-pane with navigation between list and detail.
- Medium+: side-by-side panes. Detail pane hidden until item selected.
- Recommended pane snap widths: 360dp, 412dp.
- Drag handle between panes takes priority over system back gestures.

### Supporting Pane Layout

- Primary content with a secondary pane for contextual information.
- Compact: secondary pane hidden or in a sheet.

## Pane Architecture (M3)

- Layouts contain 1–3 panes that adapt to window size class.
- **Fixed pane**: constant width.
- **Flexible pane**: responsive to available space, can grow and shrink.
- All layouts must have at least one flexible pane to be responsive.
- Panes hold persistent components (top app bar, search bar) and context-specific elements (cards, lists, buttons).
- Content within a pane can use multiple columns for internal layout.

## Margins and Spacing

### iOS/iPadOS

- Use system default margins (`layoutMarginsGuide` in UIKit, default padding in SwiftUI) which adapt to device and size class.
- Apple Design Resources templates provide default margins and recommended text sizes.

### Android/M3

- Margins, body container sizes, and column counts are specified per breakpoint:

| Window Size | Margins | Columns   |
| ----------- | ------- | --------- |
| Compact     | 16dp    | 4         |
| Medium      | 24dp    | 8 (or 12) |
| Expanded    | 24dp    | 12        |

- Spacing between elements follows a 4dp grid (4, 8, 12, 16, 24, 32, 48dp).

## Keyboard Handling

### iOS/iPadOS

- Use the **keyboard layout guide** to keep important UI visible while the keyboard is onscreen.
- Custom controls above the keyboard must be relevant to the current task and visually consistent.
- Support hardware keyboard navigation (Full Keyboard Access) across all interactive elements.

### Android

- Use `WindowInsets.ime` to respond to keyboard appearance.
- Ensure interactive elements (text fields, buttons) remain visible and reachable when keyboard is open.

## Orientation Support

- **WCAG SC 1.3.4 (Level AA)**: Never lock orientation unless essential (e.g., a piano app).
- iOS: support both portrait and landscape unless the app's core function requires a specific orientation.
- iPadOS: must handle orientation changes plus multitasking mode transitions (Split View, Slide Over).
- Android: layouts must adapt to all orientations. Use window size classes rather than testing for specific orientations.

## Foldable Devices

- Use **window size class** rather than device type to determine layout — foldables change size class when folded/unfolded.
- Handle the fold/hinge area: avoid placing interactive elements or important content across the hinge.
- Support seamless transitions between folded (compact) and unfolded (medium/expanded) states.
- M3 adaptive library provides `NavigationSuiteScaffold` that swaps between navigation bar, rail, and drawer based on window size.

  ```kotlin
  // Before: Checking for specific device type
  if (isFoldable && isUnfolded) { TwoPaneLayout() }

  // After: Responding to window size class
  val windowSizeClass = currentWindowAdaptiveInfo().windowSizeClass
  when (windowSizeClass.windowWidthSizeClass) {
      WindowWidthSizeClass.COMPACT -> SinglePaneLayout()
      WindowWidthSizeClass.MEDIUM -> TwoPaneLayout()
      WindowWidthSizeClass.EXPANDED -> TwoPaneLayout(showThirdPane = true)
  }
  ```

## Bidirectional Layout (RTL/LTR)

- M3 uses **leading edge** and **trailing edge** terminology (not left/right) for bidirectional support.
- Place navigation at the leading edge of the window.
- All layouts must mirror properly in RTL locales.
- iOS: use `.leading`/`.trailing` alignment, not `.left`/`.right`.

  ```swift
  // Before: Hardcoded direction
  HStack {
      icon
      Spacer()
      text
  }
  .padding(.leading, 16) // Automatically mirrors in RTL ✓

  // Anti-pattern: Never use fixed left/right
  .padding(.left, 16) // Does NOT mirror in RTL ✗
  ```
