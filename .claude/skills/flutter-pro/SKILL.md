---
name: flutter-pro
description: >-
  Flutter/Dart best practices for widgets, state management, navigation, platform channels,
  and testing. Use when reading, writing, or reviewing Flutter projects.
---

Review Flutter/Dart code for correctness, performance, and adherence to best practices.

Load reference files from `.github/skills/flutter-pro/references/` as needed for specific topics.

## Core Instructions

- Target **Flutter 3.x** with Dart null safety.
- Use `StatelessWidget` by default; only use `StatefulWidget` when local mutable state is required.
- Prefer Riverpod or Bloc for state management over `setState` for anything beyond trivial UI state.
- Use `const` constructors wherever possible for widget tree optimization.
- Follow the Flutter style guide for naming and file organization.
- Always handle loading, error, and empty states in async UI.
