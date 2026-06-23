---
name: swiftui-pro
description: >-
  SwiftUI best practices for views, state management, navigation, data flow,
  and platform integration. Use when reading, writing, or reviewing SwiftUI iOS projects.
---

Review SwiftUI code for correctness, performance, and adherence to Apple platform best practices.

Load reference files from `.github/skills/swiftui-pro/references/` as needed for specific topics.

## Core Instructions

- Target **SwiftUI for iOS 17+** with Swift 5.9+.
- Use `@Observable` macro (iOS 17+) over `ObservableObject` protocol.
- Prefer `@State` for view-local state, `@Environment` for dependency injection.
- Use `NavigationStack` (not deprecated `NavigationView`).
- Follow Human Interface Guidelines for layout, spacing, and interaction patterns.
- Use Swift concurrency (`async/await`, actors) over Combine for new async work.
- Always support Dynamic Type and VoiceOver accessibility.
