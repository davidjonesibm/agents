# State Management (Riverpod & Bloc)

Target: Riverpod 2.x / flutter_riverpod 2.x / riverpod_annotation / bloc 8.x / flutter_bloc 8.x

## General Rules

- Pick **one** state management approach per app (Riverpod or Bloc). Do not mix them.
- Never use raw `ChangeNotifier` or `ValueNotifier` + `Provider` package in new code — migrate to Riverpod `Notifier` or Bloc.
- Keep business logic out of widgets. Widgets read state and dispatch actions; they do not compute derived data.

---

## Riverpod

### Provider Types

| Provider                | Use for                                |
| ----------------------- | -------------------------------------- |
| `Provider`              | Synchronous computed/derived values    |
| `FutureProvider`        | One-shot async data (fetches)          |
| `StreamProvider`        | Reactive streams                       |
| `NotifierProvider`      | Mutable synchronous state with methods |
| `AsyncNotifierProvider` | Mutable async state with methods       |

### Code Generation (Preferred)

- Prefer `@riverpod` annotation + `riverpod_generator` to reduce boilerplate.
- The generated code creates the provider declaration automatically.

  ```dart
  // GOOD — code-gen approach
  import 'package:riverpod_annotation/riverpod_annotation.dart';
  part 'counter.g.dart';

  @riverpod
  class Counter extends _$Counter {
    @override
    int build() => 0;

    void increment() => state++;
    void decrement() => state--;
  }
  // Generated: counterProvider is a NotifierProvider<Counter, int>
  ```

  ```dart
  // GOOD — code-gen async provider with parameters (family)
  @riverpod
  Future<Post> fetchPost(Ref ref, int postId) async {
    final response = await dio.get('/api/posts/$postId');
    return Post.fromJson(response.data);
  }
  // Usage: ref.watch(fetchPostProvider(42))
  ```

### Manual Provider Declaration

```dart
// Acceptable when code-gen is not set up
class TodoList extends Notifier<List<Todo>> {
  @override
  List<Todo> build() => [];

  void add(String description) {
    state = [...state, Todo(description: description)];
  }

  void remove(String id) {
    state = state.where((t) => t.id != id).toList();
  }
}

final todoListProvider = NotifierProvider<TodoList, List<Todo>>(TodoList.new);
```

### AsyncNotifier Pattern

- Use `AsyncNotifier` for state that requires async initialization or mutation.
- Use `AsyncValue.guard()` for error handling inside notifiers.
- Use `.copyWithPrevious(state)` on `AsyncLoading` to preserve stale data during refresh.

  ```dart
  class UserNotifier extends AsyncNotifier<User> {
    @override
    Future<User> build() async {
      final response = await dio.get('/api/user');
      return User.fromJson(response.data);
    }

    Future<void> updateName(String name) async {
      state = const AsyncLoading<User>().copyWithPrevious(state);
      state = await AsyncValue.guard(() async {
        await dio.patch('/api/user', data: {'name': name});
        return state.requireValue.copyWith(name: name);
      });
    }
  }

  final userProvider = AsyncNotifierProvider<UserNotifier, User>(UserNotifier.new);
  ```

### Consuming Providers

- Use `ConsumerWidget` (not `StatelessWidget`) to access `ref`.
- Use `ref.watch()` in `build()` to reactively rebuild on state changes.
- Use `ref.read()` in callbacks (onPressed, etc.) — never in `build()`.
- Use `ref.listen()` for side effects (navigation, showing snackbars).

  ```dart
  class ProfileScreen extends ConsumerWidget {
    const ProfileScreen({super.key});

    @override
    Widget build(BuildContext context, WidgetRef ref) {
      final userAsync = ref.watch(userProvider);

      return switch (userAsync) {
        AsyncData(:final value) => Text('Hello, ${value.name}'),
        AsyncError(:final error) => Text('Error: $error'),
        _ => const CircularProgressIndicator(),
      };
    }
  }
  ```

- **Anti-pattern:** Using `ref.watch()` inside a callback or `ref.read()` inside `build()`.

  ```dart
  // BAD
  onPressed: () {
    final user = ref.watch(userProvider); // should be ref.read
  }

  // BAD
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(counterProvider.notifier); // should be ref.watch for state
  }
  ```

### ProviderScope

- Wrap the root app in `ProviderScope`.
- Use `overrides` in `ProviderScope` for testing.

  ```dart
  void main() {
    runApp(const ProviderScope(child: MyApp()));
  }
  ```

---

## Bloc / Cubit

### When to Use Cubit vs Bloc

- **Cubit**: Simpler — methods emit new state directly. Good for straightforward state transitions.
- **Bloc**: Event-driven — events are processed by handlers. Better for complex flows, event transformation, debouncing.

### Cubit Pattern

```dart
class CounterCubit extends Cubit<int> {
  CounterCubit() : super(0);

  void increment() => emit(state + 1);
  void decrement() => emit(state - 1);
}
```

### Bloc Pattern

- Use `sealed class` for events to enable exhaustive handling.
- Register event handlers in the constructor with `on<Event>`.

  ```dart
  // Events
  sealed class CounterEvent {}
  final class CounterIncrementPressed extends CounterEvent {}
  final class CounterDecrementPressed extends CounterEvent {}

  // Bloc
  class CounterBloc extends Bloc<CounterEvent, int> {
    CounterBloc() : super(0) {
      on<CounterIncrementPressed>((event, emit) => emit(state + 1));
      on<CounterDecrementPressed>((event, emit) => emit(state - 1));
    }
  }
  ```

### State Classes

- Use `sealed class` or `freezed` for state types with multiple variants.
- Keep state classes immutable — use `copyWith` for updates.

  ```dart
  sealed class AuthState {}
  final class AuthInitial extends AuthState {}
  final class AuthLoading extends AuthState {}
  final class AuthAuthenticated extends AuthState {
    final User user;
    const AuthAuthenticated(this.user);
  }
  final class AuthError extends AuthState {
    final String message;
    const AuthError(this.message);
  }
  ```

### Flutter Bloc Widgets

- `BlocProvider`: Creates and provides a Bloc/Cubit to the subtree. Use `create`, not `value`, for new instances.
- `BlocBuilder`: Rebuilds on state changes. Use `buildWhen` to filter.
- `BlocListener`: For side effects (navigation, dialogs). Use `listenWhen` to filter.
- `BlocConsumer`: Combines `BlocBuilder` + `BlocListener`.
- `context.read<T>()`: Access Bloc/Cubit in callbacks (not in build).
- `context.watch<T>()`: Reactively listen in build methods.

  ```dart
  // GOOD
  BlocProvider(
    create: (_) => CounterBloc(),
    child: const CounterPage(),
  )

  // BAD — providing an already-created instance without BlocProvider.value
  BlocProvider(
    create: (_) => existingBloc, // should use BlocProvider.value
    child: const CounterPage(),
  )
  ```

### Multi-Bloc Observation

- Use `Builder` + `context.watch<T>()` to observe multiple Blocs simultaneously.

  ```dart
  Builder(
    builder: (context) {
      final stateA = context.watch<BlocA>().state;
      final stateB = context.watch<BlocB>().state;
      return Text('$stateA / $stateB');
    },
  )
  ```
