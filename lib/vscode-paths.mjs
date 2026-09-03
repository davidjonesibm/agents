/**
 * Shared VS Code path resolution — used by install.mjs and token-audit.mjs so
 * both agree on where VS Code's per-flavour User directories live.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const FLAVOURS = ['Code', 'Code - Insiders', 'VSCodium'];

/**
 * Locate every installed VS Code flavour's User directory on this machine.
 *
 * Differs per platform (macOS/Windows/Linux); `VSCODE_USER_DIR` overrides
 * detection entirely for a custom location.
 */
export function resolveVsCodeUserDirs() {
  if (process.env.VSCODE_USER_DIR) return [process.env.VSCODE_USER_DIR];

  const home = homedir();
  let base;
  if (process.platform === 'darwin') {
    base = join(home, 'Library', 'Application Support');
  } else if (process.platform === 'win32') {
    base = process.env.APPDATA || join(home, 'AppData', 'Roaming');
  } else {
    base = process.env.XDG_CONFIG_HOME || join(home, '.config');
  }

  return FLAVOURS.map((flavour) => join(base, flavour, 'User')).filter((dir) =>
    existsSync(dir),
  );
}

/**
 * Candidate Copilot Chat session-store DB paths, one per detected VS Code
 * flavour (the store lives at `<User>/globalStorage/github.copilot-chat/session-store.db`).
 */
export function resolveSessionStoreDbPaths() {
  return resolveVsCodeUserDirs().map((userDir) =>
    join(userDir, 'globalStorage', 'github.copilot-chat', 'session-store.db'),
  );
}

/** First session-store DB that actually exists, or null if none do. */
export function findSessionStoreDb() {
  return resolveSessionStoreDbPaths().find((path) => existsSync(path)) ?? null;
}
