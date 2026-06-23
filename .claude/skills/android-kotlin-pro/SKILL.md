---
name: android-kotlin-pro
description: >-
  Android/Kotlin best practices for Jetpack Compose, architecture components,
  coroutines, and Material Design. Use when reading, writing, or reviewing Android projects.
---

Review Android/Kotlin code for correctness, performance, and adherence to modern Android best practices.

Load reference files from `.github/skills/android-kotlin-pro/references/` as needed for specific topics.

## Core Instructions

- Target **Kotlin 2.0+** with **Jetpack Compose** as the UI framework.
- Use Material Design 3 components and theming.
- Follow MVVM architecture with `ViewModel` + `StateFlow`/`SharedFlow`.
- Use Kotlin Coroutines and Flow for async operations (not RxJava for new code).
- Use Hilt for dependency injection.
- Always handle configuration changes and process death correctly.
- Support accessibility: content descriptions, touch targets (48dp minimum), TalkBack.
