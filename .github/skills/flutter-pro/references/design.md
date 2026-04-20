# Theming & Material Design 3

Target: Flutter 3.x / Material 3

## General Rules

- Material 3 is the default in Flutter 3.16+. Do not set `useMaterial3: false` in new projects.
- Define theme via `ColorScheme.fromSeed()` for automatic M3 tonal palette generation.
- Use `ThemeData` color scheme roles (`colorScheme.primary`, `.surface`, `.onPrimary`, etc.) — never hardcode colors.
- Support both light and dark themes.

## Setting Up ThemeData

```dart
MaterialApp(
  theme: ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
  ),
  darkTheme: ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: Colors.deepPurple,
      brightness: Brightness.dark,
    ),
  ),
  themeMode: ThemeMode.system, // Follows system setting
  home: const HomeScreen(),
)
```

## ColorScheme Roles (M3)

- `primary` / `onPrimary` — Primary brand color and text/icon on it.
- `secondary` / `onSecondary` — Accent color.
- `tertiary` / `onTertiary` — Third accent.
- `surface` / `onSurface` — Background surfaces (replaces deprecated `background`).
- `surfaceContainerHighest` — Replaces deprecated `surfaceVariant`.
- `error` / `onError` — Error states.

  ```dart
  // GOOD — using theme roles
  final color = Theme.of(context).colorScheme.primary;
  final bg = Theme.of(context).colorScheme.surface;

  // BAD — deprecated roles
  final bg = Theme.of(context).colorScheme.background; // deprecated
  ```

### Migration from Deprecated Roles

```dart
// Before (deprecated)
colorScheme.copyWith(
  background: myColor1,
  onBackground: myColor2,
  surfaceVariant: myColor3,
)

// After
colorScheme.copyWith(
  surface: myColor1,
  onSurface: myColor2,
  surfaceContainerHighest: myColor3,
)
```

## Accessing Theme Properties

- Use `Theme.of(context)` to access theme data.
- Use `TextTheme.of(context)` (Flutter 3.27+) or `Theme.of(context).textTheme`.
- Use `ColorScheme.of(context)` (Flutter 3.27+) or `Theme.of(context).colorScheme`.

  ```dart
  // GOOD — semantic text styles
  Text(
    'Title',
    style: Theme.of(context).textTheme.headlineMedium,
  )

  // BAD — hardcoded text style
  Text(
    'Title',
    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
  )
  ```

## Component Theming

- Override individual component themes via `ThemeData`:

  ```dart
  ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    ),
    cardTheme: const CardThemeData(
      elevation: 2,
      margin: EdgeInsets.all(8),
    ),
    appBarTheme: const AppBarTheme(
      centerTitle: true,
      elevation: 0,
    ),
  )
  ```

## Dark Mode

- Always define both `theme` and `darkTheme` on `MaterialApp`.
- Use `ThemeMode.system` to respect OS setting, or allow user override.
- Test UI in both light and dark modes.

  ```dart
  // Store user preference
  MaterialApp(
    theme: lightTheme,
    darkTheme: darkTheme,
    themeMode: userPreference, // ThemeMode.light | .dark | .system
  )
  ```

## Typography

- Use `TextTheme` roles: `displayLarge`, `headlineMedium`, `bodyLarge`, `labelSmall`, etc.
- Do not use the deprecated `headline1`–`headline6`, `bodyText1`, `bodyText2` names.
- For custom fonts, apply via `GoogleFonts` or `fontFamily` in `TextTheme`.

  ```dart
  ThemeData(
    textTheme: const TextTheme(
      displayLarge: TextStyle(fontSize: 57, fontWeight: FontWeight.w400),
      headlineMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.w400),
      bodyLarge: TextStyle(fontSize: 16),
      labelSmall: TextStyle(fontSize: 11, letterSpacing: 0.5),
    ),
  )
  ```

## Text Scaling

- Use `MediaQuery.textScalerOf(context)` (not the deprecated `textScaleFactorOf`).

  ```dart
  // GOOD
  RichText(textScaler: MediaQuery.textScalerOf(context), ...)

  // BAD (deprecated)
  RichText(textScaleFactor: MediaQuery.textScaleFactorOf(context), ...)
  ```

## Anti-Patterns

- Hardcoded colors (`Color(0xFF...)`) instead of theme roles.
- Using `accentColor` (deprecated since Flutter 2.x) — use `colorScheme.secondary`.
- Setting `useMaterial3: false` in new projects.
- Not defining `darkTheme` — forces users into light mode only.
- Using pixel-perfect font sizes instead of `TextTheme` roles.
