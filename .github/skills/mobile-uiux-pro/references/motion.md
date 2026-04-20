# Motion and Animation

Target: Apple HIG motion guidelines, Material Design 3 motion system, WCAG 2.2 motion accessibility.

## Core Principles

### iOS (Apple HIG)

- Motion should feel **natural and responsive** — animations track user gestures directly.
- iOS uses **spring-based animations** as the default; they feel physically grounded.
- Transitions should maintain spatial context — elements move in ways that communicate their relationship.

### Android (M3)

- M3 motion is **informative** (helps users understand UI structure), **focused** (draws attention to what matters), and **expressive** (reinforces brand personality).
- M3 Expressive (2024–2025) introduces a new motion theming system for enhanced transitions and animations.
- Motion reflects physical metaphors — elements have mass and respond to forces.

## Platform-Specific Animation Conventions

### iOS

- **Spring animations** are the default for most transitions (interactive, interruptible).
- **Navigation transitions**: horizontal slide (push/pop). Large title shrinks to inline during scroll.
- **Sheet presentation**: slides up from bottom on iPhone, fades in centered on iPad.
- **Sheet dismissal**: swipe-down dismissal with velocity-based completion.
- **Tab switching**: crossfade between tab content.
- **Page control scrubbing**: avoid animated transitions during scrubbing — animate only on tap.
- Widget rendering modes: full-color, accented, vibrant — transitions between modes adapt automatically.

  ```swift
  // Spring animation for interactive feedback
  withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
      isExpanded.toggle()
  }
  ```

### Android (M3)

- **Ripple** is the primary touch feedback animation — must appear on every interactive element.
- **Container Transform**: seamless transition between a source and destination container (e.g., list item to detail page). Key M3 transition pattern.
- **Shared Axis**: coordinated transition along x, y, or z axis for related elements navigating in a direction.
- **Fade Through**: sequential fade-out-then-fade-in for elements with no strong spatial relationship.
- **Fade**: simple opacity transition for elements entering/exiting without spatial context.
- **BottomAppBar scroll behavior**: auto-hide on scroll, smooth re-entry.

  ```kotlin
  // Container transform animation between list and detail
  AnimatedContent(
      targetState = selectedItem,
      transitionSpec = {
          fadeIn(tween(300)) togetherWith fadeOut(tween(300))
      }
  ) { item ->
      if (item != null) DetailScreen(item) else ListScreen()
  }
  ```

## Easing and Duration Guidelines

### M3 Easing Tokens

| Token                  | Use Case                     | Curve Type                       |
| ---------------------- | ---------------------------- | -------------------------------- |
| `EmphasizedDecelerate` | Elements entering the screen | Deceleration                     |
| `EmphasizedAccelerate` | Elements leaving the screen  | Acceleration                     |
| `Emphasized`           | Most transitions             | Asymmetric (ease-in-out variant) |
| `Standard`             | Subtle state changes         | Standard ease-in-out             |
| `StandardDecelerate`   | Elements fading in           | Deceleration                     |
| `StandardAccelerate`   | Elements fading out          | Acceleration                     |

### Duration Guidelines

| Category   | Duration  | Examples                                 |
| ---------- | --------- | ---------------------------------------- |
| Micro      | 50–100ms  | Ripple, state overlay                    |
| Short      | 100–200ms | Button press, toggle, small fade         |
| Medium     | 200–400ms | Navigation transition, expand/collapse   |
| Long       | 400–700ms | Complex page transitions, shared element |
| Extra long | 700ms+    | Full-screen transitions (rare)           |

### iOS Timing

- Default spring animations don't have a fixed duration — they respond to physics.
- For explicit duration animations: quick transitions ≈0.2–0.35s; complex transitions ≈0.3–0.5s.
- Match animation duration to gesture velocity for interactive transitions.

## Motion Hierarchy

- **Page-level transitions**: full cross-fade, slide, or container transform.
- **Component-level**: expand/collapse, reveal, state change.
- **Micro-interactions**: touch feedback, toggle, checkbox, loading indicator.
- Avoid animating multiple unrelated elements simultaneously — stagger or sequence them.
- M3 whole-page transitions animate the entire page together (not element by element) for speed and cohesion.

## Interactive and Interruptible Animations

- iOS: gesture-driven animations must be **interruptible** — users can reverse direction mid-gesture.
- Android: transitions should support being interrupted by the predictive back gesture.
- Never lock the UI during an animation. User input always takes priority.

  ```swift
  // Before: Non-interruptible animation
  UIView.animate(withDuration: 0.3) {
      view.transform = .identity
  }

  // After: Interruptible spring animation
  UIView.animate(
      withDuration: 0.3,
      delay: 0,
      usingSpringWithDamping: 0.7,
      initialSpringVelocity: 0,
      options: [.allowUserInteraction],
      animations: { view.transform = .identity }
  )
  ```

## Reduced Motion / Accessibility

### WCAG SC 2.3.3 Animation from Interactions — Level AAA

- Motion triggered by user interaction can be disabled unless the animation is essential to the function.
- Essential: a loading spinner (communicates state). Non-essential: a parallax scroll effect.

### Platform Reduce Motion Settings

- **iOS**: `UIAccessibility.isReduceMotionEnabled` / SwiftUI `@Environment(\.accessibilityReduceMotion)`.
- **Android**: `Settings.Global.ANIMATOR_DURATION_SCALE` (0 = animations off).
- When Reduce Motion is enabled:
  - Replace slide/scale transitions with instant cuts or simple crossfades.
  - Disable parallax effects and auto-playing animations.
  - Keep essential state-change indicators (spinners, progress bars).

  ```swift
  // Respecting Reduce Motion
  @Environment(\.accessibilityReduceMotion) var reduceMotion

  withAnimation(reduceMotion ? .none : .spring()) {
      isExpanded.toggle()
  }
  ```

  ```kotlin
  // Respecting Reduce Motion on Android
  val reduceMotion = remember {
      Settings.Global.getFloat(
          context.contentResolver,
          Settings.Global.ANIMATOR_DURATION_SCALE, 1f
      ) == 0f
  }

  AnimatedVisibility(
      visible = isVisible,
      enter = if (reduceMotion) EnterTransition.None else fadeIn(),
      exit = if (reduceMotion) ExitTransition.None else fadeOut()
  )
  ```

### Additional Motion Safety

- **Fast-moving** and **blinking** animations can be distracting or cause adverse effects (seizures, vestibular issues).
- Avoid flashing content that flashes more than 3 times per second (WCAG SC 2.3.1, Level A).
- Auto-playing video/animation should pause after 5 seconds or provide a pause control (WCAG SC 2.2.2).

## Platform-Specific Transition Patterns

### iOS Navigation Transitions

| Action                | Animation                                                |
| --------------------- | -------------------------------------------------------- |
| Push to detail        | Slide from trailing edge, previous view slides partially |
| Pop (back)            | Reverse of push, tracks gesture velocity                 |
| Present sheet         | Slide up from bottom (iPhone) / fade in centered (iPad)  |
| Dismiss sheet         | Slide down, velocity-sensitive                           |
| Tab switch            | Crossfade                                                |
| Modal present/dismiss | Scale + fade (fullScreenCover)                           |

### M3 Navigation Transitions

| Action                | Animation Pattern                             |
| --------------------- | --------------------------------------------- |
| Top-level nav (tabs)  | Fade through                                  |
| Forward navigation    | Container transform or shared axis (forward)  |
| Return navigation     | Container transform or shared axis (backward) |
| Vertical nav (drawer) | Vertical slide                                |
| Horizontal nav (tabs) | Lateral slide                                 |
| Dialog open/close     | Fade + scale                                  |

## Anti-Patterns

- **Never** use animation duration >700ms for routine transitions — users will perceive the UI as sluggish.
- **Never** animate page loads element-by-element unless each element's timing communicates meaningful hierarchy.
- **Never** use bouncy/spring animations for progress indicators or loading states.
- **Never** block touch input during animations.
- **Never** ignore Reduce Motion settings — this is an accessibility failure.
- **Never** use animation as the sole indicator of state change — always pair with a persistent visual change.
