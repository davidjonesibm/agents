# Platform Channels & Pigeon

Target: Flutter 3.x / Pigeon 22.x+

## General Rules

- Use **Pigeon** for type-safe platform channels. Avoid raw `MethodChannel` with string-based method names in new code.
- Raw `MethodChannel` is acceptable only for trivial one-off calls or when using third-party plugins that use it internally.
- Each platform channel method should have typed request/reply objects — never pass untyped `Map<String, dynamic>`.

## Pigeon (Recommended)

- Pigeon generates type-safe messaging code for Dart, Kotlin/Java (Android), Swift/ObjC (iOS), C++ (Windows/macOS).
- Define the API in a Dart file with annotations, then run the Pigeon code generator.

### Defining the API

```dart
// pigeons/api.dart
import 'package:pigeon/pigeon.dart';

class SearchRequest {
  final String query;
  SearchRequest({required this.query});
}

class SearchReply {
  final String result;
  SearchReply({required this.result});
}

@HostApi()
abstract class SearchApi {
  @async
  SearchReply search(SearchRequest request);
}
```

- `@HostApi()` — Dart → Native (host) calls.
- `@FlutterApi()` — Native → Dart callbacks.
- `@async` — Mark methods that return asynchronously on the platform side.

### Running the Generator

```bash
dart run pigeon --input pigeons/api.dart
```

Or configure in `build.yaml` / `pubspec.yaml` for automatic code generation.

### Dart Usage (Generated)

```dart
// Generated code provides a typed API
final api = SearchApi();
final reply = await api.search(SearchRequest(query: 'flutter'));
print(reply.result);
```

### Platform Implementation (Kotlin)

```kotlin
class SearchApiImpl : SearchApi {
  override fun search(request: SearchRequest, callback: (Result<SearchReply>) -> Unit) {
    val result = performSearch(request.query)
    callback(Result.success(SearchReply(result = result)))
  }
}

// Register in MainActivity
SearchApi.setUp(flutterEngine.dartExecutor.binaryMessenger, SearchApiImpl())
```

### Platform Implementation (Swift)

```swift
class SearchApiImpl: SearchApi {
  func search(request: SearchRequest, completion: @escaping (Result<SearchReply, Error>) -> Void) {
    let result = performSearch(query: request.query)
    completion(.success(SearchReply(result: result)))
  }
}

// Register in AppDelegate
SearchApiSetup.setUp(binaryMessenger: controller.binaryMessenger, api: SearchApiImpl())
```

## Raw MethodChannel (Legacy)

- If you must use `MethodChannel`, match channel name and method name strings exactly between Dart and platform.

  ```dart
  // Dart side
  const channel = MethodChannel('com.example.app/battery');
  final level = await channel.invokeMethod<int>('getBatteryLevel');
  ```

  ```kotlin
  // Kotlin side
  MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.example.app/battery")
    .setMethodCallHandler { call, result ->
      when (call.method) {
        "getBatteryLevel" -> result.success(getBatteryLevel())
        else -> result.notImplemented()
      }
    }
  ```

  ```swift
  // Swift side
  let channel = FlutterMethodChannel(name: "com.example.app/battery",
                                     binaryMessenger: controller.binaryMessenger)
  channel.setMethodCallHandler { (call, result) in
    switch call.method {
    case "getBatteryLevel":
      result(self.getBatteryLevel())
    default:
      result(FlutterMethodNotImplemented)
    }
  }
  ```

### Anti-Patterns

- **Do not** pass complex objects as raw `Map` or `List` through `MethodChannel` — use Pigeon.
- **Do not** forget to call `result.notImplemented()` / `FlutterMethodNotImplemented` for unknown methods.
- **Do not** block the platform UI thread in method call handlers — use background task queues.

## Platform Views (AndroidView / UiKitView)

- Use `AndroidView` and `UiKitView` to embed native platform views in Flutter.
- Use only when the native view cannot be reimplemented in Flutter (e.g., maps, web views).
- Platform views have performance overhead — prefer pure Flutter widgets where possible.

  ```dart
  if (defaultTargetPlatform == TargetPlatform.android) {
    return AndroidView(
      viewType: 'com.example/native-map',
      creationParams: {'lat': 37.7749, 'lng': -122.4194},
      creationParamsCodec: const StandardMessageCodec(),
    );
  } else if (defaultTargetPlatform == TargetPlatform.iOS) {
    return UiKitView(
      viewType: 'com.example/native-map',
      creationParams: {'lat': 37.7749, 'lng': -122.4194},
      creationParamsCodec: const StandardMessageCodec(),
    );
  }
  ```

## Background Execution

- On iOS, use the Task Queue API to run platform channel handlers on a background thread:

  ```swift
  let taskQueue = registrar.messenger().makeBackgroundTaskQueue?()
  let channel = FlutterMethodChannel(
    name: "com.example.heavy",
    binaryMessenger: registrar.messenger(),
    codec: FlutterStandardMethodCodec.sharedInstance(),
    taskQueue: taskQueue
  )
  ```
