# Environment Setup

Complete guide for installing and validating an Appium + WebDriverIO environment. This is the most error-prone part of mobile testing — most failures happen here, not in test code.

## Prerequisites

| Dependency                   | Android  | iOS                   | Check Command        |
| ---------------------------- | -------- | --------------------- | -------------------- |
| Node.js 18+                  | Required | Required              | `node -v`            |
| Java JDK 11+                 | Required | —                     | `java -version`      |
| Android SDK + platform-tools | Required | —                     | `adb --version`      |
| Xcode + CLI tools            | —        | Required (macOS only) | `xcode-select -p`    |
| `ANDROID_HOME` env var       | Required | —                     | `echo $ANDROID_HOME` |
| `JAVA_HOME` env var          | Required | —                     | `echo $JAVA_HOME`    |

## Step 1: Use appium-installer (Recommended)

The fastest way to get a working environment. Run the interactive installer:

```bash
# Install globally
npm install -g appium-installer

# Launch the interactive menu
appium-installer
```

### Quick Setup Profiles

For first-time setup, use a Quick Setup Profile — it handles server, drivers, environment, and diagnostics in one step:

| Profile             | What It Installs                                                      |
| ------------------- | --------------------------------------------------------------------- |
| Android Testing     | Appium Server + UiAutomator2 driver + Android env + Doctor check      |
| iOS Testing         | Appium Server + XCUITest driver + iOS env + Doctor check (macOS only) |
| Full Mobile Testing | Both Android + iOS combined                                           |
| Web on Mobile       | Appium Server + Chromium + Gecko drivers                              |

### Manual Step-by-Step via Installer Menu

If you prefer granular control:

1. **Install Appium Server** — choose latest or specific version
2. **Install Appium Drivers** — select `uiautomator2` (Android) and/or `xcuitest` (iOS)
3. **Setup Android Environment** — configures SDK, JDK, env vars, emulators
4. **Setup iOS Environment** — configures Xcode, simulators, real device deps (macOS only)
5. **Run Appium Doctor** — validates everything is correctly configured

## Step 2: Manual Installation (Alternative)

If not using appium-installer:

```bash
# Install Appium globally
npm install -g appium

# Install drivers
appium driver install uiautomator2
appium driver install xcuitest

# Verify installation
appium driver list --installed
```

### Android SDK Setup

```bash
# Install via Android Studio or command-line tools
# Set environment variables in ~/.zshrc or ~/.bashrc:
export ANDROID_HOME=$HOME/Library/Android/sdk    # macOS
export ANDROID_HOME=$HOME/Android/Sdk            # Linux
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

### iOS Setup (macOS Only)

```bash
# Install Xcode from App Store, then:
xcode-select --install
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# For real devices — install ios-deploy
brew install ios-deploy

# For WebView debugging
brew install ios-webkit-debug-proxy
```

## Step 3: Validate the Environment

### Run Appium Doctor

```bash
# Via appium-installer menu: "Run Appium Doctor"
# Or manually:
appium setup --android    # Validate Android setup
appium setup --ios        # Validate iOS setup
```

### Manual Validation Checklist

```bash
# 1. Appium server starts
appium --version
appium server --port 4724 &   # start, then kill

# 2. Drivers are installed
appium driver list --installed
# Should show: uiautomator2 and/or xcuitest

# 3. Android — emulator boots
emulator -list-avds
emulator -avd <avd-name> &
adb devices   # should show emulator-5554 or similar

# 4. iOS — simulator boots (macOS)
xcrun simctl list devices available
xcrun simctl boot "iPhone 15 Pro"
```

### Environment Status Dashboard

The appium-installer includes a status dashboard accessible from the menu ("Show Environment Status"). It displays:

- System versions (Appium, Node.js, Java, Xcode)
- Environment variables (`ANDROID_HOME`, `JAVA_HOME`)
- Installed drivers and plugins with versions
- Connected devices (ADB devices + booted iOS simulators)
- Health bar (e.g., `6/7 checks passing`)

**Always run this before filing a bug or asking for help.**

## Step 3.5: Simulator and Emulator Management

### iOS Simulators (macOS)

```bash
# List available runtimes and device types
xcrun simctl list runtimes
xcrun simctl list devicetypes

# List all simulators and their state
xcrun simctl list devices available

# Create a simulator
xcrun simctl create "My Test iPhone" \
  "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro" \
  "com.apple.CoreSimulator.SimRuntime.iOS-18-4"

# Boot a simulator
xcrun simctl boot "iPhone 16 Pro"

# Verify it's booted
xcrun simctl list devices booted

# Clone a simulator (fast duplication for parallel testing)
xcrun simctl clone "iPhone 16 Pro" "iPhone 16 Pro Clone 1"
xcrun simctl clone "iPhone 16 Pro" "iPhone 16 Pro Clone 2"

# Shutdown
xcrun simctl shutdown "iPhone 16 Pro"
xcrun simctl shutdown all

# Delete a simulator
xcrun simctl delete "iPhone 16 Pro Clone 1"

# Delete all unavailable/stale simulators (cleanup)
xcrun simctl delete unavailable
```

**Pre-boot simulators before test runs** to avoid cold boot delays inside Appium:

```json
// package.json — pre-boot script
{
  "scripts": {
    "pretest:ios": "xcrun simctl boot 'iPhone 16 Pro' 2>/dev/null || true",
    "test:ios": "wdio run wdio.ios.conf.ts"
  }
}
```

### Android Emulators

```bash
# List existing AVDs
emulator -list-avds

# Create an AVD (use Android Studio AVD Manager for GUI, or command line)
avdmanager create avd \
  --name "Pixel_7_API_34" \
  --package "system-images;android-34;google_apis;x86_64" \
  --device "pixel_7"

# Launch an emulator
emulator -avd Pixel_7_API_34 &

# Launch headless (no GUI — for CI)
emulator -avd Pixel_7_API_34 -no-window -no-audio -gpu swiftshader_indirect &

# Wait for emulator to fully boot
adb wait-for-device
adb shell getprop sys.boot_completed | grep -m 1 1

# Disable animations (reduces test flakiness significantly)
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0

# Verify connected devices
adb devices
```

**WDIO can auto-launch emulators** with the `appium:avd` capability — but pre-booting is faster:

```json
{
  "scripts": {
    "pretest:android": "emulator -avd Pixel_7_API_34 -no-audio &>/dev/null & adb wait-for-device && adb shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done'",
    "test:android": "wdio run wdio.android.conf.ts"
  }
}
```

## Step 3.6: Prebuild WebDriverAgent (iOS — Skip Cold Starts)

The XCUITest driver runs `xcodebuild build-for-testing` + `test-without-building` every session by default. The build phase is the bottleneck (30-60s). Prebuild WDA once and reuse it across all sessions.

### Option A: Download Prebuilt WDA (No Xcode Build Needed)

```bash
# Download the correct prebuilt WDA for your driver version
appium driver run xcuitest download-wda -- \
  --outdir=./wda-packages \
  --kind=sim \
  --platform=ios

# See all options:
appium driver run xcuitest download-wda -- --help
```

Use in capabilities:

```typescript
capabilities: [
  {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': 'iPhone 16 Pro',
    'appium:platformVersion': '18.4',
    'appium:usePreinstalledWDA': true,
    'appium:prebuiltWDAPath': './wda-packages/WebDriverAgentRunner-Runner.app',
    'appium:app': './apps/ios/MyApp.app',
    'appium:noReset': true,
  },
];
```

### Option B: Build WDA Once via Command Line

```bash
# 1. Locate the WDA project
appium driver run xcuitest open-wda   # opens in Xcode (note the path)

# 2. Build for simulator (one-time)
xcodebuild build-for-testing \
  -project /path/to/WebDriverAgent.xcodeproj \
  -derivedDataPath /tmp/wda-prebuild \
  -scheme WebDriverAgentRunner \
  -destination "platform=iOS Simulator,name=iPhone 16 Pro" \
  CODE_SIGNING_ALLOWED=NO

# 3. Build for real device (one-time)
xcodebuild build-for-testing \
  -project /path/to/WebDriverAgent.xcodeproj \
  -derivedDataPath /tmp/wda-realdevice \
  -scheme WebDriverAgentRunner \
  -destination "id=<your-device-udid>" \
  DEVELOPMENT_TEAM=<your-team-id> \
  CODE_SIGN_IDENTITY="Apple Development"
```

Use `derivedDataPath` + `usePrebuiltWDA` in capabilities:

```typescript
capabilities: [
  {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': 'iPhone 16 Pro',
    'appium:platformVersion': '18.4',
    'appium:derivedDataPath': '/tmp/wda-prebuild',
    'appium:usePrebuiltWDA': true,
    'appium:app': './apps/ios/MyApp.app',
    'appium:noReset': true,
  },
];
```

### Option C: Build WDA from Xcode (First-Time / Real Device Signing)

1. Open WDA: `appium driver run xcuitest open-wda`
2. Select scheme: **Product > Scheme > WebDriverAgentRunner**
3. Select destination: your target device/simulator
4. For real devices: go to **Signing & Capabilities**, set your Team, change Bundle ID (e.g., `com.yourcompany.WebDriverAgentRunner`)
5. Build and test: **Product > Test** (Cmd+U)

### WDA Reuse Capabilities Reference

| Capability                  | Effect                                                | Recommended Value             |
| --------------------------- | ----------------------------------------------------- | ----------------------------- |
| `appium:usePreinstalledWDA` | Skip build, use pre-installed WDA app                 | `true` with `prebuiltWDAPath` |
| `appium:prebuiltWDAPath`    | Path to pre-built `.app` bundle                       | Path from download or build   |
| `appium:derivedDataPath`    | Xcode derived data location                           | Stable path for build reuse   |
| `appium:usePrebuiltWDA`     | Skip `build-for-testing`, run directly                | `true` with `derivedDataPath` |
| `appium:useNewWDA`          | `false` = reuse running WDA; `true` = force reinstall | `false` (default, faster)     |
| `appium:prebuildWDA`        | Driver builds WDA first, then runs it                 | `true` if no manual prebuild  |

### Startup Time Comparison

| Strategy                                                   | Typical Session Startup |
| ---------------------------------------------------------- | ----------------------- |
| Cold boot + xcodebuild build + run (default)               | 40-90s                  |
| Pre-booted sim + `usePrebuiltWDA` + `derivedDataPath`      | 15-30s                  |
| Pre-booted sim + `usePreinstalledWDA` + `prebuiltWDAPath`  | 5-15s                   |
| Pre-booted sim + WDA already running (`webDriverAgentUrl`) | 2-5s                    |

### Fast Iteration Capabilities (Development)

Combine all optimizations for the fastest possible dev loop:

```typescript
// wdio.ios-fast.conf.ts — optimized for rapid iteration
capabilities: [
  {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': 'iPhone 16 Pro',
    'appium:platformVersion': '18.4',

    // Skip app reinstall
    'appium:noReset': true,

    // Don't force-restart the app if already running
    'appium:forceAppLaunch': false,

    // Don't terminate app on session end
    'appium:shouldTerminateApp': false,

    // Reuse existing WDA (don't rebuild/reinstall)
    'appium:useNewWDA': false,

    // Use prebuilt WDA
    'appium:usePreinstalledWDA': true,
    'appium:prebuiltWDAPath': './wda-packages/WebDriverAgentRunner-Runner.app',

    // Disable pasteboard sync (perf)
    'appium:simulatorPasteboardAutomaticSync': 'off',

    // Reduce motion (stability + speed)
    'appium:reduceMotion': true,

    // Skip log capture overhead
    'appium:skipLogCapture': true,

    // Generous idle timeout for debugging
    'appium:newCommandTimeout': 300,

    'appium:app': './apps/ios/MyApp.app',
  },
];
```

### iOS Simulator-Specific Capabilities

| Capability                                      | Purpose                                             | Default        |
| ----------------------------------------------- | --------------------------------------------------- | -------------- |
| `appium:simulatorStartupTimeout`                | Max wait (ms) for simulator boot                    | 120000         |
| `appium:simulatorPasteboardAutomaticSync`       | `'off'` improves performance                        | `'on'`         |
| `appium:reduceMotion`                           | Reduces animation-related flakiness                 | `false`        |
| `appium:reduceTransparency`                     | Cleaner screenshots                                 | `false`        |
| `appium:isHeadless`                             | No Simulator UI (useful for CI)                     | `false`        |
| `appium:connectHardwareKeyboard`                | Disable hardware keyboard mapping                   | `true`         |
| `appium:forceSimulatorSoftwareKeyboardPresence` | Force software keyboard to show                     | `false`        |
| `appium:enforceFreshSimulatorCreation`          | Create/delete simulator per session                 | `false`        |
| `appium:scaleFactor`                            | Scale simulator window (`'0.5'`, `'0.75'`, `'1.0'`) | Device default |
| `appium:permissions`                            | Pre-grant app permissions (JSON string)             | —              |
| `appium:language`                               | Simulator language                                  | —              |
| `appium:locale`                                 | Simulator locale                                    | —              |

## Step 4: Scaffold the WDIO Project

```bash
# Create project directory
mkdir my-mobile-tests && cd my-mobile-tests

# Initialize and install dependencies
npm init -y
npm install --save-dev \
  webdriverio \
  @wdio/cli \
  @wdio/local-runner \
  @wdio/mocha-framework \
  @wdio/spec-reporter \
  @wdio/appium-service \
  @wdio/types \
  tsx \
  typescript \
  @types/mocha

# Generate initial config (optional — prefer handwritten for control)
npx wdio config
```

### Recommended Project Structure

```
my-mobile-tests/
├── wdio.conf.ts                    # Main WDIO config
├── wdio.android.conf.ts            # Android-specific overrides (optional)
├── wdio.ios.conf.ts                # iOS-specific overrides (optional)
├── tsconfig.json
├── package.json
├── .appiumrc.json                  # Appium server config (optional)
├── apps/                           # Test app binaries
│   ├── android/
│   │   └── app-debug.apk
│   └── ios/
│       ├── MyApp.app               # Simulator build
│       └── MyApp.ipa               # Real device build
├── test/
│   ├── pageobjects/                # Page Object classes
│   │   ├── base.page.ts
│   │   ├── login.page.ts
│   │   └── home.page.ts
│   ├── specs/                      # Test specs
│   │   ├── login/
│   │   │   └── login.spec.ts
│   │   └── home/
│   │       └── home.spec.ts
│   └── helpers/                    # Shared utilities
│       ├── gestures.ts
│       ├── contexts.ts
│       └── waits.ts
├── allure-results/                 # Reporter output
└── reports/
```

## Common Setup Failures

| Symptom                                                     | Cause                              | Fix                                                                                     |
| ----------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| `ECONNREFUSED 127.0.0.1:4723`                               | Appium server not running          | Start Appium or add `@wdio/appium-service` to config                                    |
| `Could not find a driver for automationName 'UiAutomator2'` | Driver not installed               | `appium driver install uiautomator2`                                                    |
| `ANDROID_HOME is not set`                                   | Missing env var                    | Add to shell profile and restart terminal                                               |
| `No emulators found`                                        | No AVD created                     | Create via Android Studio AVD Manager or `avdmanager`                                   |
| `xcodebuild failed with code 65`                            | WebDriverAgent build failure (iOS) | Open `WebDriverAgent.xcodeproj` in Xcode, set signing team, build manually once         |
| `iPhone is not available`                                   | Simulator not installed            | `xcodebuild -downloadPlatform iOS`                                                      |
| `Could not determine Xcode version`                         | Xcode not selected                 | `sudo xcode-select -s /Applications/Xcode.app`                                          |
| `Original error: pkg: /data/local/tmp/appium_cache/...`     | Old APK cached on device           | `adb shell pm clear com.your.app` or use `appium:fullReset: true`                       |
| `JAVA_HOME is not set`                                      | Missing Java env var               | Install JDK and add `export JAVA_HOME=$(/usr/libexec/java_home)`                        |
| Port conflicts on parallel runs                             | Multiple sessions sharing ports    | Set unique `appium:systemPort` (Android) and `appium:wdaLocalPort` (iOS) per capability |

## Appium Config File (.appiumrc.json)

Optional but useful for locking server-level settings:

```json
{
  "server": {
    "address": "127.0.0.1",
    "port": 4723,
    "use-drivers": ["uiautomator2", "xcuitest"],
    "use-plugins": [],
    "log-level": "info",
    "log-timestamp": true
  }
}
```

Place in project root. Appium auto-discovers `.appiumrc.json`, `.appiumrc.yaml`, or `appium.config.js`.
