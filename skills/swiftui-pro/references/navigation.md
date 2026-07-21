# Navigation and presentation

- Use `NavigationStack` or `NavigationSplitView` as appropriate; flag all use of the deprecated `NavigationView`.
- Strongly prefer to use `navigationDestination(for:)` to specify destinations; flag all use of the old `NavigationLink(destination:)` pattern where it should be replaced.
- Never mix `navigationDestination(for:)` and `NavigationLink(destination:)` in the same navigation hierarchy; it causes significant problems.
- `navigationDestination(for:)` must be registered once per data type; flag duplicates.

## Navigation transitions

- Use `navigationTransition(_:)` to customize push/pop transitions on a `NavigationStack`. The built-in `.zoom` transition creates a zoom effect from a matched source.
- Pair `navigationTransition(.zoom(...))` with `matchedTransitionSource(id:in:)` on the source view to define the origin of the zoom animation.
- Use a `@Namespace` to share the transition identity between source and destination views.

## Tab view customization

- Use `TabSection` to group tabs into hierarchical sections. Tab sections are visible in the sidebar when using `.sidebarAdaptable` tab view style.
- Use `tabViewCustomization(_:)` with `TabViewCustomization` stored in `@AppStorage` to let users reorder and hide tabs. Set `customizationBehavior(_:)` on individual tabs to allow or prevent customization.
- Use `tabBarMinimizeBehavior(_:)` to control whether the tab bar can be minimized (iOS 26).
- Use the `.search` tab role on a `Tab` to create a dedicated search tab that replaces the tab bar with a search field (iOS 26).
- Use `TabViewBottomAccessoryPlacement` to add content below tabs with placement-aware layout (iOS 26).

## Alerts, confirmation dialogs, and sheets

- Always attach `confirmationDialog()` to the user interface that triggers the dialog. This allows Liquid Glass animations to move from the correct source.
- If an alert has only a single “OK” button that does nothing but dismiss the alert, it can be omitted entirely: `.alert("Dismiss Me", isPresented: $isShowingAlert) { }`.
- If a sheet is designed to present an optional piece of data, prefer `sheet(item:)` over `sheet(isPresented:)` so the optional is safely unwrapped.
- When using `sheet(item:)` with a view that accepts the item as its only initializer parameter, prefer `sheet(item: $someItem, content: SomeView.init)` over `sheet(item: $someItem) { someItem in SomeView(item: someItem) }`.
- When sizing sheets, use `presentationSizing(_:)` with built-in sizes like `.form` or `.page` rather than hard-coded frame sizes. Custom sizes can also be created by conforming to `PresentationSizing`.
- Use `presentationDetents(_:)` to define the resting heights of a resizable sheet (e.g. `.medium`, `.large`, or a custom fraction/height).
- Use `dismissalConfirmationDialog(_:shouldPresent:actions:)` to show a confirmation before allowing a sheet to be dismissed, replacing manual `interactiveDismissDisabled` + state juggling.
