# Build & Deployment

Target: Flutter 3.x

## Build Flavors

- Use flavors to manage multiple environments (development, staging, production) with different configurations, app IDs, and API endpoints.
- Flavors are configured separately in Android (`build.gradle.kts`) and iOS (Xcode schemes).
- Access the current flavor in Dart via the `appFlavor` constant.

### Android Configuration (`build.gradle.kts`)

```kotlin
android {
  flavorDimensions += "default"
  productFlavors {
    create("development") {
      dimension = "default"
      applicationIdSuffix = ".dev"
      resValue("string", "app_name", "MyApp Dev")
    }
    create("staging") {
      dimension = "default"
      applicationIdSuffix = ".staging"
      resValue("string", "app_name", "MyApp Staging")
    }
    create("production") {
      dimension = "default"
      resValue("string", "app_name", "MyApp")
    }
  }
}
```

### iOS Configuration

- Create Xcode schemes for each flavor (e.g., `Development`, `Staging`, `Production`).
- Map custom build configurations in Podfile:

  ```ruby
  project 'Runner', {
    'Debug' => :debug,
    'Debug-development' => :debug,
    'Debug-staging' => :debug,
    'Debug-production' => :debug,
    'Profile' => :release,
    'Profile-development' => :release,
    'Profile-staging' => :release,
    'Profile-production' => :release,
    'Release' => :release,
    'Release-development' => :release,
    'Release-staging' => :release,
    'Release-production' => :release,
  }
  ```

### Dart Usage

```dart
void main() {
  if (appFlavor == 'production') {
    Config.apiUrl = 'https://api.myapp.com';
  } else if (appFlavor == 'staging') {
    Config.apiUrl = 'https://staging.api.myapp.com';
  } else {
    Config.apiUrl = 'https://dev.api.myapp.com';
  }

  runApp(const MyApp());
}
```

### Running with Flavors

```bash
flutter run --flavor development
flutter run --flavor staging
flutter run --flavor production

flutter build apk --flavor production --release
flutter build ipa --flavor production --release
```

### Flavor-Specific Assets

```yaml
# pubspec.yaml
flutter:
  assets:
    - path: assets/common/
    - path: assets/production/
      flavors:
        - production
    - path: assets/staging/
      flavors:
        - staging
```

## Compile-Time Variables

- Use `--dart-define` for compile-time constants.

  ```bash
  flutter run --dart-define=API_KEY=abc123 --dart-define=ENV=staging
  ```

  ```dart
  const apiKey = String.fromEnvironment('API_KEY');
  const env = String.fromEnvironment('ENV', defaultValue: 'development');
  ```

## Fastlane Integration

- Use Fastlane for automating builds, signing, and deployment.
- Add a `Gemfile` in both `android/` and `ios/` directories:

  ```ruby
  source "https://rubygems.org"
  gem "fastlane"
  ```

### iOS Fastlane

```ruby
# ios/fastlane/Fastfile
default_platform(:ios)

platform :ios do
  desc "Deploy to TestFlight"
  lane :beta do
    build_app(
      skip_build_archive: true,
      archive_path: "../build/ios/archive/Runner.xcarchive",
    )
    upload_to_testflight
  end
end
```

```bash
# Build first with Flutter, then deploy
flutter build ipa --flavor production --release
cd ios && bundle exec fastlane beta
```

### Android Fastlane

```ruby
# android/fastlane/Fastfile
default_platform(:android)

platform :android do
  desc "Deploy to Play Store internal track"
  lane :beta do
    upload_to_play_store(
      track: 'internal',
      aab: '../build/app/outputs/bundle/productionRelease/app-production-release.aab',
    )
  end
end
```

```bash
flutter build appbundle --flavor production --release
cd android && bundle exec fastlane beta
```

## Android Release Signing

- Store signing credentials in `key.properties` (never commit to version control).
- Load in `build.gradle.kts`:

  ```kotlin
  import java.util.Properties
  import java.io.FileInputStream

  val keystoreProperties = Properties()
  val keystorePropertiesFile = rootProject.file("key.properties")
  if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
  }

  android {
    signingConfigs {
      create("release") {
        keyAlias = keystoreProperties["keyAlias"] as String
        keyPassword = keystoreProperties["keyPassword"] as String
        storeFile = file(keystoreProperties["storeFile"] as String)
        storePassword = keystoreProperties["storePassword"] as String
      }
    }
    buildTypes {
      getByName("release") {
        signingConfig = signingConfigs.getByName("release")
      }
    }
  }
  ```

- Add to `.gitignore`:

  ```
  key.properties
  *.keystore
  *.jks
  ```

## Build Commands Reference

```bash
# Debug
flutter run

# Profile (for performance testing)
flutter run --profile

# Release builds
flutter build apk --release              # Android APK
flutter build appbundle --release         # Android AAB (Play Store)
flutter build ipa --release               # iOS archive
flutter build web --release               # Web (HTML/JS/WASM)
flutter build macos --release             # macOS
flutter build linux --release             # Linux
flutter build windows --release           # Windows

# With flavor
flutter build apk --flavor production --release

# iOS config only (regenerates Xcode project)
flutter build ios --config-only
```

## Anti-Patterns

- Committing signing keys or `key.properties` to version control.
- Hardcoding API keys in Dart source — use `--dart-define` or flavor-specific config.
- Building release artifacts without `--release` flag (includes debug overhead).
- Not testing release builds before deployment — `release` mode can surface issues that `debug` mode hides (tree-shaking, assertion removal).
