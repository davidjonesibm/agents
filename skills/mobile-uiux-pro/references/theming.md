# Theming, Dark Mode, Typography, and Visual Design

Target: Apple HIG color/dark mode/typography, Material Design 3 color system/type scale/shape, WCAG 2.2 contrast requirements.

## Dark Mode

### iOS Implementation

- Dark Mode is a **Foundations-level** concern. Design for both appearances from the start.
- Use **semantic/dynamic system colors** — they adapt automatically to light/dark (e.g., `Color.primary`, `.background`, `.secondarySystemBackground`).
- **SF Symbols** adapt to Dark Mode automatically. For custom icons, provide separate assets for each appearance via asset catalogs.
- Full-color images: verify visibility in both modes. Modify designs or provide separate dark/light assets.
- Never redefine dynamic system color semantics (e.g., don't use `separator` for text).
- OLED benefit: Dark Mode reduces power consumption on iPhone OLED displays.

  ```swift
  // Before: Hardcoded colors that break in dark mode
  VStack {
      Text("Title").foregroundColor(.black)
      Text("Body").foregroundColor(Color(white: 0.3))
  }
  .background(Color.white)

  // After: Semantic colors that adapt
  VStack {
      Text("Title").foregroundStyle(.primary)
      Text("Body").foregroundStyle(.secondary)
  }
  .background(Color(.systemBackground))
  ```

### Android/M3 Implementation

- M3 dynamic color **automatically generates** a dark theme from the seed color.
- Use **dark blue-grey surfaces** (not pure black) to retain the shadow-based elevation model.
- Higher-elevation surfaces appear subtly lighter (closer to the implied light source).
- Surface color must be dark enough to display light text with accessible contrast throughout.
- Cast shadows render dark even in dark theme.

  ```kotlin
  // Before: Hardcoded colors
  Surface(color = Color.White) {
      Text("Hello", color = Color.Black)
  }

  // After: Material theme colors
  Surface(color = MaterialTheme.colorScheme.surface) {
      Text("Hello", color = MaterialTheme.colorScheme.onSurface)
  }
  ```

### Cross-Platform Dark Mode Rules

- Test both modes during development — not as an afterthought.
- Never invert colors manually; use the platform's semantic color system.
- Ensure all custom illustrations and images work in both modes.
- Dark mode is not just "white on black" — it requires careful tonal adjustments.

## Color Systems

### iOS System Colors

- **Dynamic system colors** are semantically defined by purpose, not appearance:
  - `label`, `secondaryLabel`, `tertiaryLabel`, `quaternaryLabel`
  - `systemBackground`, `secondarySystemBackground`, `tertiarySystemBackground`
  - `separator`, `opaqueSeparator`
  - `systemRed`, `systemBlue`, etc. (adapt tone in dark mode)
- These colors adjust across iOS, iPadOS, macOS, and visionOS contexts.

### M3 Color Roles

- M3 uses a semantic role-based color system generated from core accent colors:
  - **Primary group**: `primary`, `onPrimary`, `primaryContainer`, `onPrimaryContainer`
  - **Secondary group**: `secondary`, `onSecondary`, `secondaryContainer`, `onSecondaryContainer`
  - **Tertiary group**: same pattern
  - **Error group**: `error`, `onError`, `errorContainer`, `onErrorContainer`
  - **Surface group**: `surface`, `onSurface`, `surfaceVariant`, `onSurfaceVariant`
  - **Outline**: `outline`, `outlineVariant`
- **"On" colors** are used for text/icons drawn on top of the corresponding container.
- **Fixed accent colors** maintain the same value in both light and dark themes (unlike standard container colors).
- Use **Material Theme Builder** to generate a custom color scheme from brand colors.

  ```kotlin
  // Before: Arbitrary color for button text
  Button(colors = ButtonDefaults.buttonColors(
      containerColor = Color(0xFF6200EE),
      contentColor = Color.White
  )) { Text("Submit") }

  // After: Material color roles
  Button(onClick = onSubmit) { Text("Submit") }
  // Uses primary/onPrimary by default
  ```

### Contrast Requirements (see `references/accessibility.md`)

- Normal text: **4.5:1** (AA) or **7:1** (AAA).
- Large text (≥18pt or ≥14pt bold): **3:1** (AA) or **4.5:1** (AAA).
- UI components/icons: **3:1** (AA, SC 1.4.11).

## Typography

### iOS Text Styles

- Predefined styles: `.largeTitle`, `.title`, `.title2`, `.title3`, `.headline`, `.subheadline`, `.body`, `.callout`, `.footnote`, `.caption`, `.caption2`.
- All styles scale with Dynamic Type. Using them ensures automatic accessibility support.
- Minimum readable font size in compact contexts (widgets): **11pt**.
- Support text enlargement by at least **200%** through Dynamic Type.

### M3 Type Scale

- Type scale tokens organized by role and size:
  - **Display**: `displayLarge`, `displayMedium`, `displaySmall`
  - **Headline**: `headlineLarge`, `headlineMedium`, `headlineSmall`
  - **Title**: `titleLarge`, `titleMedium`, `titleSmall`
  - **Body**: `bodyLarge`, `bodyMedium`, `bodySmall`
  - **Label**: `labelLarge`, `labelMedium`, `labelSmall`
- **Emphasized tokens** (M3 Expressive) create clearer hierarchies within layouts.
- Type roles describe size (small/medium/large), enabling device/context adaptation.

  ```kotlin
  // Before: Hardcoded typography
  Text("Heading", fontSize = 24.sp, fontWeight = FontWeight.Bold)
  Text("Body text", fontSize = 16.sp)

  // After: Material type scale
  Text("Heading", style = MaterialTheme.typography.headlineMedium)
  Text("Body text", style = MaterialTheme.typography.bodyLarge)
  ```

### Cross-Platform Typography Rules

- Never hardcode font sizes — always use platform text styles/tokens that support dynamic sizing.
- Test with the largest Dynamic Type / font scale setting to verify layout doesn't break.
- **WCAG SC 1.4.12 Text Spacing**: content must remain readable when users override line height (≥1.5×), paragraph spacing (≥2×), letter spacing (≥0.12×), word spacing (≥0.16×).

## Spacing Systems

### iOS

- Use system default margins which adapt to device and size class.
- Standard spacing increments: 8pt base grid (4, 8, 12, 16, 20, 24, 32pt common values).

### M3

- Standard spacing follows a **4dp grid**: 4, 8, 12, 16, 24, 32, 48dp.
- Component internal padding follows Material specifications per component.
- Margin widths vary by breakpoint (16dp compact, 24dp medium/expanded).

## Iconography

### SF Symbols (iOS)

- 5,000+ symbols, organized by category, weight, and rendering mode.
- Automatically adapt to Dynamic Type, Dark Mode, and Reduce Motion.
- Four rendering modes: monochrome, hierarchical, palette, multicolor.
- Preferred over custom icons for system-like interface elements.

### Material Symbols (Android)

- Three styles: **Outlined** (clean, light — dense UI), **Rounded** (heavier, circular), **Sharp** (rectangular, crisp at small sizes).
- Adjustable stroke weight to complement typography.
- Support variable font axes (weight, fill, grade, optical size).

### Cross-Platform Icon Rules

- Every icon button must have an **accessible label** (VoiceOver/TalkBack text).
- Icons conveying meaning must meet **3:1 contrast** against background (WCAG SC 1.4.11).
- Decorative icons should be hidden from the accessibility tree.
- Icon size within a touch target can be smaller than the target itself — the **tappable area** is what must meet the minimum.

## Elevation and Surface

### iOS

- Liquid Glass materials establish visual hierarchy through translucency and depth.
- visionOS: vibrancy applies to text/symbols/fills on materials — three levels of vibrancy for depth.

### M3

- **Tonal surface color** replaces shadow-based elevation for most surfaces.
- Shadows reserved for components that float above content: FAB, dialogs, menus, sheets.
- Higher tonal elevation = lighter surface color in dark theme.
- Shape (corner radius) is organized into small (8dp), medium (12dp), large (16dp) categories.

## visionOS Materials

- Use **vibrancy** for text on translucent materials:
  - `.label`: standard text
  - `.secondaryLabel`: descriptive text
  - `.tertiaryLabel`: inactive elements
- Materials allow the environment to show through, creating spatial depth.
- Three rendering modes for widgets: full-color, accented, vibrant.
