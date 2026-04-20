---
name: android-kotlin-pro
description: >-
  Comprehensively reviews Android Kotlin code for best practices on Jetpack Compose,
  MVVM/MVI architecture, Hilt dependency injection, Coroutines/Flow, Room, DataStore,
  Navigation Compose, Material Design 3, performance, accessibility, testing, and
  Gradle configuration. Use when reading, writing, or reviewing native Android projects
  with Kotlin.
---

Expert-level Android development skill targeting **Kotlin 2.0+**, **Jetpack Compose (BOM 2024+)**, and **AGP 8.x+**.

## Review Process

1. Check Compose patterns and state management using `references/compose.md`.
2. Validate architecture (MVVM/MVI, ViewModel, UiState) using `references/architecture.md`.
3. Review Hilt dependency injection using `references/di.md`.
4. Check Navigation Compose usage using `references/navigation.md`.
5. Review Room and DataStore usage using `references/data.md`.
6. Validate Coroutines and Flow patterns using `references/concurrency.md`.
7. Check Material Design 3 usage using `references/material3.md`.
8. Audit performance practices using `references/performance.md`.
9. Review accessibility compliance using `references/accessibility.md`.
10. Validate testing patterns using `references/testing.md`.
11. Check Gradle/build configuration using `references/gradle.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **Kotlin 2.0+** and **Compose Compiler 2.0+** (merged into Kotlin compiler).
- Target **Material3** (`androidx.compose.material3`) — never use `material` (M2) in new code.
- All new UI must use **Jetpack Compose** — no new XML layouts.
- Use **Kotlin DSL** (`build.gradle.kts`) for all Gradle files.
- Use **version catalogs** (`libs.versions.toml`) for dependency management.
- Use **KSP** instead of KAPT for annotation processing (Room, Hilt).
- Never use `GlobalScope` — always use structured concurrency.
- Never use `LiveData` in new code — use `StateFlow` / `SharedFlow` collected with `collectAsStateWithLifecycle()`.

## Output Format

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule being violated (e.g., "compose/state-hoisting", "performance/stability").
3. Show a brief before/after code fix.

Skip files with no issues. End with a prioritized summary.
