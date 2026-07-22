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
#
# Authentication: uses your existing GitHub SSH key (~/.ssh).

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

# --- Configure SSH auth ----------------------------------------------------

TMPGIT=$(mktemp)

_cleanup() {
  rm -f "$TMPGIT"
  rm -rf "$TMPDIR_SYNC"
}
trap _cleanup EXIT

printf '[url "git@github.com:"]\n\tinsteadOf = https://github.com/\n' > "$TMPGIT"
export GIT_CONFIG_GLOBAL="$TMPGIT"

CLONE_URL="git@github.com:${SOURCE}.git"

# --- Clone agent-repo -----------------------------------------------------

rm -rf "$TMPDIR_SYNC"
git clone --depth 1 --branch "$REF" "$CLONE_URL" "$TMPDIR_SYNC"

# --- Run sync (pass clone path so sync.mjs skips redundant clone) ----------

COPILOT_SYNC_SOURCE_DIR="$TMPDIR_SYNC" node "$TMPDIR_SYNC/sync.mjs"

echo ""
echo "✅ Sync complete."
