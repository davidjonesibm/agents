# Widget Composition & the Widget Tree

Target: Flutter 3.x / Dart 3.x+

## Core Principles

- **Everything is a widget.** UI is built by composing small, single-purpose widgets into a tree.
- **Composition over inheritance.** Never subclass existing widgets — wrap them instead.
- **Immutable configuration.** Widget constructors describe configuration; the framework decides when to rebuild.

## StatelessWidget vs StatefulWidget

- Use `StatelessWidget` when the widget has no mutable state and only depends on its constructor arguments and inherited widgets.
- Use `StatefulWidget` only when the widget owns mutable state that changes over its lifetime.
- Prefer extracting state into a state management solution (Riverpod/Bloc) and keeping widgets stateless.

  ```dart
  // GOOD: Stateless widget with immutable data
  class UserCard extends StatelessWidget {
    const UserCard({super.key, required this.name});
    final String name;

    @override
    Widget build(BuildContext context) {
      return Card(child: Text(name));
    }
  }

  // BAD: Using StatefulWidget when state could live in a provider
  class UserCard extends StatefulWidget { ... }
  ```

## Const Constructors

- Always add `const` to widget constructors when all fields are final and compile-time constant.
- Always use `const` when instantiating widgets with literal arguments — this allows Flutter to skip rebuilds entirely.

  ```dart
  // GOOD
  const SizedBox(height: 16)
  const Text('Hello')
  const EdgeInsets.all(8.0)

  // BAD — missing const, causes unnecessary rebuilds
  SizedBox(height: 16)
  Text('Hello')
  EdgeInsets.all(8.0)
  ```

## Composition Pattern

- Build custom widgets by composing existing widgets inside `build()`, not by extending them.

  ```dart
  // GOOD: Composition
  class PrimaryButton extends StatelessWidget {
    const PrimaryButton({super.key, required this.label, this.onPressed});
    final String label;
    final VoidCallback? onPressed;

    @override
    Widget build(BuildContext context) {
      return ElevatedButton(
        onPressed: onPressed,
        child: Text(label),
      );
    }
  }

  // BAD: Inheritance
  class PrimaryButton extends ElevatedButton { ... }
  ```

## Constructor Conventions

- Use `super.key` (Dart 3) instead of passing `Key? key` manually.
- Mark all fields `final`.
- Use `required` for non-optional parameters.
- Use named parameters for all constructor arguments (except positional where semantically clear, e.g. `Text('hello')`).

  ```dart
  // GOOD — Dart 3 super parameter
  const MyWidget({super.key, required this.title});

  // BAD — old-style key forwarding
  const MyWidget({Key? key, required this.title}) : super(key: key);
  ```

## Widget Keys

- Provide explicit `Key` values for widgets in lists where items can be reordered, inserted, or removed (e.g., `ListView`, `Column` with dynamic children).
- Use `ValueKey` with a stable identifier, not the index.
- Do not add keys to static, non-reorderable widget trees — unnecessary keys add overhead.

  ```dart
  // GOOD — stable key for list items
  ListView(
    children: items.map((item) => ListTile(
      key: ValueKey(item.id),
      title: Text(item.name),
    )).toList(),
  )

  // BAD — index-based key
  ListView.builder(
    itemBuilder: (context, index) => ListTile(
      key: ValueKey(index), // index is not stable
      title: Text(items[index].name),
    ),
  )
  ```

## Accessing Ancestor State

- Use `BuildContext` methods (`Theme.of(context)`, `MediaQuery.of(context)`) to read inherited data.
- For custom shared state, prefer Riverpod providers over `InheritedWidget` or `findAncestorStateOfType`.

  ```dart
  // GOOD — read theme from context
  final color = Theme.of(context).colorScheme.primary;

  // AVOID — manual ancestor lookup
  final state = context.findAncestorStateOfType<MyState>();
  ```

## Builder Widgets

- Use `Builder` when you need a new `BuildContext` (e.g., to show a `SnackBar` from within a `Scaffold`).
- Use `LayoutBuilder` when layout depends on parent constraints (see `references/responsive.md`).
- Use `ValueListenableBuilder` / `StreamBuilder` / `FutureBuilder` for reactive data — but prefer Riverpod's `ConsumerWidget` where possible.

## Widget Tree Depth

- Keep the `build()` method readable. Extract sub-trees into separate widget classes (not private methods) when they exceed ~40 lines.
- Extracting into widget classes allows Flutter to diff independently — extracting into methods does not.

  ```dart
  // GOOD: Separate widget class — gets its own Element, can be independently rebuilt
  class _Header extends StatelessWidget { ... }

  // BAD: Private method — entire parent rebuilds when anything changes
  Widget _buildHeader() { ... }
  ```
