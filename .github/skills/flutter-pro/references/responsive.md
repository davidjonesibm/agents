# Responsive & Adaptive Layouts

Target: Flutter 3.x

## Core Concepts

- **Responsive**: Layout adapts to different screen sizes (phone, tablet, desktop).
- **Adaptive**: UI changes behavior or appearance based on platform conventions (Material on Android, Cupertino on iOS).

## LayoutBuilder

- Use `LayoutBuilder` to make layout decisions based on parent constraints (available width/height).
- This is the primary tool for responsive breakpoints.

  ```dart
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 600) {
          return const SingleColumnLayout();
        } else {
          return const TwoColumnLayout();
        }
      },
    );
  }
  ```

- **Prefer `LayoutBuilder` over `MediaQuery`** for responsive layouts — `LayoutBuilder` respects the actual available space (which may differ from screen size due to nested layouts, split views, etc.).

## Common Breakpoints

| Breakpoint | Device class                      |
| ---------- | --------------------------------- |
| < 600dp    | Phone (compact)                   |
| 600–840dp  | Tablet / foldable (medium)        |
| > 840dp    | Desktop / large tablet (expanded) |

```dart
const double compactBreakpoint = 600;
const double mediumBreakpoint = 840;

LayoutBuilder(
  builder: (context, constraints) {
    if (constraints.maxWidth < compactBreakpoint) {
      return const PhoneLayout();
    } else if (constraints.maxWidth < mediumBreakpoint) {
      return const TabletLayout();
    } else {
      return const DesktopLayout();
    }
  },
)
```

## MediaQuery

- Use `MediaQuery.of(context)` for screen-level information (orientation, text scale, padding, view insets).
- Use specific accessors to avoid unnecessary rebuilds:

  ```dart
  // GOOD — only rebuilds when size changes
  final size = MediaQuery.sizeOf(context);
  final padding = MediaQuery.paddingOf(context);
  final textScaler = MediaQuery.textScalerOf(context);

  // BAD — rebuilds on ANY MediaQuery change
  final mq = MediaQuery.of(context);
  final size = mq.size;
  ```

## OrientationBuilder

- Use `OrientationBuilder` to adapt layout to portrait/landscape.

  ```dart
  OrientationBuilder(
    builder: (context, orientation) {
      return GridView.count(
        crossAxisCount: orientation == Orientation.portrait ? 2 : 3,
        children: items.map((item) => ItemCard(item: item)).toList(),
      );
    },
  )
  ```

## Flexible Layout Widgets

| Widget                    | Use for                             |
| ------------------------- | ----------------------------------- |
| `Flex` / `Row` / `Column` | Linear layouts                      |
| `Expanded`                | Fill remaining space proportionally |
| `Flexible`                | Take space but allow shrinking      |
| `Spacer`                  | Empty expanded space                |
| `Wrap`                    | Flow layout that wraps to next line |
| `FractionallySizedBox`    | Size as fraction of parent          |
| `ConstrainedBox`          | Apply min/max constraints           |
| `AspectRatio`             | Maintain aspect ratio               |

```dart
// GOOD — responsive row that wraps on small screens
Wrap(
  spacing: 8,
  runSpacing: 8,
  children: items.map((i) => Chip(label: Text(i.name))).toList(),
)
```

## SafeArea

- Always wrap top-level page content in `SafeArea` or use `Scaffold` (which handles it internally for `body`, `appBar`, etc.).
- `SafeArea` respects notches, status bars, navigation bars, and display cutouts.

  ```dart
  Scaffold(
    body: SafeArea(
      child: Column( ... ),
    ),
  )
  ```

## Platform-Adaptive Widgets

- Use `defaultTargetPlatform` or `Theme.of(context).platform` to conditionally render platform-specific UI.
- Consider the `flutter_platform_widgets` package for automatic Material/Cupertino switching.

  ```dart
  Widget build(BuildContext context) {
    final isCupertino = Theme.of(context).platform == TargetPlatform.iOS;
    return isCupertino
        ? const CupertinoButton(child: Text('Tap'), onPressed: _onTap)
        : ElevatedButton(onPressed: _onTap, child: const Text('Tap'));
  }
  ```

## Anti-Patterns

- Hardcoded widths/heights that don't adapt to screen size.
- Using `MediaQuery.of(context)` (full) when only `MediaQuery.sizeOf(context)` is needed — causes excessive rebuilds.
- Not handling landscape orientation on tablets.
- Ignoring `SafeArea` — content hidden behind notch or system bars.
- Using `SingleChildScrollView` with a `Column` of fixed-height children when `ListView` would be more appropriate.
