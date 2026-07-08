# WDIO Configuration

Complete `wdio.conf.ts` reference for Appium mobile testing with WebDriverIO v9.

## Canonical Config Template

```typescript
// wdio.conf.ts
import type { Options } from '@wdio/types';

export const config: WebdriverIO.Config = {
  // === Runner ===
  runner: 'local',
  port: 4723,
  path: '/', // Appium 2.x+ uses '/'

  // === Specs ===
  specs: ['./test/specs/**/*.ts'],
  exclude: [],

  // === Capabilities ===
  maxInstances: 1, // mobile: usually 1 per device
  capabilities: [], // see platform-specific sections below

  // === Framework ===
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60_000, // mobile tests need generous timeouts
  },

  // === Services ===
  services: [
    [
      'appium',
      {
        args: {
          log: './logs/appium.log',
        },
        command: 'appium',
      },
    ],
  ],

  // === Reporters ===
  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],

  // === Timeouts ===
  waitforTimeout: 10_000,
  waitforInterval: 500,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  // === Hooks ===
  afterTest: async (test, context, { error, passed }) => {
    if (!passed) {
      await browser.takeScreenshot();
    }
  },
};
```

## Android Capabilities (UiAutomator2)

### Emulator

```typescript
capabilities: [
  {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'Pixel_7_API_34',
    'appium:avd': 'Pixel_7_API_34', // auto-launches this AVD
    'appium:avdLaunchTimeout': 120_000,
    'appium:platformVersion': '14',
    'appium:app': './apps/android/app-debug.apk',
    'appium:noReset': true,
    'appium:newCommandTimeout': 240,
    'appium:autoGrantPermissions': true,
  },
];
```

### Real Device

```typescript
capabilities: [
  {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'Android Device',
    'appium:udid': process.env.ANDROID_UDID, // from `adb devices`
    'appium:app': './apps/android/app-debug.apk',
    'appium:noReset': true,
    'appium:newCommandTimeout': 240,
    'appium:autoGrantPermissions': true,
  },
];
```

### Already-Installed App (No APK)

```typescript
capabilities: [
  {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'emulator-5554',
    'appium:appPackage': 'com.example.myapp',
    'appium:appActivity': 'com.example.myapp.MainActivity',
    'appium:noReset': true,
  },
];
```

## iOS Capabilities (XCUITest)

### Simulator

```typescript
capabilities: [
  {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': 'iPhone 15 Pro',
    'appium:platformVersion': '17.4',
    'appium:app': './apps/ios/MyApp.app', // .app bundle for simulator
    'appium:noReset': true,
    'appium:newCommandTimeout': 240,
  },
];
```

### Real Device

```typescript
capabilities: [
  {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': process.env.IOS_DEVICE_NAME || 'My iPhone',
    'appium:udid': process.env.IOS_UDID,
    'appium:platformVersion': '17.4',
    'appium:app': './apps/ios/MyApp.ipa', // .ipa for real devices
    'appium:xcodeOrgId': process.env.XCODE_ORG_ID,
    'appium:xcodeSigningId': 'iPhone Developer',
    'appium:useNewWDA': false,
    'appium:wdaLocalPort': 8100,
    'appium:noReset': true,
  },
];
```

### Using `appium:options` to Group Capabilities

```typescript
capabilities: [
  {
    platformName: 'iOS',
    'appium:options': {
      automationName: 'XCUITest',
      deviceName: 'iPhone 15 Pro',
      platformVersion: '17.4',
      app: './apps/ios/MyApp.app',
      noReset: true,
    },
  },
];
```

## Multi-Platform Config Pattern

Split configs for platform-specific runs:

```typescript
// wdio.shared.conf.ts — shared base
export const sharedConfig: Partial<WebdriverIO.Config> = {
  runner: 'local',
  port: 4723,
  path: '/',
  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 60_000 },
  services: [['appium', { command: 'appium' }]],
  reporters: ['spec'],
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,
};
```

```typescript
// wdio.android.conf.ts
import { sharedConfig } from './wdio.shared.conf.js';

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  specs: ['./test/specs/**/*.ts'],
  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Pixel_7_API_34',
      'appium:avd': 'Pixel_7_API_34',
      'appium:app': './apps/android/app-debug.apk',
      'appium:noReset': true,
    },
  ],
};
```

```typescript
// wdio.ios.conf.ts
import { sharedConfig } from './wdio.shared.conf.js';

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  specs: ['./test/specs/**/*.ts'],
  capabilities: [
    {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone 15 Pro',
      'appium:platformVersion': '17.4',
      'appium:app': './apps/ios/MyApp.app',
      'appium:noReset': true,
    },
  ],
};
```

```json
// package.json scripts
{
  "scripts": {
    "test:android": "wdio run wdio.android.conf.ts",
    "test:ios": "wdio run wdio.ios.conf.ts",
    "test:all": "npm run test:android && npm run test:ios"
  }
}
```

## TypeScript Setup

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": [
      "node",
      "@wdio/globals/types",
      "@wdio/mocha-framework",
      "@wdio/appium-service"
    ],
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["test/**/*.ts", "wdio*.conf.ts"]
}
```

WDIO v9 auto-detects `tsx` in devDependencies and compiles TypeScript — no additional transpiler config needed.

## Key Capability Explained

| Capability                    | Purpose                                             | Common Mistake                                          |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| `appium:noReset`              | `true` = don't uninstall/reinstall between sessions | Leaving `false` in dev makes iteration painfully slow   |
| `appium:fullReset`            | `true` = full app uninstall/reinstall               | Use only when you need pristine state                   |
| `appium:newCommandTimeout`    | Seconds before Appium kills idle session            | Default 60s is too low for debugging — use 240+         |
| `appium:autoGrantPermissions` | Auto-accept Android permission dialogs              | Only for Android; iOS needs `appium:autoAcceptAlerts`   |
| `appium:avd`                  | Auto-launch an Android emulator by AVD name         | Omit for real devices or pre-booted emulators           |
| `appium:avdLaunchTimeout`     | Max wait (ms) for emulator boot                     | Default too low on slow machines — use 120000+          |
| `appium:wdaLocalPort`         | Port for WebDriverAgent (iOS)                       | Must be unique per parallel iOS session                 |
| `appium:systemPort`           | Port for UiAutomator2 (Android)                     | Must be unique per parallel Android session             |
| `appium:app`                  | Path to `.apk` / `.app` / `.ipa`                    | Use absolute path or path relative to WDIO project root |
