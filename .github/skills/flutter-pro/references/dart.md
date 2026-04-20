# Dart Language Features

Target: Dart 3.x+

## Null Safety

- Dart has **sound null safety** — types are non-nullable by default. Append `?` to make nullable.
- Never suppress null safety with `// ignore` comments.
- Prefer **control-flow guards** over `!` (bang operator).

  ```dart
  // GOOD — guard clause
  final user = getUser();
  if (user == null) return;
  print(user.name); // user is promoted to non-nullable

  // BAD — bang operator risks runtime exception
  final user = getUser();
  print(user!.name);
  ```

- Use `??` for defaults and `?.` for conditional access.

  ```dart
  final name = user?.name ?? 'Unknown';
  ```

- For generic classes, understand nullable bounds:

  ```dart
  // T is non-nullable — can call methods on T directly
  class Box<T extends num> {
    final T value;
    Box(this.value);
    bool get isPositive => value > 0;
  }

  // T is nullable — must null-check before using
  class OptionalBox<T extends num?> {
    final T value;
    OptionalBox(this.value);
    bool get isPositive {
      final v = value;
      return v != null && v > 0;
    }
  }
  ```

## Sealed Classes

- Use `sealed` for type hierarchies where you need **exhaustive pattern matching**.
- Sealed classes are implicitly abstract — cannot be instantiated directly.
- All direct subtypes must be in the **same library**.

  ```dart
  sealed class Result<T> {
    const Result();
  }

  class Success<T> extends Result<T> {
    final T data;
    const Success(this.data);
  }

  class Failure<T> extends Result<T> {
    final String error;
    const Failure(this.error);
  }

  // Exhaustive switch — compiler warns if a case is missing
  String describe(Result<String> r) => switch (r) {
    Success(:final data) => 'OK: $data',
    Failure(:final error) => 'Error: $error',
  };
  ```

## Pattern Matching

- Use **switch expressions** (Dart 3) for concise branching.
- Use **destructuring patterns** to extract fields.

  ```dart
  // Switch expression with object destructuring
  String formatUser(User user) => switch (user) {
    User(name: final n, age: final a) when a >= 18 => '$n (adult)',
    User(name: final n) => '$n (minor)',
  };
  ```

- **Null-check pattern** (`?`) — matches non-null and binds as non-nullable:

  ```dart
  switch (maybeString) {
    case var s?:
      print(s.length); // s is non-nullable String
  }
  ```

- **Null-assert pattern** (`!`) — throws if null:

  ```dart
  var (x!, y!) = (nullableX, nullableY); // throws if either is null
  ```

- **Guard clauses** with `when`:

  ```dart
  switch (value) {
    case int n when n > 0: print('positive');
    case int n when n < 0: print('negative');
    case _: print('zero');
  }
  ```

## Records

- Records are anonymous, immutable, aggregate types. Use for returning multiple values.
- Named fields for clarity; positional for simple pairs.

  ```dart
  // Positional record
  (int, String) getUserInfo() => (42, 'Alice');

  // Named record
  ({int id, String name}) getUserInfo() => (id: 42, name: 'Alice');

  // Destructuring
  final (id, name) = getUserInfo();
  final (:id, :name) = getUserInfoNamed();
  ```

- Use records instead of creating one-off data classes for private/internal tuples.
- Do **not** use records for public API types that need methods or serialization — use proper classes.

## Class Modifiers

| Modifier    | Constructible | Extendable (same lib) | Extendable (external)                 | Implementable (external) |
| ----------- | ------------- | --------------------- | ------------------------------------- | ------------------------ |
| _(none)_    | Yes           | Yes                   | Yes                                   | Yes                      |
| `abstract`  | No            | Yes                   | Yes                                   | Yes                      |
| `base`      | Yes           | Yes                   | Yes (must be `base`/`final`/`sealed`) | No                       |
| `interface` | Yes           | Yes                   | No                                    | Yes                      |
| `final`     | Yes           | Yes                   | No                                    | No                       |
| `sealed`    | No            | Yes                   | No                                    | No                       |
| `mixin`     | —             | —                     | —                                     | Mixed in                 |

- Use `final` on classes that are not designed for extension outside the library.
- Use `sealed` for exhaustive type hierarchies (see above).
- Use `base` when subclasses must preserve invariants (forces subclasses to also be `base`, `final`, or `sealed`).
- Use `interface` for contracts that should be implemented, not extended.

  ```dart
  // GOOD — final prevents unexpected subclassing
  final class ApiClient {
    void fetch() { ... }
  }

  // BAD — open class that was never designed for subclassing
  class ApiClient { ... }
  ```

## Extension Types

- Extension types are compile-time wrappers with zero runtime cost. Use for type-safe wrappers around primitive types.

  ```dart
  extension type UserId(int value) {
    bool get isValid => value > 0;
  }

  extension type EmailAddress(String value) {
    bool get isValid => value.contains('@');
  }

  // Type-safe — cannot accidentally pass an int where UserId is expected
  void fetchUser(UserId id) { ... }
  fetchUser(UserId(42)); // OK
  // fetchUser(42); // Compile error
  ```

## Enums

- Prefer **enhanced enums** (Dart 2.17+) with fields and methods over plain enums.

  ```dart
  enum Priority {
    low('Low', 1),
    medium('Medium', 2),
    high('High', 3);

    const Priority(this.label, this.value);
    final String label;
    final int value;
  }
  ```

## Async Patterns

- Use `async`/`await` — never use raw `.then()` chains.
- Use `Future.wait()` for parallel async operations.
- Handle errors with try/catch in async functions.

  ```dart
  // GOOD
  Future<void> loadData() async {
    try {
      final (user, posts) = await (fetchUser(), fetchPosts()).wait;
      // use both results
    } catch (e) {
      // handle error
    }
  }

  // BAD — .then() chains
  fetchUser().then((user) {
    fetchPosts().then((posts) { ... });
  });
  ```

## Collections

- Use collection `if` and `for` instead of imperative list building.
- Use spread operator `...` for combining collections.

  ```dart
  // GOOD — declarative
  final widgets = [
    const Header(),
    if (showBanner) const Banner(),
    for (final item in items) ItemCard(item: item),
    ...footerWidgets,
  ];

  // BAD — imperative
  final widgets = <Widget>[Header()];
  if (showBanner) widgets.add(Banner());
  for (final item in items) widgets.add(ItemCard(item: item));
  widgets.addAll(footerWidgets);
  ```

## Naming Conventions

- Classes, enums, typedefs, extension types: `UpperCamelCase`
- Variables, parameters, functions: `lowerCamelCase`
- Libraries, packages, directories, source files: `lowercase_with_underscores`
- Constants: `lowerCamelCase` (not `SCREAMING_CAPS`)
- Private members: prefix with `_`
