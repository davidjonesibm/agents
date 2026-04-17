# Design

## Liquid Glass (iOS 26)

Liquid Glass is iOS 26's defining visual material. Use it for system-consistent, modern UI:

- Use `.buttonStyle(.glass)` for buttons that should adopt the Liquid Glass appearance.
- Apply `glassEffect(_:in:)` to custom views that should render with the glass material.
- Use `ToolbarSpacer` to add visual separation between toolbar items under Liquid Glass.
- Dialogs and confirmation dialogs should be attached to their triggering UI element so the Liquid Glass morphing animation originates from the correct source.
- Use `backgroundExtensionEffect()` to blend content at safe area edges with the Liquid Glass system.
- Use `scrollEdgeEffectStyle(_:for:)` to configure how scroll edges interact with Liquid Glass toolbars and tab bars.
- When adopting Liquid Glass, test carefully with accessibility settings — ensure sufficient contrast is maintained, as glass effects can reduce readability on some backgrounds.

## Creating a uniform design in this app

Prefer to place standard fonts, sizes, colors, stack spacing, padding, rounding, animation timings, and more into a shared enum of constants, so they can be used by all views. This allows the app’s design to feel uniform and consistent, and be adjusted easily.

## Requirements for flexible, accessible design

- Never use `UIScreen.main.bounds` to read available space; prefer alternatives such as `containerRelativeFrame()`, or `visualEffect()` as appropriate, or (if there is no alternative) `GeometryReader`.
- Prefer to avoid fixed frames for views unless content can fit neatly inside; this can cause problems across different device sizes, different Dynamic Type settings, and more. Giving frames some flexibility is usually preferred.
- Apple’s minimum acceptable tap area for interactions on iOS is 44x44. Ensure this is strictly enforced.

## Standard system styling

- Strongly prefer to use `ContentUnavailableView` when data is missing or empty, rather than designing something custom.
- When using `searchable()`, you can show empty results using `ContentUnavailableView.search` and it will include the search term they used automatically – there’s no need to use `ContentUnavailableView.search(text: searchText)` or similar.
- If you need an icon and some text placed horizontally side by side, prefer `Label` over `HStack`.
- Prefer system hierarchical styles (e.g. secondary/tertiary) over manual opacity when possible, so the system can adapt to the correct context automatically.
- When using `Form`, wrap controls such as `Slider` in `LabeledContent` so the title and control are laid out correctly.
- When using `RoundedRectangle`, the default rounding style is `.continuous` – there is no need to specify it explicitly.

## Drawing and graphics

- Use `MeshGradient` for rich, multi-point color gradients. It creates more natural-looking gradients than layering multiple `LinearGradient` or `RadialGradient` views.
- Apply symbol effects like `.wiggle`, `.rotate`, and `.breathe` using the `symbolEffect(_:options:value:)` modifier for SF Symbol animations rather than manual animation code.
- Use `TextRenderer` and `TextAttribute` for custom text rendering effects (e.g. per-character animations, custom underlines) instead of splitting text into individual views.

## Ensuring designs work for everyone

- Use `bold()` instead of `fontWeight(.bold)`, because using `bold()` allows the system to choose the correct weight for the current context.
- Only use `fontWeight()` for weights other than bold when there's an important reason - scattering around `fontWeight(.medium)` or `fontWeight(.semibold)` is counterproductive.
- Avoid hard-coded values for padding and stack spacing unless specifically requested.
- Avoid UIKit colors (`UIColor`) in SwiftUI code; use SwiftUI `Color` or asset catalog colors.
- The font size `.caption2` is extremely small, and is generally best avoided. Even the font size `.caption` is on the small side, and should be used carefully.
