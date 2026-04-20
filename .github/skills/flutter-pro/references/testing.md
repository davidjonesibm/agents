# Testing

Target: Flutter 3.x / flutter_test / integration_test / mockito

## Test Pyramid

| Level           | Package            | Speed | Use for                                        |
| --------------- | ------------------ | ----- | ---------------------------------------------- |
| **Unit**        | `test`             | Fast  | Pure Dart logic, models, utilities             |
| **Widget**      | `flutter_test`     | Fast  | Single widget behavior, rendering, interaction |
| **Golden**      | `flutter_test`     | Fast  | Visual regression (pixel-level comparison)     |
| **Integration** | `integration_test` | Slow  | Full app flows, multi-screen scenarios         |

## Widget Tests

- Use `testWidgets` and `WidgetTester` from `flutter_test`.
- `pumpWidget` renders the widget tree in the test environment.
- `pump()` triggers a single frame rebuild.
- `pumpAndSettle()` waits for all animations to complete.

  ```dart
  import 'package:flutter/material.dart';
  import 'package:flutter_test/flutter_test.dart';

  void main() {
    testWidgets('displays title and message', (tester) async {
      await tester.pumpWidget(const MaterialApp(
        home: MyWidget(title: 'Hello', message: 'World'),
      ));

      expect(find.text('Hello'), findsOneWidget);
      expect(find.text('World'), findsOneWidget);
    });
  }
  ```

### Interaction

```dart
testWidgets('increments counter on tap', (tester) async {
  await tester.pumpWidget(const MaterialApp(home: CounterPage()));

  expect(find.text('0'), findsOneWidget);

  await tester.tap(find.byType(FloatingActionButton));
  await tester.pump();

  expect(find.text('1'), findsOneWidget);
});
```

### Text Entry and Drag

```dart
testWidgets('adds and removes todo', (tester) async {
  await tester.pumpWidget(const MaterialApp(home: TodoList()));

  await tester.enterText(find.byType(TextField), 'Buy milk');
  await tester.tap(find.byType(FloatingActionButton));
  await tester.pump();

  expect(find.text('Buy milk'), findsOneWidget);

  await tester.drag(find.byType(Dismissible), const Offset(500, 0));
  await tester.pumpAndSettle();

  expect(find.text('Buy milk'), findsNothing);
});
```

### Finders

- `find.text('...')` — Find by text content.
- `find.byType(WidgetType)` — Find by widget type.
- `find.byKey(Key('...'))` — Find by key.
- `find.byIcon(Icons.add)` — Find by icon.
- `find.descendant(of: ..., matching: ...)` — Find nested widgets.

### Matchers

- `findsOneWidget` — Exactly one match.
- `findsNothing` — No matches.
- `findsNWidgets(n)` — Exactly N matches.
- `findsAtLeast(n)` — N or more matches.

## Golden Tests

- Golden tests compare rendered widget output against a reference image file.
- Use `matchesGoldenFile()` matcher.
- Generate/update golden files with `--update-goldens` flag.

  ```dart
  testWidgets('renders correctly', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: MyWidget(),
    ));

    await expectLater(
      find.byType(MyWidget),
      matchesGoldenFile('goldens/my_widget.png'),
    );
  });
  ```

  ```bash
  # Generate or update golden files
  flutter test --update-goldens

  # Run golden comparison tests
  flutter test
  ```

- Golden tests are platform-sensitive — pixel differences between macOS/Linux/CI can cause failures. Use a consistent CI environment.

## Integration Tests

- Integration tests run on a real device or emulator.
- Place test files in `integration_test/` directory.
- Use `IntegrationTestWidgetsFlutterBinding.ensureInitialized()`.

  ```dart
  // integration_test/app_test.dart
  import 'package:flutter_test/flutter_test.dart';
  import 'package:integration_test/integration_test.dart';
  import 'package:my_app/main.dart' as app;

  void main() {
    IntegrationTestWidgetsFlutterBinding.ensureInitialized();

    testWidgets('full app flow', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Verify initial state
      expect(find.text('0'), findsOneWidget);

      // Interact
      await tester.tap(find.byKey(const ValueKey('increment')));
      await tester.pumpAndSettle();

      // Verify result
      expect(find.text('1'), findsOneWidget);
    });
  }
  ```

  ```bash
  # Run integration tests
  flutter test integration_test/

  # Run on a specific device
  flutter test integration_test/ -d <device_id>
  ```

## Mocking with Mockito

- Use `mockito` + `build_runner` for generating mock classes.
- Annotate test files with `@GenerateMocks` or `@GenerateNiceMocks`.

  ```dart
  import 'package:mockito/annotations.dart';
  import 'package:mockito/mockito.dart';
  import 'package:flutter_test/flutter_test.dart';

  @GenerateMocks([ApiClient])
  import 'my_test.mocks.dart';

  void main() {
    late MockApiClient mockApi;

    setUp(() {
      mockApi = MockApiClient();
    });

    test('fetches user', () async {
      when(mockApi.getUser(any)).thenAnswer(
        (_) async => User(id: '1', name: 'Alice'),
      );

      final user = await mockApi.getUser('1');

      expect(user.name, 'Alice');
      verify(mockApi.getUser('1')).called(1);
    });
  }
  ```

  ```bash
  # Generate mock classes
  dart run build_runner build
  ```

## Testing Riverpod

- Use `ProviderScope` with `overrides` to inject mocks.

  ```dart
  testWidgets('shows user name', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          userProvider.overrideWith(() => MockUserNotifier()),
        ],
        child: const MaterialApp(home: ProfileScreen()),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Alice'), findsOneWidget);
  });
  ```

## Testing Bloc

- Use `blocTest` from `bloc_test` package for Bloc/Cubit testing.

  ```dart
  import 'package:bloc_test/bloc_test.dart';

  void main() {
    blocTest<CounterCubit, int>(
      'emits [1] when increment is called',
      build: () => CounterCubit(),
      act: (cubit) => cubit.increment(),
      expect: () => [1],
    );
  }
  ```

## Accessibility Tests

- See `references/accessibility.md` for the `meetsGuideline` matchers.

## Best Practices

- Test behavior, not implementation. Assert on visible text and UI state, not internal widget structure.
- Use `ValueKey` on widgets you need to find in tests — don't rely on fragile `find.byType` in complex trees.
- Mock external dependencies (network, platform channels, database) — never make real network calls in tests.
- Run tests in CI with `flutter test --coverage` to track coverage.
