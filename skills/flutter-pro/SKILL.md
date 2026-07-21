---
name: flutter-pro
description: >-
  Comprehensively reviews Flutter and Dart code for best practices on Jetpack Compose,
  widget composition, state management (Riverpod/Bloc), navigation (GoRouter, declarative routing),
  platform channels (Pigeon for type-safe native bridge), performance (RepaintBoundary, const
  constructors, DevTools profiling), accessibility (Semantics widget, screen reader support),
  testing (widget tests, golden tests, integration tests, mockito), theming and Material Design 3,
  responsive/adaptive layouts, and build/deployment (flavors, Fastlane). Use when reading, writing,
  or reviewing Flutter projects.
---

Review Flutter and Dart code for correctness, modern API usage, and adherence to best practices. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check widget architecture and composition using `references/widgets.md`.
2. Validate state management patterns using `references/state.md`.
3. Ensure navigation is correct and declarative using `references/navigation.md`.
4. Validate platform channel usage using `references/platform.md`.
5. Check performance best practices using `references/performance.md`.
6. Validate accessibility compliance using `references/accessibility.md`.
7. Check theming and design patterns using `references/design.md`.
8. Check responsive and adaptive layout patterns using `references/responsive.md`.
9. Validate testing patterns using `references/testing.md`.
10. Validate Dart language usage using `references/dart.md`.
11. Check build configuration and deployment using `references/build.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **Flutter 3.x** (latest stable) with **Dart 3.x** or later.
- Use **sound null safety** throughout — no `// ignore: ...` to suppress null safety warnings.
- Prefer **Riverpod** for state management. **Bloc/Cubit** is acceptable. Avoid raw `ChangeNotifier`/`ValueNotifier` in new code.
- Use **GoRouter** for navigation — avoid imperative `Navigator.push()` except for transient overlays.
- Use **Pigeon** for type-safe platform channels — avoid raw `MethodChannel` string-based APIs.
- Use **`const` constructors** everywhere possible for performance.
- Use **Composition over inheritance** — compose widgets, don't subclass them.
- Leverage Dart 3 features: **sealed classes**, **pattern matching**, **records**, **extension types**.
- Always test with **widget tests** at minimum; add golden and integration tests for critical flows.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated (reference the reference file).
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary.
