---
name: appium-wdio-pro
description: >-
  Comprehensively builds, reviews, and debugs Appium + WebDriverIO mobile test suites
  for iOS and Android. Covers environment setup (appium-installer), WDIO v9 configuration,
  capabilities (UiAutomator2, XCUITest), Page Object Model, element selectors, gestures,
  WebView contexts, parallel execution, Appium Inspector usage, debugging strategies,
  log analysis, and CI/CD integration. USE WHEN scaffolding a new Appium/WDIO project,
  writing or reviewing mobile test code, debugging test failures, configuring capabilities,
  or troubleshooting environment issues. Trigger keywords: Appium, WebDriverIO, WDIO,
  mobile testing, UiAutomator2, XCUITest, appium-installer, Appium Inspector, mobile
  automation, iOS testing, Android testing, emulator, simulator, capabilities, mobile
  gestures, hybrid app testing. DO NOT USE FOR: Playwright mobile, Detox, Espresso-only
  (without Appium), XCTest-only (without Appium), or browser-only Selenium/WDIO testing.
---

Build, review, and debug Appium + WebDriverIO mobile test suites with expert-level guidance on environment setup, test architecture, and troubleshooting.

## Skill Modes

This skill operates in two modes depending on context:

### Mode A: Scaffold a New Suite

When the user wants to create a new Appium/WDIO project from scratch:

1. **Environment check** — prompt the user to run `npx appium-installer` and confirm their environment is healthy. See `references/setup.md` for the full installation and validation flow.
2. **Gather requirements** — ask the user: target platforms (Android/iOS/both), real devices or emulators, app type (native/hybrid/web-on-mobile), test framework (Mocha/Jasmine/Cucumber), TypeScript or JavaScript.
3. **Scaffold the project** — generate `wdio.conf.ts`, `tsconfig.json`, `package.json` scripts, Page Object base classes, helper utilities, and directory structure. See `references/configuration.md` for the canonical config template.
4. **Generate sample tests** — create one working spec per platform with proper selectors and waits.
5. **Provide run instructions** — include commands to start Appium, launch emulators/simulators, and run tests.

### Mode B: Review / Debug Existing Suite

When the user has existing Appium/WDIO test code:

1. Check environment and configuration using `references/setup.md` and `references/configuration.md`.
2. Validate element selectors and Page Object patterns using `references/selectors-and-patterns.md`.
3. Review gestures, scrolling, and mobile-specific commands using `references/gestures-and-commands.md`.
4. Check WebView context handling using `references/hybrid-and-webview.md`.
5. Diagnose test failures and flakiness using `references/debugging.md`.
6. Validate parallel execution and CI/CD setup using `references/parallel-and-ci.md`.

If doing a partial review, load only the relevant reference files.

## Core Instructions

- Target **Appium 3.x** (latest) with **WebDriverIO v9**.
- Always use **`appium:` vendor prefix** on all Appium-specific capabilities.
- Always prefer **accessibility ID selectors** (`~`) over XPath — XPath is slow and brittle on mobile.
- Always use **explicit waits** (`waitForDisplayed`, `waitForEnabled`, `waitUntil`) — never `browser.pause()` in committed tests.
- Always use the **Page Object Model** — no raw selectors in spec files.
- Always configure **`@wdio/appium-service`** to auto-manage the Appium server lifecycle.
- Always set **`appium:noReset: true`** during development to speed up iteration (skip app reinstall).
- Always use **W3C Actions API** for gestures — `touchPerform` / `multiTouchPerform` are deprecated.
- Always use **`driver.getAppiumContexts()`** / **`driver.switchAppiumContext()`** for WebView — legacy `getContexts()` / `setContext()` are deprecated in WDIO v9.
- Never hardcode device serial numbers or UDIDs in committed config — use environment variables or separate config files.
- Never use `--relaxedSecurity` in production/CI — only for local development when needed.

## Output Format

### For scaffolding (Mode A):

Deliver files in this order:

1. Environment setup commands and validation steps
2. `package.json` with all dependencies
3. `wdio.conf.ts` with complete configuration
4. `tsconfig.json`
5. Page Object base classes and helpers
6. Sample spec files
7. Run instructions and troubleshooting tips

### For review/debug (Mode B):

Organize findings by file. For each issue:

1. State the file and relevant line(s).
2. Name the rule or best practice being violated.
3. Show a brief before/after code fix.
4. For debugging issues, include diagnostic steps and expected output.

Skip files with no issues. End with a prioritized summary.
