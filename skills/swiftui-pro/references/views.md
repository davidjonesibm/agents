# SwiftUI Views

- Strongly prefer to avoid breaking up view bodies using computed properties or methods that return `some View`, even if `@ViewBuilder` is used. Extract them into separate `View` structs instead, placing each into its own file.
- Flag `body` properties that are excessively long; they should be broken into extracted subviews.
- Button actions should be extracted from view bodies into separate methods, to avoid mixing layout and logic.
- Similarly, general business logic should not live inline in `task()`, `onAppear()` or elsewhere in `body`.
- Prefer to place view logic into view models or similar, so it can be tested. For more help with testing, suggest the [Swift Testing Pro agent skill](https://github.com/twostraws/swift-testing-agent-skill).
- Each type (struct, class, enum) should be in its own Swift file. Flag files containing multiple type definitions.
- Unless a full-screen editing experience is required, prefer using `TextField` with `axis: .vertical` to using `TextEditor`, because it allows placeholder text. If a specific minimum height is required for `TextField`, use something like `lineLimit(5...)`.
- When `TextEditor` is used for rich text, it now supports `AttributedString` binding (iOS 26). Use this for inline styling instead of building custom rich text views.
- If a button action can be provided directly as an `action` parameter, do so. For example: `Button("Label", systemImage: "plus", action: myAction)` is preferred over `Button("Label", systemImage: "plus") { action() }`.
- When rendering SwiftUI views to images, strongly prefer `ImageRenderer` over `UIGraphicsImageRenderer`.
- `#Preview` should be used for previews, not the legacy `PreviewProvider` protocol. Use `@Previewable` for inline dynamic state in previews instead of creating wrapper views.
- When using `TabView(selection:)`, use a binding to a property that stores an enum rather than an integer or string. For example, `Tab("Home", systemImage: "house", value: .home)` is better than `Tab("Home", systemImage: "house", value: 0)`.
- Strongly prefer to avoid breaking up view bodies using computed properties or methods that return `some View`, even if `@ViewBuilder` is used. Extract them into separate `View` structs instead, placing each into its own file. (Yes, this is repeated, but it’s so important it needs to be mentioned twice.)

## Custom container views

- When creating custom container views (like custom pickers, custom lists, etc.), prefer the `Group(subviews:)` and `ForEach(subviews:)` initializers over manually iterating children. These provide first-class access to resolved subviews.
- Declare custom container values using `ContainerValueKey` conformance, and set them on child views using the `containerValue(_:_:)` modifier.

## Slider

- `Slider` supports tick marks when initialized with the `step` parameter. Tick marks appear automatically — do not attempt to build custom tick mark overlays.

## Animating views

- Strongly prefer to use the `@Animatable` macro over creating `animatableData` manually – the macro automatically adds conformance to the `Animatable` protocol and creates the correct `animatableData` property. If some properties should not or cannot be animated (e.g. Booleans, integers, etc), mark them `@AnimatableIgnored`.
- Never use `animation(_ animation: Animation?)`; always provide a value to watch, such as `.animation(.bouncy, value: score)`.
- Chaining animations must be done using a `completion` closure passed to `withAnimation()`, rather than trying to execute multiple `withAnimation()` calls using delays.

For example:

```swift
Button("Animate Me") {
    withAnimation {
        scale = 2
    } completion: {
        withAnimation {
            scale = 1
        }
    }
}
```

- Use `PhaseAnimator` when animating through a sequence of discrete states, and `KeyframeAnimator` for time-based multi-property animations. Prefer these over manual `Timer`-based animation logic.
- Use `contentTransition(_:)` (e.g. `.numericText()`, `.interpolate`) for animating text or content changes within a single view, rather than replacing views with transitions.
