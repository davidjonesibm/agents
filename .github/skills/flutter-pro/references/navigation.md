# Navigation (GoRouter)

Target: go_router 14.x+ / Flutter 3.x

## General Rules

- Use **GoRouter** for all navigation. Avoid imperative `Navigator.push()` / `Navigator.pop()` except for transient overlays (bottom sheets, dialogs).
- GoRouter is built on Flutter's Navigation 2.0 (Router API) — it handles deep linking, URL-based routing, and browser history automatically.
- Define all routes declaratively in a single `GoRouter` configuration.

## Basic Setup

```dart
final GoRouter router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/details/:id',
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return DetailsScreen(id: id);
      },
    ),
  ],
);

// In MaterialApp
MaterialApp.router(routerConfig: router)
```

## Navigation Methods

- `context.go('/path')` — Navigate to a route, replacing the current stack. Use for primary navigation.
- `context.push('/path')` — Push a route onto the stack (can be popped). Use for sub-screens.
- `context.pop()` — Pop the current route.
- `context.goNamed('routeName')` — Navigate by name instead of path.

  ```dart
  // GOOD — declarative navigation
  context.go('/details/${item.id}');
  context.push('/details/${item.id}/edit');

  // BAD — imperative Navigator (not deep-linkable)
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => DetailsScreen(id: item.id)),
  );
  ```

## Named Routes

- Use `name` parameter on `GoRoute` for type-safe navigation.

  ```dart
  GoRoute(
    name: 'details',
    path: '/details/:id',
    builder: (context, state) => DetailsScreen(
      id: state.pathParameters['id']!,
    ),
  ),

  // Navigate by name
  context.goNamed('details', pathParameters: {'id': '42'});
  ```

## ShellRoute (Persistent Shell UI)

- Use `ShellRoute` for navigation shells (e.g., bottom navigation bar, sidebar) that persist across child routes.
- Use `parentNavigatorKey` to break out of the shell for full-screen routes.

  ```dart
  final rootNavigatorKey = GlobalKey<NavigatorState>();

  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/home',
    routes: [
      ShellRoute(
        builder: (context, state, child) {
          return ScaffoldWithNavBar(child: child);
        },
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) => const HomeScreen(),
          ),
          GoRoute(
            path: '/settings',
            builder: (context, state) => const SettingsScreen(),
            routes: [
              // This route breaks out of the shell
              GoRoute(
                path: 'advanced',
                parentNavigatorKey: rootNavigatorKey,
                builder: (context, state) => const AdvancedSettingsScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
  ```

## StatefulShellRoute (Preserving Tab State)

- Use `StatefulShellRoute` when each tab in a bottom navigation needs to preserve its own navigation stack.
- Each branch gets its own `Navigator`.

  ```dart
  StatefulShellRoute.indexedStack(
    builder: (context, state, navigationShell) {
      return ScaffoldWithNavBar(navigationShell: navigationShell);
    },
    branches: [
      StatefulShellBranch(routes: [
        GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
      ]),
      StatefulShellBranch(routes: [
        GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
      ]),
    ],
  )
  ```

## Redirects

- Use the `redirect` callback for auth guards and route-level redirects.
- Return `null` to allow navigation to proceed; return a path string to redirect.

  ```dart
  GoRouter(
    redirect: (context, state) {
      final isLoggedIn = authNotifier.isLoggedIn;
      final isLoginRoute = state.matchedLocation == '/login';

      if (!isLoggedIn && !isLoginRoute) return '/login';
      if (isLoggedIn && isLoginRoute) return '/home';
      return null; // no redirect
    },
    routes: [ ... ],
  )
  ```

- Route-level redirects:

  ```dart
  GoRoute(
    path: '/',
    redirect: (_, __) => '/home',
  )
  ```

## Passing Data

- Use **path parameters** for required identifiers: `/details/:id`.
- Use **query parameters** for optional data: `/search?q=flutter`.
- Use the `extra` parameter for passing objects (not deep-linkable — use sparingly).

  ```dart
  // Path parameters
  context.go('/details/${item.id}');
  final id = state.pathParameters['id']!;

  // Query parameters
  context.go('/search?q=flutter&page=1');
  final query = state.uri.queryParameters['q'];

  // Extra (not serializable — avoid for deep-linkable routes)
  context.go('/details', extra: myObject);
  final obj = state.extra as MyObject;
  ```

## Error Handling

- Provide an `errorBuilder` or `errorPageBuilder` for 404 / unknown routes.

  ```dart
  GoRouter(
    errorBuilder: (context, state) => ErrorScreen(error: state.error),
    routes: [ ... ],
  )
  ```

## Anti-Patterns

- **Do not** mix imperative `Navigator.push()` with GoRouter for primary navigation — pushed routes are not deep-linkable.
- **Do not** store complex objects in `extra` for routes that should be deep-linkable.
- **Do not** use string concatenation for paths — use `pathParameters` and `queryParameters`.
