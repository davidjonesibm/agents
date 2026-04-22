#!/usr/bin/env bash
# sync.sh — Manual sync helper for consuming repos.
#
# Setup: copy this file into your consuming repo root, then make it executable:
#   chmod +x sync.sh
#
# Usage (run from the root of your consuming repo):
#   ./sync.sh
#
# Reads .copilot-deps.json from the current directory, clones the agent-repo,
# runs sync.mjs, then removes the temporary clone.

set -euo pipefail

TMPDIR_SYNC="/tmp/copilot-agent-sync"

# --- Read source and ref from .copilot-deps.json --------------------------

if [[ ! -f .copilot-deps.json ]]; then
  echo "❌ No .copilot-deps.json found in $(pwd)." >&2
  echo "   Create one based on the agent-repo README before running this script." >&2
  exit 1
fi

SOURCE=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('.copilot-deps.json','utf8')).source)")
REF=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('.copilot-deps.json','utf8')).ref ?? 'main')")

echo "→ Syncing from ${SOURCE}@${REF}"

# --- Clean up any previous temp clone -------------------------------------

rm -rf "$TMPDIR_SYNC"

# --- Clone agent-repo -----------------------------------------------------

git clone --depth 1 --branch "$REF" "https://github.com/${SOURCE}.git" "$TMPDIR_SYNC"

# --- Run sync -------------------------------------------------------------

node "$TMPDIR_SYNC/sync.mjs"

# --- Clean up -------------------------------------------------------------

rm -rf "$TMPDIR_SYNC"

echo ""
echo "✅ Sync complete."
