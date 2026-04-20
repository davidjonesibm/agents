# Accessibility

Target: Flutter 3.x

## General Rules

- All interactive elements must be accessible to screen readers (TalkBack on Android, VoiceOver on iOS).
- Test with actual assistive technology, not just the accessibility inspector.
- Enable the Flutter accessibility checklist: minimum tap targets, labels, contrast.

## Semantics Widget

- Use `Semantics` to annotate custom widgets that don't have built-in semantic information.
- Standard Material widgets (`ElevatedButton`, `TextField`, `Checkbox`, etc.) already provide semantics — don't double-wrap.

  ```dart
  // GOOD — custom widget needs explicit semantics
  Semantics(
    button: true,
    label: 'Play video',
    child: GestureDetector(
      onTap: _playVideo,
      child: const Icon(Icons.play_arrow, size: 48),
    ),
  )

  // BAD — redundant Semantics on a Material widget that already has them
  Semantics(
    button: true,
    child: ElevatedButton(
      onPressed: () {},
      child: const Text('Submit'),
    ),
  )
  ```

## Semantic Properties

- `label`: Screen reader announcement text. Required for icon-only buttons and images.
- `hint`: Describes the result of an action (e.g., "Double-tap to play").
- `value`: Current value for sliders, progress indicators.
- `button`, `header`, `link`, `image`: Role indicators.
- `excludeSemantics`: Hides children from the accessibility tree.
- `explicitChildNodes`: Exposes children as separate semantic nodes.

## Semantic Roles (Flutter 3.x+)

- Use `SemanticsRole` for custom widget semantics that map to platform accessibility roles.

  ```dart
  Semantics(
    role: SemanticsRole.list,
    explicitChildNodes: true,
    child: Column(
      children: [
        Semantics(
          role: SemanticsRole.listItem,
          child: const Text('Item 1'),
        ),
        Semantics(
          role: SemanticsRole.listItem,
          child: const Text('Item 2'),
        ),
      ],
    ),
  )
  ```

## Minimum Tap Target Size

- Touch targets must be at least **48x48 dp** on Android and **44x44 dp** on iOS.
- Material widgets handle this automatically. For custom `GestureDetector` widgets, ensure the hit area meets minimums.

  ```dart
  // GOOD — explicit minimum size
  SizedBox(
    width: 48,
    height: 48,
    child: GestureDetector(
      onTap: _onTap,
      child: const Icon(Icons.close, size: 24),
    ),
  )
  ```

## Text Contrast

- Ensure text contrast ratio is at least **4.5:1** for normal text and **3:1** for large text (>= 18sp).
- Use `Theme.of(context).colorScheme` roles which are designed to meet contrast requirements.

## Enabling Semantics on App Startup

- Call `SemanticsBinding.instance.ensureSemantics()` after `runApp()` to automatically enable the accessibility tree without user interaction.
- On web, check `kIsWeb` before calling.

  ```dart
  void main() {
    runApp(const MyApp());
    SemanticsBinding.instance.ensureSemantics();
  }
  ```

## Accessibility Testing

- Use Flutter's Guideline API in widget tests to validate tap target size, label presence, and text contrast.

  ```dart
  testWidgets('meets a11y guidelines', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(const MyApp());

    // Android tap target: 48x48
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));

    // iOS tap target: 44x44
    await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));

    // All tappable nodes have labels
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));

    // Text contrast ratios
    await expectLater(tester, meetsGuideline(textContrastGuideline));

    handle.dispose();
  });
  ```

## Debugging the Semantics Tree

- Use `debugDumpSemanticsTree()` to print the full semantic tree to the console.
- On web, run with `--dart-define=FLUTTER_WEB_DEBUG_SHOW_SEMANTICS=true` to visualize semantic nodes.

  ```bash
  flutter run -d chrome --profile --dart-define=FLUTTER_WEB_DEBUG_SHOW_SEMANTICS=true
  ```

## Common Mistakes

- Missing `label` on icon-only buttons — screen readers announce nothing.
- Using `Opacity(opacity: 0)` to hide elements — they remain in the semantics tree. Use `Visibility` or `ExcludeSemantics`.
- Images without `semanticLabel` — use `Image.asset('...', semanticLabel: '...')`.
- Text that changes dynamically without `liveRegion: true` — screen readers won't announce updates.
