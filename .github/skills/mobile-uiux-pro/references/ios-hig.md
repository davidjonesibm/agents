# Apple Human Interface Guidelines (iOS / iPadOS / visionOS)

Target: Apple HIG 2024–2025 (includes Liquid Glass, visionOS spatial design).

## Foundations

- Apple HIG organizes design into **Foundations** (accessibility, app icons, branding, color, dark mode, icons, images, inclusion, layout, materials, motion, privacy, SF Symbols, spatial layout, typography, writing) and **Components** (bars, buttons, menus, etc.).
- Always check the **platform considerations** section for each guideline — iOS, iPadOS, macOS, visionOS, and watchOS each have distinct behaviors.

## Materials and Liquid Glass

- **Liquid Glass** is the current visual language for controls and navigation elements. It forms a distinct functional layer that floats above the content layer.
- Tab bars, sidebars, and toolbars use Liquid Glass to establish a clear visual hierarchy between navigational elements and content.
- Content scrolls and peeks through beneath Liquid Glass elements — design for this transparency.

  ```swift
  // Before: Opaque toolbar background
  .toolbarBackground(.visible, for: .navigationBar)

  // After: Let Liquid Glass handle the material
  // The system applies Liquid Glass automatically to standard bars.
  // Do not force opaque backgrounds on system navigation elements.
  ```

## Tab Bars

- **Never disable or hide tab bar buttons**, even if content is unavailable. Show an explanation in the empty section instead.
- Include clear, single-word labels beneath or beside icons.
- Use SF Symbols for tab icons to ensure automatic scaling and Dark Mode adaptation.
- The tab bar should remain visible during navigation to maintain context. Only hide it in temporary, self-contained modal views.
- On iPadOS, toolbars and tab bars can coexist in the same horizontal space at the top of the view.

  ```swift
  // Before: Hiding tab for empty section
  if hasMessages {
      Tab("Messages", systemImage: "message") { MessagesView() }
  }

  // After: Always show the tab, explain empty state
  Tab("Messages", systemImage: "message") {
      if hasMessages {
          MessagesView()
      } else {
          ContentUnavailableView("No Messages", systemImage: "message")
      }
  }
  ```

## Navigation and Toolbars

- On iOS, prioritize only the most essential actions in the main toolbar — move secondary items into a "More" menu.
- Use large titles to help users maintain orientation. Large titles transition to standard size during scrolling.
- On iPadOS, sidebars provide a broad, flat view of an app's information hierarchy. They float above content and support simultaneous access to multiple peer content areas.
- Group toolbar items logically by function. Aim for a maximum of 3 groups to avoid clutter.

  ```swift
  // Before: Cramming too many toolbar items
  .toolbar {
      ToolbarItem(placement: .primaryAction) { editButton }
      ToolbarItem(placement: .primaryAction) { shareButton }
      ToolbarItem(placement: .primaryAction) { archiveButton }
      ToolbarItem(placement: .primaryAction) { deleteButton }
      ToolbarItem(placement: .primaryAction) { settingsButton }
  }

  // After: Primary actions visible, secondary in menu
  .toolbar {
      ToolbarItem(placement: .primaryAction) { editButton }
      ToolbarItem(placement: .primaryAction) { shareButton }
      ToolbarItem(placement: .primaryAction) {
          Menu {
              archiveButton
              deleteButton
              settingsButton
          } label: {
              Label("More", systemImage: "ellipsis.circle")
          }
      }
  }
  ```

## Sheets and Modal Presentation

- Use sheets for focused, temporary tasks that don't require the full navigation context.
- On iPadOS, sheets appear as centered overlays. On iPhone, they slide up from the bottom.
- Support swipe-to-dismiss unless the task requires explicit confirmation.
- Keep alert content minimal — avoid displaying alerts that require scrolling. Titles should be short and messages brief.

## Search

- Search can be integrated into a toolbar (bottom or top) as an alternative to a tab bar placement.
- On iOS, the search entry point can appear in a tab bar, a toolbar, or inline with content. Choose based on app layout.

## Layout and Safe Areas

- **Extend content to fill the screen** — backgrounds and artwork should reach all edges.
- Scrollable layouts should continue to the bottom and sides of the screen.
- Navigation components (sidebars, tab bars) appear _on top of_ the content plane.
- On Mac Catalyst, follow a top-down flow — place primary actions and content near the top of the window. Relocate controls from iPad bottom/side edges to the window toolbar.

## Dynamic Type and Typography

- Use **text styles** (predefined combinations of weight, size, leading) for a consistent typographic hierarchy.
- Text styles scale proportionately when users adjust Dynamic Type or accessibility font sizes.
- Support text enlargement by at least **200%** (140% on watchOS) through Dynamic Type or custom UI.
- Use SF Symbols for meaningful interface icons — they scale automatically with Dynamic Type.
- Minimum readable font size in widgets/compact contexts: **11pt**.

  ```swift
  // Before: Hardcoded font size
  Text("Settings")
      .font(.system(size: 17))

  // After: Dynamic Type text style
  Text("Settings")
      .font(.headline)
  ```

## SF Symbols

- Use SF Symbols for all interface icons. They adapt automatically to Dark Mode, Dynamic Type, and Reduce Motion.
- SF Symbols provide consistent rendering across all Apple platforms including visionOS.
- For custom icons, provide separate assets for light and dark appearances using asset catalogs.

## System Colors

- Use **semantic/dynamic system colors** (e.g., `label`, `secondaryLabel`, `separator`, `systemBackground`). They adapt automatically to light/dark contexts.
- **Never redefine semantic meanings** of dynamic system colors. Using `separator` color for text or `secondaryLabel` color for backgrounds breaks the visual contract.

  ```swift
  // Before: Hardcoded color
  Text("Subtitle")
      .foregroundColor(Color(red: 0.6, green: 0.6, blue: 0.6))

  // After: Semantic system color
  Text("Subtitle")
      .foregroundStyle(.secondary)
  ```

## iPadOS-Specific

- Support diverse input methods: Multi-Touch gestures, physical keyboards/trackpads, and Apple Pencil.
- Seamlessly adapt to appearance changes: device orientation, multitasking modes (Split View, Slide Over), Dark Mode, and Dynamic Type.
- The menu bar is a primary navigation element on iPad — adopt familiar menu structures to leverage macOS knowledge.

## visionOS-Specific

- Support **indirect gestures** that allow interaction while hands rest at the user's sides.
- Direct gestures in visionOS require content to be within comfortable reach — avoid requiring extended arm interaction.
- Custom gestures may not be accessible by default when VoiceOver is enabled. Users must enable Direct Gesture mode to grant apps direct access to hand input.
- **Vibrancy** in visionOS ensures text legibility on translucent materials. Three levels: `.label` (standard), `.secondaryLabel` (descriptive), `.tertiaryLabel` (inactive/low-priority).

## Dark Mode

- Dark Mode is a Foundations-level concern — not optional. Design for both appearances from the start.
- SF Symbols automatically adapt to Dark Mode. For custom icons/images, provide separate assets or ensure visibility in both modes.
- Use asset catalogs to manage light/dark variations.
- See also `references/theming.md` for color system details.

## Accessibility

- Respect **Reduce Motion** — when enabled, reduce automatic and repetitive animations. Fast-moving and blinking animations can cause adverse effects.
- Prioritize **simple gestures** for frequent interactions. Avoid complex, multi-finger, or multi-hand gestures.
- Support **Full Keyboard Access** — all interactive elements must be reachable via keyboard alone on iOS/iPadOS/macOS/visionOS.
- Minimum touch target size: **44×44pt** on iOS/iPadOS.
- See also `references/accessibility.md` for WCAG 2.2 specifics.

## Scroll Views

- Support default scrolling gestures and keyboard shortcuts — users expect system-wide scrolling behavior.
- Custom scroll views must implement elastic (rubber-band) behavior and proper scroll indicators.

## Controls at Bottom of Screen

- On iOS, controls in the middle or bottom of the display are easier to reach.
- Support swipe-to-navigate-back and swipe actions on list rows.
