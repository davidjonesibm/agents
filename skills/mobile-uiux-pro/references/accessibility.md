# WCAG 2.2 Mobile Accessibility

Target: WCAG 2.2 (W3C Recommendation, October 2023). References cite specific Success Criteria (SC) numbers.

## Touch Target Size

### SC 2.5.5 Target Size (Enhanced) — Level AAA

- Targets for pointer inputs must be at least **44×44 CSS pixels**.
- Exceptions: equivalent control exists at ≥44px; target is inline text; size is user-agent controlled; presentation is essential.
- Maps to iOS minimum of **44×44pt** and Android minimum of **48×48dp**.

### SC 2.5.8 Target Size (Minimum) — Level AA (New in WCAG 2.2)

- Targets must be at least **24×24 CSS pixels**.
- If a target is smaller than 24×24, it must have sufficient **spacing** so that its 24px-diameter bounding circle does not overlap any adjacent target's bounding circle.
- Menu items must maintain minimum height including text and padding (24px minimum; 18px fails even if expanded).

  ```swift
  // Before: Undersized touch target
  Button(action: zoom) {
      Image(systemName: "plus.magnifyingglass")
          .frame(width: 20, height: 20)
  }

  // After: Meets 44×44pt minimum (iOS AAA target)
  Button(action: zoom) {
      Image(systemName: "plus.magnifyingglass")
          .frame(width: 44, height: 44)
  }
  ```

  ```kotlin
  // Before: Undersized touch target (Android)
  IconButton(onClick = onZoom, modifier = Modifier.size(24.dp)) {
      Icon(Icons.Default.ZoomIn, contentDescription = "Zoom in")
  }

  // After: Meets 48×48dp minimum (Android)
  IconButton(onClick = onZoom, modifier = Modifier.size(48.dp)) {
      Icon(Icons.Default.ZoomIn, contentDescription = "Zoom in")
  }
  ```

### Practical Minimums by Platform

| Platform   | Minimum (AA)           | Recommended (AAA) | Unit   |
| ---------- | ---------------------- | ----------------- | ------ |
| iOS/iPadOS | 44×44                  | 44×44             | pt     |
| Android    | 48×48                  | 48×48             | dp     |
| WCAG 2.2   | 24×24                  | 44×44             | CSS px |
| visionOS   | Follow system defaults | —                 | pt     |

## Color Contrast

### SC 1.4.3 Contrast (Minimum) — Level AA

- **Normal text**: minimum contrast ratio of **4.5:1** against background.
- **Large text** (≥18pt or ≥14pt bold): minimum contrast ratio of **3:1**.
- Applies to text and images of text.

### SC 1.4.6 Contrast (Enhanced) — Level AAA

- **Normal text**: minimum **7:1** contrast ratio.
- **Large text**: minimum **4.5:1** contrast ratio.

### SC 1.4.11 Non-text Contrast — Level AA

- UI components and graphical objects: minimum **3:1** contrast ratio against adjacent colors.
- Applies to: control boundaries, state indicators (focus, selection), meaningful icons/graphics.
- Exceptions: inactive components, user-agent-determined appearance, essential presentation.
- The 3:1 threshold is strict — 2.999:1 does **not** meet the requirement.
- A control with visible text/icon but no visible boundary passes if the text/icon itself meets 1.4.3.
- Hover effects must not cause components to **lose** sufficient contrast.

  ```xml
  <!-- Before: Low-contrast icon on Android -->
  <ImageView
      android:tint="#CCCCCC"
      android:background="#FFFFFF" />
  <!-- Contrast ratio: 1.6:1 — FAILS SC 1.4.11 -->

  <!-- After: Sufficient contrast -->
  <ImageView
      android:tint="#767676"
      android:background="#FFFFFF" />
  <!-- Contrast ratio: 4.5:1 — passes -->
  ```

## Focus Management

### SC 2.4.7 Focus Visible — Level AA

- Focus indicator must be visible for all keyboard-navigable elements.
- Focus indicator area: at least 1 CSS px border around the component, or 4 CSS px on shortest side.

### SC 2.4.11 Focus Not Obscured (Minimum) — Level AA (New in WCAG 2.2)

- When a component receives focus, it must not be entirely hidden by author-created content.

### SC 2.4.12 Focus Not Obscured (Enhanced) — Level AAA (New in WCAG 2.2)

- No part of the focused component should be hidden by author-created content.

### SC 2.4.13 Focus Appearance — Level AAA (New in WCAG 2.2)

- Focus indicator must have a **change-of-contrast ratio of 3:1** between focused and unfocused states (measuring same pixels in different states).
- This is distinct from non-text contrast which measures adjacent pixels in a single state.
- Two-color focus indicators (C40 technique) with **9:1 contrast** between the two colors and **≥2 CSS px** thickness ensure visibility on any background.

## Pointer and Gesture Accessibility

### SC 2.5.1 Pointer Gestures — Level A

- Any functionality using **multipoint or path-based gestures** must also be operable with a **single pointer without path-based gesture** (e.g., a single tap or click).
- Path-based gestures require traversal of intermediate points (e.g., swipe direction matters).
- Exception: the multipoint/path-based gesture is essential.

  ```swift
  // Before: Pinch-to-zoom only
  .gesture(MagnificationGesture().onChanged { scale in ... })

  // After: Pinch + single-pointer alternative
  .gesture(MagnificationGesture().onChanged { scale in ... })
  // Plus accessible zoom controls:
  HStack {
      Button("-") { zoomOut() }
      Button("+") { zoomIn() }
  }
  .accessibilityLabel("Zoom controls")
  ```

### SC 2.5.7 Dragging Movements — Level AA (New in WCAG 2.2)

- Any drag operation must have a **single-pointer alternative** that does not require dragging.
- Dragging = pointer engages target, follows pointer movement, disengages. Only start/end point matter (not path).
- Example alternatives: tap source then tap destination; use arrow buttons; provide a menu/dialog to set value.

  ```kotlin
  // Before: Drag-only reorder
  LazyColumn {
      items(list) { item ->
          DraggableItem(item, onDrag = { from, to -> reorder(from, to) })
      }
  }

  // After: Drag + single-pointer alternative (move up/down buttons)
  LazyColumn {
      items(list) { item ->
          DraggableItem(item, onDrag = { from, to -> reorder(from, to) }) {
              IconButton(onClick = { moveUp(item) }) {
                  Icon(Icons.Default.ArrowUpward, "Move up")
              }
              IconButton(onClick = { moveDown(item) }) {
                  Icon(Icons.Default.ArrowDownward, "Move down")
              }
          }
      }
  }
  ```

## Content Adaptability

### SC 1.4.10 Reflow — Level AA

- Content must reflow to a single column at **320 CSS px width** (equivalent to 1280px at 400% zoom) without loss of information.
- No horizontal scrolling for vertically-scrolled content (and vice versa).
- Exception: content that requires two-dimensional layout (data tables, maps, toolbars).

### SC 1.4.12 Text Spacing — Level AA

- Content must remain readable with: line height ≥1.5× font size, paragraph spacing ≥2× font size, letter spacing ≥0.12× font size, word spacing ≥0.16× font size.
- Applies when user overrides these values — content must not be clipped or overlap.

### SC 1.3.4 Orientation — Level AA

- Content must not restrict display to a single orientation (portrait or landscape) unless a specific orientation is **essential**.

## Screen Reader Support

- Every interactive element must have an accessible name (label, content description).
- Images that convey meaning must have alt text. Decorative images should be hidden from accessibility tree.
- Group related elements for logical screen reader navigation (e.g., a card with title + subtitle + action should be a single accessible unit when appropriate).
- State changes must be announced (toggled, expanded, selected).
- **On visionOS**: custom gestures are not automatically accessible when VoiceOver is enabled. Users must enable Direct Gesture mode explicitly.

  ```swift
  // Before: Icon-only button without label
  Button(action: toggleFavorite) {
      Image(systemName: isFavorite ? "heart.fill" : "heart")
  }

  // After: Icon button with accessibility label
  Button(action: toggleFavorite) {
      Image(systemName: isFavorite ? "heart.fill" : "heart")
  }
  .accessibilityLabel(isFavorite ? "Remove from favorites" : "Add to favorites")
  ```

## Motion and Vestibular

### SC 2.3.3 Animation from Interactions — Level AAA

- Motion animation triggered by interaction can be disabled unless the animation is essential.
- Respect platform Reduce Motion settings (iOS `UIAccessibility.isReduceMotionEnabled`, Android `Settings.Global.ANIMATOR_DURATION_SCALE`).

## Color Independence

### SC 1.4.1 Use of Color — Level A

- Color must not be the **sole** visual means of conveying information, indicating an action, or distinguishing elements.
- Always supplement color with text labels, icons, patterns, or shapes.

  ```kotlin
  // Before: Status by color only
  Box(modifier = Modifier
      .size(12.dp)
      .background(if (isOnline) Color.Green else Color.Red))

  // After: Color + label
  Row(verticalAlignment = Alignment.CenterVertically) {
      Box(modifier = Modifier
          .size(12.dp)
          .background(if (isOnline) Color.Green else Color.Red)
          .semantics { contentDescription = if (isOnline) "Online" else "Offline" })
      Text(if (isOnline) "Online" else "Offline",
          modifier = Modifier.padding(start = 4.dp))
  }
  ```
