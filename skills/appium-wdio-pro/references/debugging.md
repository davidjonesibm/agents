# Debugging

Expert-level guidance for diagnosing and fixing Appium/WDIO test failures. Appium has many moving parts — Appium server, driver, device, app, WDIO — and failures can originate from any layer.

## Debugging Workflow

When a test fails, diagnose in this order:

1. **Read the WDIO error message** — it usually points to the right layer
2. **Check Appium server logs** — detailed command-level trace
3. **Use Appium Inspector** — visually verify element tree
4. **Check device/emulator state** — app crashed? screen locked? dialog blocking?
5. **Isolate the test** — run it alone to rule out test interaction

## Appium Inspector

Appium Inspector is a GUI tool for visually inspecting your app's element tree. It's the single most important debugging tool for Appium.

### Installation

Two options:

1. **Desktop app** — download from [GitHub Releases](https://github.com/appium/appium-inspector/releases) (macOS/Windows/Linux)
2. **Appium plugin** — `appium plugin install appium-inspector` then access via browser at `http://localhost:4723/inspector`

### Starting an Inspector Session

1. **Start Appium server** (if not using the plugin): `appium server --port 4723`
2. Open Appium Inspector
3. Set remote host: `127.0.0.1`, port: `4723`, path: `/`
4. Enter your desired capabilities as JSON:

```json
{
  "platformName": "Android",
  "appium:automationName": "UiAutomator2",
  "appium:deviceName": "emulator-5554",
  "appium:app": "/absolute/path/to/app.apk",
  "appium:noReset": true
}
```

5. Click "Start Session"

### What to Use Inspector For

| Task                         | How                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Find element selectors**   | Tap elements in the screenshot to see all available attributes (accessibility id, resource-id, text, class) |
| **Verify element hierarchy** | Browse the source tree to understand parent-child relationships                                             |
| **Test selectors live**      | Use the search bar to test selector strategies before putting them in code                                  |
| **Record actions**           | Use the recorder to generate boilerplate code (then refactor into Page Objects)                             |
| **Debug invisible elements** | Check if elements exist in the tree but aren't visible (scroll needed?)                                     |
| **Inspect WebView content**  | Switch contexts in Inspector to see web elements                                                            |

### Inspector Tips

- **Refresh source** frequently — the element tree is a snapshot, not live
- **Use the "Search for element" feature** to validate selectors before coding
- **Copy the XPath** from Inspector only as a starting point — then convert to accessibility ID or native strategy
- **Check `contentDescription`** (Android) / `accessibilityIdentifier` (iOS) columns — these are your accessibility IDs
- The Inspector session **blocks your WDIO session** — only one session per device at a time
- Use a **separate device/emulator** for Inspector vs test runs, or stop WDIO first

## Headed Mode (Watching Tests Run)

To visually see what your tests are doing:

### Android Emulator

- Emulators display on screen by default
- Use `emulator -avd <name>` to launch (not headless)
- To force UI display: remove `-no-window` flag if present

### iOS Simulator

- Simulators display on screen by default via Simulator.app
- Use `xcrun simctl boot "iPhone 15 Pro"` then open Simulator.app

### Slow Down Test Execution

```typescript
// Add delays between commands for visual debugging (development only!)
afterCommand: async (commandName) => {
  if (process.env.SLOW_MODE) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
},
```

### Screen Recording

```typescript
// Record video of test execution
before: async () => {
  await driver.startRecordingScreen();
},
afterTest: async (test, context, { passed }) => {
  const video = await driver.stopRecordingScreen();
  if (!passed) {
    // Save video for failed tests
    const fs = await import('fs');
    fs.writeFileSync(
      `./reports/videos/${test.title}.mp4`,
      video,
      'base64',
    );
  }
},
```

## Appium Server Logs

### Where Logs Live

| Setup                                 | Log Location                                                   |
| ------------------------------------- | -------------------------------------------------------------- |
| `@wdio/appium-service` with `log` arg | Path specified in config: `args: { log: './logs/appium.log' }` |
| Manual Appium start                   | `appium server --log ./appium.log`                             |
| Default (no log file)                 | stdout in the terminal running Appium                          |

### How to Read Appium Logs

Appium logs are verbose. Key patterns to search for:

```
# Session creation — shows resolved capabilities
[Appium] Creating new AndroidUiautomator2Driver session
[Appium] Capabilities: { ... }

# Command execution — every WebDriver command logged
[HTTP] --> POST /session/abc123/element
[HTTP] --> {"using":"accessibility id","value":"login-button"}
[HTTP] <-- POST /session/abc123/element 200

# Element not found — the most common failure
[HTTP] <-- POST /session/abc123/element 404
[W3C] Matched W3C error code 'no such element'

# App crash
[UiAutomator2] Unexpected termination of the app

# Timeout
[W3C] Matched W3C error code 'timeout'
```

### Filtering Logs for Debugging

```bash
# Show only errors
grep -i "error\|exception\|failed\|crash" appium.log

# Show element find attempts
grep "element" appium.log | grep -i "POST\|404\|200"

# Show session lifecycle
grep -i "session\|creating\|deleting" appium.log

# Show capability resolution
grep -i "capabilities\|Capabilities" appium.log
```

### Log Levels

```bash
# Verbose (everything) — use for deep debugging
appium server --log-level debug

# Normal
appium server --log-level info

# Quiet
appium server --log-level warn
```

Or in `.appiumrc.json`:

```json
{
  "server": {
    "log-level": "debug",
    "log-timestamp": true,
    "log": "./logs/appium.log"
  }
}
```

## WDIO-Level Debugging

### Screenshot on Failure

```typescript
// wdio.conf.ts — auto-capture screenshots
afterTest: async (test, context, { error, passed }) => {
  if (!passed) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await browser.saveScreenshot(`./reports/screenshots/${timestamp}-${test.title}.png`);
  }
},
```

### Page Source Dump

```typescript
// Dump the full element tree when debugging
afterTest: async (test, context, { passed }) => {
  if (!passed) {
    const source = await browser.getPageSource();
    const fs = await import('fs');
    fs.writeFileSync(`./reports/source-${test.title}.xml`, source);
  }
},
```

### WDIO Debug Command

```typescript
// Pause test execution and open a REPL for interactive debugging
it('debug session', async () => {
  await $('~some-element').click();
  await browser.debug(); // Opens REPL — type commands interactively
  // Test resumes when you type .exit in the REPL
});
```

Run with: `npx wdio run wdio.conf.ts --spec ./test/specs/mytest.spec.ts`

**Note:** Increase Mocha timeout when using `debug()`: `mochaOpts: { timeout: 600_000 }`

## Common Failures and Fixes

### Element Not Found

| Symptom                           | Likely Cause                              | Fix                                                      |
| --------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `no such element`                 | Wrong selector                            | Use Appium Inspector to find correct attribute           |
| Element exists but not found      | Element not in viewport                   | Scroll first (see `references/gestures-and-commands.md`) |
| Element found intermittently      | Race condition — element not yet rendered | Add `waitForDisplayed()` before interaction              |
| Works in Inspector, fails in test | Timing — test is faster than Inspector    | Increase wait timeout                                    |

### Session Failures

| Symptom                                            | Likely Cause                                    | Fix                                                                 |
| -------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| `Could not create session`                         | Capabilities wrong or device not available      | Check caps, verify device with `adb devices` or `xcrun simctl list` |
| `ECONNREFUSED`                                     | Appium not running                              | Add `@wdio/appium-service` or start Appium manually                 |
| `Session not created: Chrome version must be >= X` | Chromedriver version mismatch (WebView testing) | Set `'appium:chromedriverAutodownload': true`                       |
| `xcodebuild failed with code 65`                   | WebDriverAgent signing error                    | Open WDA project in Xcode, configure signing                        |
| Session starts but app doesn't launch              | `appium:app` path wrong or app not installed    | Verify path, use absolute path                                      |

### Flaky Tests

| Pattern                      | Cause                                | Fix                                                             |
| ---------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| Passes alone, fails in suite | Shared state between tests           | Use `appium:fullReset` or clean state in `beforeEach`           |
| Fails on CI, passes locally  | Device/emulator differences, timing  | Increase timeouts, use explicit waits, match CI device to local |
| Fails intermittently         | Animation or transition not complete | Wait for stable state, not just element presence                |
| Fails after app update       | Element attributes changed           | Re-inspect with Appium Inspector, update selectors              |

### Android-Specific

| Symptom                              | Fix                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `INSTALL_FAILED_ALREADY_EXISTS`      | Add `'appium:fullReset': true` or `adb uninstall com.your.app`                                             |
| Permission dialog blocks test        | Add `'appium:autoGrantPermissions': true`                                                                  |
| Toast message can't be found         | Toasts aren't in the element tree — use `driver.getPageSource()` and grep, or use the `appium-wait-plugin` |
| System dialog ("App not responding") | Add `'appium:disableWindowAnimation': true` and handle ANR dialog                                          |

### iOS-Specific

| Symptom                               | Fix                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Alert blocks test                     | Add `'appium:autoAcceptAlerts': true` or handle with `driver.acceptAlert()` |
| `WebDriverAgentRunner` fails to build | Open in Xcode, set signing team, build once manually                        |
| Simulator takes too long to boot      | Increase `connectionRetryTimeout` to 180000+                                |
| Keyboard covers input field           | Use `driver.hideKeyboard()` before scrolling/tapping elsewhere              |
| `wdaLocalPort` conflict               | Each parallel iOS session needs a unique `appium:wdaLocalPort`              |

## Debugging Checklist

When stuck, work through this systematically:

- [ ] Is Appium server running? (`appium server --port 4723`)
- [ ] Are correct drivers installed? (`appium driver list --installed`)
- [ ] Is the device/emulator visible? (`adb devices` / `xcrun simctl list booted`)
- [ ] Is the app path correct and file exists?
- [ ] Do capabilities match the target device/platform?
- [ ] Is there a port conflict? (check `appium:systemPort` / `appium:wdaLocalPort`)
- [ ] Can Appium Inspector connect with the same capabilities?
- [ ] Is the element actually present? (check page source)
- [ ] Is there a dialog, alert, or permission prompt blocking?
- [ ] Are you in the correct context? (native vs webview)

## Sensitive Data in Logs

Use Appium's log filter to redact sensitive data:

```json
// log-filter.json
[
  {
    "pattern": "(password|token|secret)=\\w+",
    "flags": "i",
    "replacer": "$1=**REDACTED**"
  }
]
```

```bash
appium server --log-filters /path/to/log-filter.json
```

## Cross-Reference

- For environment validation, see `references/setup.md`.
- For capability configuration, see `references/configuration.md`.
- For gesture debugging, see `references/gestures-and-commands.md`.
