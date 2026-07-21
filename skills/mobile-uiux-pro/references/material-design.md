# Material Design 3 (Android)

Target: Material Design 3 (M3), including M3 Expressive updates (2024–2025).

## Color System

### Dynamic Color

- Dynamic color generates an accessible color scheme from a single seed color (user wallpaper or in-app content).
- Benefits: personalized UI, accessible contrast, automatic dark theme generation, user-controlled contrast.
- Products can blend brand colors with dynamic colors for a unique experience.
- For products migrating from M2 to M3, start by mapping the baseline color scheme before enabling dynamic color.

### Color Roles

- M3 uses semantic **color roles** instead of raw color values: `primary`, `onPrimary`, `primaryContainer`, `onPrimaryContainer`, `secondary`, `tertiary`, `error`, `surface`, `onSurface`, etc.
- Use "on" color attributes for text/icons within containers (e.g., `colorOnPrimary` for text on a `primary` background) to ensure accessible contrast.
- **Fixed accent colors** keep the same value in both light and dark themes (unlike regular container colors that change tone). Available for primary, secondary, and tertiary groups.
- As of Aug 2024 update: several "on container" color roles in light theme were made more colorful while maintaining accessible contrast.

  ```kotlin
  // Before: Hardcoded color
  Text(
      text = "Label",
      color = Color(0xFF1A1A1A)
  )

  // After: Material color role
  Text(
      text = "Label",
      color = MaterialTheme.colorScheme.onSurface
  )
  ```

### Dark Theme

- Dynamic color automatically generates a dark theme variant.
- Use dark blue-grey surfaces rather than pure black to retain the elevation model across themes.
- Higher-elevation surfaces should appear subtly lighter (closer to implied light source).
- Dark surfaces must be dark enough to display light text while maintaining accessible contrast.
- Cast shadows should still render dark in dark theme.

## Typography

### Type Scale

- M3 uses a **type scale** — a curated selection of type styles for consistency across a product.
- Type roles describe size: `small`, `medium`, `large` — enabling adaptation to device and context.
- **Emphasized type style tokens** (M3 Expressive) create clearer hierarchies within layouts.
- Type scale tokens are configurable design tokens, not hardcoded values.

  ```kotlin
  // Before: Hardcoded text style
  Text(
      text = "Heading",
      fontSize = 24.sp,
      fontWeight = FontWeight.Bold
  )

  // After: Material type scale
  Text(
      text = "Heading",
      style = MaterialTheme.typography.headlineMedium
  )
  ```

## Shape

- M3 shape system uses three size categories: `small`, `medium`, `large`.
- Default corner radius values: small = 8dp, medium = 12dp, large = 16dp (customizable).
- Apply shape consistently — all components at the same structural level should share a shape category.

  ```kotlin
  // Custom shape theme
  MaterialTheme(
      shapes = Shapes(
          small = RoundedCornerShape(8.dp),
          medium = RoundedCornerShape(12.dp),
          large = RoundedCornerShape(16.dp)
      )
  )
  ```

## Layout System

### Window Size Classes

- M3 defines opinionated breakpoints where layouts must change: **Compact** (<600dp), **Medium** (600–839dp), **Expanded** (840dp+), **Large**, **Extra-large**.
- Window size classes account for available space, device conventions, and ergonomics.

### Navigation Region

- Place navigation components close to edges — left side for LTR, right for RTL languages.
- Navigation component selection by window size:
  - **Compact**: Navigation bar (bottom)
  - **Medium**: Navigation rail (side)
  - **Expanded+**: Navigation drawer (permanent or dismissible)

### Panes

- Layouts contain 1–3 panes that adapt to window size class.
- Two pane types: **Fixed** (constant width) and **Flexible** (responsive, grows and shrinks).
- All layouts need at least one flexible pane to be responsive.
- Panes can hold persistent components (top app bar, search bar) and context-specific elements (cards, lists, buttons).

### Canonical Layouts

- **Feed**: Compact → full-width stacked cards; Medium+ → multi-column grid. Increase columns as window size grows.
- **List-detail**: Two-pane layout with a list on one side, detail on the other.
- **Supporting pane**: Primary content with a secondary pane for related info.
- Two-pane layouts can snap to set widths (360dp, 412dp) when resized.
- Drag handles between panes take priority over system back gestures.

  ```kotlin
  // Before: Fixed single-column layout at all sizes
  LazyColumn { items(data) { ItemCard(it) } }

  // After: Adaptive layout using window size class
  val windowSizeClass = currentWindowAdaptiveInfo().windowSizeClass
  if (windowSizeClass.windowWidthSizeClass == WindowWidthSizeClass.COMPACT) {
      LazyColumn { items(data) { ItemCard(it) } }
  } else {
      LazyVerticalGrid(
          columns = GridCells.Adaptive(minSize = 300.dp)
      ) { items(data) { ItemCard(it) } }
  }
  ```

## Components

### Navigation Bar (Bottom)

- Use for 3–5 primary destinations in compact layouts.
- Each destination has an icon and label.
- **NavigationBar** auto-adapts to XR environments (orbiter placement) when using `NavigationSuiteScaffold`.

### Navigation Rail

- Side navigation for medium window sizes or apps with >3 destinations on tablets.
- Supports FAB placement at the top.

### Navigation Drawer

- **ModalNavigationDrawer** with `ModalDrawerSheet`
- **PermanentNavigationDrawer** with `PermanentDrawerSheet`
- **DismissibleNavigationDrawer** with `DismissibleDrawerSheet`

### Top App Bar

- Large centered titles for tablet toolbars.
- Standard titles collapse to smaller size on scroll.

### Bottom App Bar

- `BottomAppBarScrollBehavior` allows auto-hide on scroll (since Compose 1.2).

### Snackbar

- Compact windows (<600dp): expand vertically from 48dp to 64dp for 1–2 lines of text.
- Maintain fixed distance from leading, trailing, and bottom edges.

### Cards

- Use cards to group related content and create containment structure.
- Custom shapes (rounded corners) on cards reinforce brand identity.

### Segmented Button

- Available in single-select and multi-select variants.

### Carousel

- Multi-item preview carousel: best for quick browsing and low-commitment decisions.
- Single-item carousel: best for deep browsing and high-commitment decisions (e.g., choosing a movie).

## Material Symbols

- Three styles: **Outlined** (light, clean, suits dense UI), **Rounded** (pairs with heavier typography, circular elements), **Sharp** (rectangular, maintains legibility at small sizes).
- Icons support adjustable stroke weight to complement typography.
- See also `references/theming.md` for icon theming.

## Elevation

- M3 uses a tonal surface color system instead of shadow-based elevation for most surfaces.
- Higher elevation → lighter tonal surface color in dark theme.
- Shadows are still used for components that need to communicate being above other content (FAB, dialogs, menus).

## iOS-to-Android Migration Notes

- Replace iOS sheet modals with M3 fullscreen dialogs or bottom sheets depending on context.
- iOS Action/Activity sheets → M3 bottom sheets.
- iOS system alerts → M3 system dialogs.
- iOS top bar feedback → M3 Snackbar.
- Ripple effect is key for touch feedback in Android — every interactive element shows ripple.
- M3 motion system: container transform, shared axis, fade through, fade animations.
