# Cross-Platform Design Consistency

Target: Strategies for maintaining quality and consistency when building the same app for iOS and Android (or using cross-platform frameworks like Flutter).

## Philosophy: Adaptive, Not Identical

- **Match platform expectations**: iOS users expect iOS patterns; Android users expect Material Design. A great cross-platform app feels native on each platform, not like a foreign import.
- **Share design intent, not implementation**: same information architecture, same content, same flows — but platform-appropriate chrome, navigation, and interactions.
- The goal is **behavioral consistency** (the user can accomplish the same tasks) not **visual pixel-match** (the screens look identical).

## What to Share

| Shared Across Platforms      | Platform-Specific                                  |
| ---------------------------- | -------------------------------------------------- |
| Information architecture     | Navigation chrome (tab bar vs nav bar/rail/drawer) |
| Content and copy             | Touch feedback (highlight vs ripple)               |
| Color palette / brand tokens | Typography system (SF Pro vs Roboto)               |
| Icon meaning and placement   | Icon style (SF Symbols vs Material Symbols)        |
| Feature set and user flows   | Sheet/dialog presentation style                    |
| Accessibility requirements   | System gesture conventions                         |
| API contracts                | Back navigation pattern                            |

## Design Token Strategy

- Define **shared semantic tokens** at the design system level:
  - `colorPrimary`, `colorOnPrimary`, `colorSurface`, `colorError`
  - `spacingXS` (4), `spacingS` (8), `spacingM` (16), `spacingL` (24), `spacingXL` (32)
  - `radiusS` (8), `radiusM` (12), `radiusL` (16)
- Map shared tokens to platform-native values:
  - `colorPrimary` → `Color.accentColor` (iOS) / `MaterialTheme.colorScheme.primary` (Android)
  - `spacingM` → 16pt (iOS) / 16dp (Android)

## Navigation Mapping

| iOS Pattern                        | Android/M3 Pattern                                                 | Same Concept                 |
| ---------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| Tab bar (bottom, 3–5 tabs)         | Navigation bar (compact), nav rail (medium), nav drawer (expanded) | Primary destinations         |
| NavigationStack (push/pop)         | NavHost (route-based)                                              | Hierarchical navigation      |
| Sheet (.sheet)                     | BottomSheet or FullscreenDialog                                    | Focused secondary task       |
| Alert (.alert)                     | AlertDialog                                                        | Critical user decision       |
| Action sheet (.confirmationDialog) | BottomSheet or Dialog                                              | Multiple-choice actions      |
| Context menu (.contextMenu)        | DropdownMenu or long-press popup                                   | Contextual secondary actions |
| SFSafariViewController             | Custom Tabs                                                        | In-app web content           |

## Component Mapping

| Concept           | iOS (SwiftUI)                                    | Android (M3 Compose)                        |
| ----------------- | ------------------------------------------------ | ------------------------------------------- |
| Primary button    | `.buttonStyle(.borderedProminent)`               | `Button()` (filled)                         |
| Secondary button  | `.buttonStyle(.bordered)`                        | `OutlinedButton()` or `FilledTonalButton()` |
| Text button       | `.buttonStyle(.plain)`                           | `TextButton()`                              |
| Toggle/switch     | `Toggle()`                                       | `Switch()`                                  |
| Text input        | `TextField()`                                    | `OutlinedTextField()` or `TextField()`      |
| List/table        | `List {}`                                        | `LazyColumn {}`                             |
| Floating action   | Not standard in iOS — use toolbar primary action | `FloatingActionButton()`                    |
| Segmented control | `Picker(.segmented)`                             | `SegmentedButton()`                         |
| Pull to refresh   | `.refreshable {}`                                | `PullToRefreshBox()`                        |
| Search            | `.searchable()`                                  | `SearchBar()` or `DockedSearchBar()`        |

## Platform Differences to Respect

### Back Navigation

- **iOS**: swipe from leading edge, automatic back button with previous title.
- **Android**: system back gesture (predictive back with peek), no visible back button in bottom nav.
- **Cross-platform**: never disable platform-standard back navigation. Both platforms have deeply ingrained user expectations.

### Touch Feedback

- **iOS**: highlight/opacity change on press.
- **Android**: ripple effect on every interactive element.
- **Cross-platform**: do not apply ripple on iOS or highlight-style on Android. Use each platform's native feedback.

### Typography

- **iOS**: San Francisco (SF Pro) is the system font. Use HIG text styles.
- **Android**: Roboto is the default. Use M3 type scale tokens.
- **Cross-platform**: you may use a custom brand font on both, but still respect the platform's type scale structure (Dynamic Type on iOS, font scale on Android).

### Icons

- **iOS**: use SF Symbols for native feel. 5,000+ symbols with automatic adaptation.
- **Android**: use Material Symbols with appropriate style (outlined/rounded/sharp).
- **Cross-platform**: if using a single icon set, ensure all icons have accessible labels and meet 3:1 contrast requirement.

### Status Bar & System UI

- **iOS**: light/dark status bar adapts to content. Dynamic Island integration on supported devices.
- **Android**: edge-to-edge with transparent system bars. Status bar and navigation bar color adapt to theme.
- **Cross-platform**: both require handling safe area insets / window insets for content positioning.

## Flutter-Specific Guidance

- Use `Platform.isIOS` / `Platform.isAndroid` for platform-adaptive behavior.
- Flutter's Material widgets look Material on both platforms by default — consider `Cupertino` widgets for iOS-specific screens if native feel is critical.
- Use `adaptive` constructors where available (e.g., `Switch.adaptive()`, `CircularProgressIndicator.adaptive()`).
- Map Flutter navigation to platform conventions: `CupertinoPageRoute` on iOS, `MaterialPageRoute` on Android.

  ```dart
  // Before: Material everywhere
  Switch(value: isOn, onChanged: toggle)

  // After: Adaptive to platform
  Switch.adaptive(value: isOn, onChanged: toggle)
  ```

## Testing Strategy

- Test each platform with its own:
  - **Accessibility scanner**: Xcode Accessibility Inspector (iOS), Accessibility Scanner (Android).
  - **Font scale**: largest Dynamic Type (iOS), max font scale (Android).
  - **Dark mode**: both light and dark on each platform.
  - **Screen sizes**: smallest supported phone, mid-range phone, tablet.
  - **Orientation**: portrait and landscape (WCAG SC 1.3.4).
  - **Screen reader**: VoiceOver (iOS), TalkBack (Android) — complete read-through of all screens.
  - **Keyboard navigation**: Full Keyboard Access (iOS), Tab key traversal (Android with hardware keyboard).
- Foldable testing: ensure layout adapts when device is folded/unfolded (Android) or when switching multitasking modes (iPadOS).

## Anti-Patterns

- **Never**: Use a hamburger drawer as primary navigation on iOS — use a tab bar.
- **Never**: Apply Material ripple effect on iOS or iOS highlight on Android.
- **Never**: Use a FAB on iOS — place primary actions in the navigation bar/toolbar.
- **Never**: Disable swipe-back gesture on iOS or predictive back on Android.
- **Never**: Use platform-specific terminology in shared code comments (e.g., calling everything a "ViewController" or "Activity").
- **Never**: Force a single-platform visual style across both platforms for "brand consistency" — this trades brand alignment for user confusion.
