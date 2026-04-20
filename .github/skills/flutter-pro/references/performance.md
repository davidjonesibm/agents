# Performance

Target: Flutter 3.x / Dart 3.x+

## Const Constructors

- **Most impactful single optimiation.** Use `const` on every widget constructor and instantiation where possible.
- `const` widgets are canonicalized — Flutter reuses the same instance and skips rebuild entirely.
- The linter rule `prefer_const_constructors` should always be enabled.

  ```dart
  // GOOD — const propagation
  const Padding(
    padding: EdgeInsets.all(16),
    child: Text('Hello'),
  )

  // BAD — unnecessary rebuild every frame
  Padding(
    padding: EdgeInsets.all(16),
    child: Text('Hello'),
  )
  ```

## RepaintBoundary

- Wrap frequently-updating widgets in `RepaintBoundary` to isolate their repaint area from the rest of the tree.
- Without a boundary, a single animating widget can cause the entire screen to repaint.
- Use DevTools "Highlight Repaints" to identify which areas repaint.

  ```dart
  // GOOD — isolates animated spinner from the rest of the page
  const RepaintBoundary(
    child: CircularProgressIndicator(),
  )

  // BAD — spinner causes entire Scaffold to repaint
  const CircularProgressIndicator()
  ```

- Good candidates for `RepaintBoundary`: progress indicators, animated icons, tickers, video players, canvas-drawn widgets.
- Do **not** wrap every widget — each boundary allocates an offscreen buffer. Use only where profiling shows excess repaints.

## ListView & Long Lists

- Always use `ListView.builder` (or `.separated`) for dynamic or large lists — it renders only visible items.
- Never use `ListView(children: [...])` with dynamic data — it builds all children eagerly.
- Use `prototypeItem` for uniform-height lists to speed up layout calculations.

  ```dart
  // GOOD — lazy building
  ListView.builder(
    itemCount: items.length,
    prototypeItem: const ListTile(title: Text('')),
    itemBuilder: (context, index) => ListTile(
      key: ValueKey(items[index].id),
      title: Text(items[index].name),
    ),
  )

  // BAD — builds all children upfront
  ListView(
    children: items.map((i) => ListTile(title: Text(i.name))).toList(),
  )
  ```

## Widget Rebuilds

- Extract subtrees into separate `StatelessWidget` classes to limit rebuild scope.
- Private helper methods (`_buildHeader()`) **do not** create separate `Element`s — the entire parent rebuilds.
- Use `const` widgets to prevent child rebuilds when parent rebuilds.

  ```dart
  // GOOD — Header has its own Element, rebuilds independently
  class _Header extends StatelessWidget {
    const _Header();
    @override
    Widget build(BuildContext context) => const Text('Title');
  }

  // BAD — _buildHeader rebuilds every time parent rebuilds
  Widget _buildHeader() => const Text('Title');
  ```

## Avoid Expensive Operations in build()

- `build()` can be called many times per second. Never perform I/O, parsing, or heavy computation inside it.
- Move expensive work to `initState()`, state management providers, or `compute()` for isolate offloading.

  ```dart
  // BAD — JSON parsing on every rebuild
  @override
  Widget build(BuildContext context) {
    final data = jsonDecode(rawJson); // expensive
    return Text(data['name']);
  }

  // GOOD — parse once
  late final Map<String, dynamic> data;
  @override
  void initState() {
    super.initState();
    data = jsonDecode(rawJson);
  }
  ```

## Image Optimization

- Use `cacheWidth` and `cacheHeight` on `Image` to resize before decoding — reduces memory.
- Use `Image.asset` with resolution-aware assets (`1.0x`, `2.0x`, `3.0x` directories).
- For network images, use `CachedNetworkImage` package for disk caching.

  ```dart
  Image.network(
    url,
    cacheWidth: 200, // decode at this size, not full resolution
    cacheHeight: 200,
  )
  ```

## Animation Performance

- Use `AnimatedBuilder` or `AnimatedWidget` — they rebuild only the animated subtree.
- Avoid using `setState` in a `StatefulWidget` for animations — it rebuilds the entire widget.
- Use `addPostFrameCallback` or `SchedulerBinding` when coordinating with the render pipeline.

## DevTools Profiling

- **Timeline view**: identifies jank (frames > 16ms).
- **Widget rebuild tracker**: shows which widgets rebuild and how often.
- **Repaint rainbow**: enables visual repaint regions.
- **Memory view**: tracks Dart heap allocations and GC.
- Use `Timeline.startSync` / `Timeline.finishSync` for custom performance traces.

  ```dart
  import 'dart:developer';

  void expensiveOperation() {
    Timeline.startSync('expensiveOperation');
    // ... do work ...
    Timeline.finishSync();
  }
  ```

- Run in **profile mode** for accurate performance data:

  ```bash
  flutter run --profile
  ```

## Build Modes

| Mode      | Use for               | Tree-shaking | Assertions | DevTools      |
| --------- | --------------------- | ------------ | ---------- | ------------- |
| `debug`   | Development           | No           | Yes        | Full          |
| `profile` | Performance profiling | Yes          | No         | Timeline only |
| `release` | Production            | Yes          | No         | None          |

- Never profile in debug mode — the JIT compiler and assertion overhead make results misleading.

## Key Anti-Patterns

- Building entire widget trees inside `setState(() { })` callback.
- Using `Opacity` widget for hiding — use `Visibility` or conditional rendering instead (Opacity still paints).
- Creating new objects (closures, lists, maps) in `build()` that cause child rebuilds.
- Forgetting `const` on widgets with literal-only arguments.
