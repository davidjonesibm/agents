# Parallel Execution and CI/CD

Running Appium tests in parallel across devices and integrating with CI/CD pipelines.

## Parallel Execution

### Port Allocation

Each parallel Appium session needs unique ports to avoid conflicts:

| Port                      | Purpose                              | Default | Must Be Unique Per Session |
| ------------------------- | ------------------------------------ | ------- | -------------------------- |
| `appium:systemPort`       | UiAutomator2 communication (Android) | 8200    | Yes                        |
| `appium:wdaLocalPort`     | WebDriverAgent (iOS)                 | 8100    | Yes                        |
| `appium:mjpegServerPort`  | Screenshot streaming                 | 9100    | Yes (if enabled)           |
| `appium:chromedriverPort` | Chromedriver for WebView (Android)   | 9515    | Yes                        |

### Multi-Device Config

```typescript
// wdio.conf.ts — parallel across 2 Android + 2 iOS
export const config: WebdriverIO.Config = {
  maxInstances: 4,

  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'emulator-5554',
      'appium:systemPort': 8200,
      'appium:chromedriverPort': 9515,
      'appium:app': './apps/android/app-debug.apk',
      'appium:noReset': true,
      'wdio:maxInstances': 1,
    },
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'emulator-5556',
      'appium:systemPort': 8201,
      'appium:chromedriverPort': 9516,
      'appium:app': './apps/android/app-debug.apk',
      'appium:noReset': true,
      'wdio:maxInstances': 1,
    },
    {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone 15',
      'appium:platformVersion': '17.4',
      'appium:wdaLocalPort': 8100,
      'appium:app': './apps/ios/MyApp.app',
      'appium:noReset': true,
      'wdio:maxInstances': 1,
    },
    {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone 15 Pro',
      'appium:platformVersion': '17.4',
      'appium:wdaLocalPort': 8101,
      'appium:app': './apps/ios/MyApp.app',
      'appium:noReset': true,
      'wdio:maxInstances': 1,
    },
  ],
};
```

### Dynamic Port Allocation

For flexible parallel runs, compute ports from the worker index:

```typescript
// wdio.conf.ts
const workerIndex = parseInt(process.env.WDIO_WORKER_INDEX || '0', 10);

capabilities: [
  {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:systemPort': 8200 + workerIndex,
    'appium:chromedriverPort': 9515 + workerIndex,
    // ...
  },
];
```

### Test Suites for Organized Runs

```typescript
export const config: WebdriverIO.Config = {
  suites: {
    smoke: ['./test/specs/smoke/**/*.ts'],
    login: ['./test/specs/login/**/*.ts'],
    checkout: ['./test/specs/checkout/**/*.ts'],
    regression: ['./test/specs/**/*.ts'],
  },
};
```

```bash
# Run specific suite
npx wdio run wdio.conf.ts --suite smoke
npx wdio run wdio.conf.ts --suite regression
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/mobile-tests.yml
name: Mobile Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  android-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Create AVD and start emulator
        uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 34
          target: google_apis
          arch: x86_64
          profile: Pixel 7
          script: |
            npm ci
            npm install -g appium
            appium driver install uiautomator2
            npx wdio run wdio.android.conf.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: android-test-results
          path: |
            allure-results/
            reports/
            logs/

  ios-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Appium
        run: |
          npm install -g appium
          appium driver install xcuitest

      - name: Boot iOS Simulator
        run: |
          xcrun simctl boot "iPhone 15 Pro" || true
          xcrun simctl list devices booted

      - name: Run iOS tests
        run: npx wdio run wdio.ios.conf.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ios-test-results
          path: |
            allure-results/
            reports/
            logs/
```

### CI-Specific Config Overrides

```typescript
// wdio.ci.conf.ts
import { config as baseConfig } from './wdio.conf.js';

export const config: WebdriverIO.Config = {
  ...baseConfig,

  // CI-specific overrides
  maxInstances: 1,
  waitforTimeout: 20_000, // more generous on CI
  connectionRetryTimeout: 180_000, // CI emulators are slower

  mochaOpts: {
    ...baseConfig.mochaOpts,
    timeout: 120_000, // CI needs more time
  },

  // CI reporters
  reporters: [
    'spec',
    [
      'junit',
      {
        outputDir: './reports/junit',
        outputFileFormat: ({ cid }) => `results-${cid}.xml`,
      },
    ],
  ],

  // Extra hooks for CI
  afterTest: async (test, context, { error, passed }) => {
    if (!passed) {
      await browser.saveScreenshot(
        `./reports/screenshots/${test.title.replace(/\s/g, '_')}.png`,
      );
    }
  },
};
```

### Headless Emulator for CI

```bash
# Start Android emulator in headless mode (no GUI)
emulator -avd Pixel_7_API_34 -no-window -no-audio -gpu swiftshader_indirect &

# Wait for emulator to fully boot
adb wait-for-device
adb shell getprop sys.boot_completed | grep -m 1 1

# Disable animations (reduces flakiness)
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

## Reporters

### Spec Reporter (Console)

```typescript
reporters: ['spec'];
// Outputs results to console — good for local dev and CI logs
```

### Allure Reporter (HTML Reports)

```bash
npm install --save-dev @wdio/allure-reporter allure-commandline
```

```typescript
reporters: [
  ['allure', {
    outputDir: 'allure-results',
    disableWebdriverScreenshotsReporting: false,
  }],
],
```

```bash
# Generate HTML report
npx allure generate allure-results --clean -o allure-report
npx allure open allure-report
```

### JUnit Reporter (CI Integration)

```bash
npm install --save-dev @wdio/junit-reporter
```

```typescript
reporters: [
  ['junit', {
    outputDir: './reports/junit',
    outputFileFormat: ({ cid }) => `results-${cid}.xml`,
  }],
],
```

## Retry and Stability

```typescript
export const config: WebdriverIO.Config = {
  // Retry failed specs (helpful for flaky mobile tests)
  specFileRetries: 1,
  specFileRetriesDelay: 5, // seconds between retries
  specFileRetriesDeferred: true, // retry after all specs run

  // Bail after N failures (0 = don't bail)
  bail: 0,
};
```

## Best Practices for CI

| Practice                                        | Why                                      |
| ----------------------------------------------- | ---------------------------------------- |
| Disable device animations                       | Reduces flakiness from animation timing  |
| Use headless emulators                          | No GUI needed on CI servers              |
| Pin emulator/simulator images                   | Reproducible across CI runs              |
| Set generous timeouts                           | CI environments are slower               |
| Screenshot + page source on failure             | Essential for debugging CI-only failures |
| Use JUnit reporter                              | Most CI tools parse JUnit XML natively   |
| Cache Appium + driver installs                  | Speeds up CI pipeline significantly      |
| Run smoke suite on PRs, full regression on main | Balances speed vs coverage               |
| Never use `browser.pause()`                     | Absolute flakiness amplifier on CI       |

## Cross-Reference

- For port conflict debugging, see `references/debugging.md`.
- For capability configuration, see `references/configuration.md`.
