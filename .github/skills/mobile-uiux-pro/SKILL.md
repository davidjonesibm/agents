---
name: mobile-uiux-pro
description: >-
  Comprehensively reviews mobile UI/UX for best practices on Apple HIG, Material Design 3,
  WCAG 2.2 accessibility, responsive layouts, gestures, navigation architecture, dark mode,
  and platform-specific interaction patterns. Use when designing, reviewing, or implementing
  mobile user interfaces for iOS, Android, or cross-platform apps.
---

Review mobile UI/UX design and implementation for correctness, platform compliance, accessibility, and adherence to established design system guidelines. Report only genuine problems — do not nitpick or invent issues.

Review process:

1. Check iOS/iPadOS/visionOS design compliance using `references/ios-hig.md`.
2. Check Android/Material Design 3 compliance using `references/material-design.md`.
3. Validate WCAG 2.2 accessibility compliance using `references/accessibility.md`.
4. Ensure responsive layout correctness using `references/layout.md`.
5. Check navigation architecture using `references/navigation.md`.
6. Validate gesture and interaction patterns using `references/interaction.md`.
7. Check theming, dark mode, and typography using `references/theming.md`.
8. Validate motion and animation using `references/motion.md`.
9. Validate cross-platform consistency using `references/cross-platform.md`.

If doing a partial review, load only the relevant reference files. For single-platform apps, skip the irrelevant platform file and `references/cross-platform.md`.

## Core Instructions

- **Platform-respectful**: iOS users expect iOS patterns; Android users expect Material Design. Never blindly copy one platform's conventions to the other.
- **Inclusive by default**: Accessibility is a core design requirement, not an afterthought. Every recommendation must include accessibility considerations.
- **Evidence-based**: Ground recommendations in official guidelines (Apple HIG, Material Design 3, WCAG 2.2), not personal preference or outdated conventions.
- **Implementation-aware**: Provide guidance that maps to framework capabilities (SwiftUI modifiers, Jetpack Compose modifiers, Flutter widgets). Reference specific APIs when possible.
- **Specific values**: Use exact measurements (dp/pt, font sizes, contrast ratios, touch target dimensions) — not vague qualifiers like "large enough" or "sufficient contrast".
- **Version-current**: Target Apple HIG (2024–2025, including Liquid Glass and visionOS), Material Design 3 (M3, including M3 Expressive updates), and WCAG 2.2 (June 2023 W3C Recommendation).

## Output Format

Organize findings by screen or component. For each issue:

1. State the screen/component and relevant element(s).
2. Name the rule being violated (e.g., "WCAG 2.5.8: Touch target below 24×24 CSS px minimum").
3. Cite the source guideline (HIG, M3, or WCAG SC number).
4. Describe the impact (accessibility, usability, platform compliance).
5. Provide a concrete fix with specific values.

Skip screens/components with no issues. End with a prioritized summary grouped by severity:

- **Critical**: Accessibility failures, platform rejection risks
- **Major**: Significant usability or guideline violations
- **Minor**: Polish and best-practice refinements

## References

- `references/ios-hig.md` — Apple HIG: Liquid Glass, tab bars, navigation stacks, SF Symbols, safe areas, sheets, system colors, Dynamic Type, visionOS, iOS/iPadOS conventions.
- `references/material-design.md` — Material Design 3: dynamic color, color roles, navigation bar/rail/drawer, top app bars, FABs, elevation, shape, window size classes, M3 Expressive, Android conventions.
- `references/accessibility.md` — WCAG 2.2 mobile accessibility: contrast ratios (1.4.3, 1.4.6, 1.4.11), touch targets (2.5.5, 2.5.8), pointer gestures (2.5.1), dragging (2.5.7), screen readers, focus management, reflow (1.4.10), text spacing (1.4.12).
- `references/layout.md` — Responsive layouts: phone/tablet/foldable adaptive design, safe areas, margins, spacing grids, keyboard handling, orientation, canonical layouts.
- `references/navigation.md` — Navigation architecture: tab bars, drawers, stacks, bottom navigation, deep linking, modal presentations, state preservation, back navigation.
- `references/interaction.md` — Interaction design: touch feedback, haptics, swipe actions, long press, pull-to-refresh, drag-and-drop, loading states, gesture conflicts, destructive actions.
- `references/theming.md` — Theming and visual design: dark mode implementation, color systems, typography scales, spacing systems, iconography (SF Symbols / Material Symbols), dynamic color.
- `references/motion.md` — Motion and animation: easing curves, duration, transitions, reduced motion, platform animation conventions, container transforms, shared element transitions.
- `references/cross-platform.md` — Cross-platform design: adaptive vs identical UI, platform-appropriate components, shared design tokens, per-platform interaction patterns, testing strategies.
