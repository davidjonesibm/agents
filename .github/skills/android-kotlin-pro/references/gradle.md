# Gradle Configuration

Target: AGP 8.x+, Kotlin 2.0+, Gradle 8.x+.

## Kotlin DSL

- **Use `build.gradle.kts`** (Kotlin DSL) for all Gradle files — never Groovy in new projects.

  ```kotlin
  // Before (Groovy)
  android {
      compileSdkVersion 35
      defaultConfig {
          minSdkVersion 24
      }
  }

  // After (Kotlin DSL)
  android {
      compileSdk = 35
      defaultConfig {
          minSdk = 24
      }
  }
  ```

## Version Catalogs (`libs.versions.toml`)

- **Centralize all dependency versions** in `gradle/libs.versions.toml`:

  ```toml
  [versions]
  kotlin = "2.0.21"
  agp = "8.7.3"
  compose-bom = "2024.12.01"
  hilt = "2.51.1"
  room = "2.6.1"
  navigation = "2.8.5"
  lifecycle = "2.8.7"
  coroutines = "1.9.0"
  ksp = "2.0.21-1.0.28"

  [libraries]
  # Compose BOM
  compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }
  compose-ui = { group = "androidx.compose.ui", name = "ui" }
  compose-material3 = { group = "androidx.compose.material3", name = "material3" }
  compose-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
  compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
  compose-ui-test-junit4 = { group = "androidx.compose.ui", name = "ui-test-junit4" }
  compose-ui-test-manifest = { group = "androidx.compose.ui", name = "ui-test-manifest" }

  # Lifecycle
  lifecycle-runtime-compose = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }
  lifecycle-viewmodel-compose = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }

  # Navigation
  navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigation" }

  # Hilt
  hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
  hilt-compiler = { group = "com.google.dagger", name = "hilt-compiler", version.ref = "hilt" }
  hilt-navigation-compose = { group = "androidx.hilt", name = "hilt-navigation-compose", version = "1.2.0" }

  # Room
  room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
  room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
  room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }

  # Testing
  junit = { group = "junit", name = "junit", version = "4.13.2" }
  mockk = { group = "io.mockk", name = "mockk", version = "1.13.13" }
  turbine = { group = "app.cash.turbine", name = "turbine", version = "1.2.0" }
  kotlinx-coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-test", version.ref = "coroutines" }

  [plugins]
  android-application = { id = "com.android.application", version.ref = "agp" }
  android-library = { id = "com.android.library", version.ref = "agp" }
  kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
  kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
  kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
  hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
  ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }
  room = { id = "androidx.room", version.ref = "room" }
  ```

- **Reference in `build.gradle.kts`**:

  ```kotlin
  plugins {
      alias(libs.plugins.android.application)
      alias(libs.plugins.kotlin.android)
      alias(libs.plugins.kotlin.compose)
      alias(libs.plugins.hilt)
      alias(libs.plugins.ksp)
  }

  dependencies {
      implementation(platform(libs.compose.bom))
      implementation(libs.compose.ui)
      implementation(libs.compose.material3)
      implementation(libs.lifecycle.runtime.compose)
      implementation(libs.lifecycle.viewmodel.compose)
      implementation(libs.navigation.compose)
      implementation(libs.hilt.android)
      ksp(libs.hilt.compiler)
  }
  ```

## App Module Configuration

```kotlin
android {
    namespace = "com.example.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}
```

## KSP over KAPT

- **Always use KSP** for annotation processing (Room, Hilt, Moshi). KAPT is deprecated and slower.

  ```kotlin
  // Before — KAPT (deprecated)
  plugins { id("kotlin-kapt") }
  dependencies { kapt(libs.room.compiler) }

  // After — KSP
  plugins { alias(libs.plugins.ksp) }
  dependencies { ksp(libs.room.compiler) }
  ```

## Convention Plugins (Multi-Module)

- For multi-module projects, use **build-logic convention plugins** to share configuration:

  ```
  build-logic/
  ├── convention/
  │   ├── build.gradle.kts
  │   └── src/main/kotlin/
  │       ├── AndroidApplicationConventionPlugin.kt
  │       ├── AndroidLibraryConventionPlugin.kt
  │       └── ComposeConventionPlugin.kt
  ```

  ```kotlin
  // ComposeConventionPlugin.kt
  class ComposeConventionPlugin : Plugin<Project> {
      override fun apply(target: Project) = with(target) {
          pluginManager.apply("org.jetbrains.kotlin.plugin.compose")
          extensions.configure<LibraryExtension> {
              buildFeatures.compose = true
          }
          dependencies {
              val bom = libs.findLibrary("compose-bom").orElseThrow()
              add("implementation", platform(bom))
              add("implementation", libs.findLibrary("compose-ui").orElseThrow())
              add("implementation", libs.findLibrary("compose-material3").orElseThrow())
          }
      }
  }
  ```

## Compose Compiler Plugin (Kotlin 2.0+)

- In Kotlin 2.0+, the Compose compiler is a Kotlin compiler plugin. Apply it via the plugin:

  ```kotlin
  plugins {
      alias(libs.plugins.kotlin.compose) // org.jetbrains.kotlin.plugin.compose
  }
  ```

- **Do not set `composeOptions.kotlinCompilerExtensionVersion`** — that is the old pre-2.0 approach.

## Common Mistakes

- **Do not mix Groovy and Kotlin DSL files** in the same project.
- **Do not hardcode dependency versions** in `build.gradle.kts` — always use the version catalog.
- **Do not use `buildSrc`** for build logic — it invalidates all caches on change. Use `build-logic` included build.
- **Do not use `implementation` for inter-module APIs** — use `api` when types leak across module boundaries.
- **Do not disable `minifyEnabled`** in release builds to "fix" crashes — fix the ProGuard rules instead.
