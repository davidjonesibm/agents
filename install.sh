#!/usr/bin/env bash
# install.sh — Global installer wrapper for team members.
#
# Clones the agent source repo, runs install.mjs to install ALL agents and
# skills into your home directory (~/.copilot and/or ~/.claude), then removes
# the temporary clone. Run this whenever an agent/skill update is announced.
#
# Setup (one-time):
#   chmod +x install.sh
#
# Usage (run from anywhere):
#   ./install.sh                          # install copilot target
#   ./install.sh --targets copilot,claude # also install for Claude Code
#   ./install.sh --dry-run                # preview only
#   ./install.sh --skills-only            # skills only
#
# Any arguments are passed straight through to install.mjs.
#
# Source resolution (first match wins):
#   1. COPILOT_AGENTS_SOURCE env var (owner/repo)
#   2. "source" field in ./.copilot-deps.json
#   3. Default below
#
# Authentication: uses your existing GitHub SSH key (~/.ssh).

set -euo pipefail

DEFAULT_SOURCE="davidjonesibm/agents"
DEFAULT_REF="main"
TMPDIR_INSTALL="/tmp/copilot-agent-install"

# --- Resolve source and ref ------------------------------------------------

SOURCE="${COPILOT_AGENTS_SOURCE:-}"
REF="${COPILOT_AGENTS_REF:-}"

if [[ -z "$SOURCE" && -f .copilot-deps.json ]]; then
  SOURCE=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('.copilot-deps.json','utf8')).source ?? '')" 2>/dev/null || true)
  REF=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('.copilot-deps.json','utf8')).ref ?? '')" 2>/dev/null || true)
fi

SOURCE="${SOURCE:-$DEFAULT_SOURCE}"
REF="${REF:-$DEFAULT_REF}"

echo "→ Installing from ${SOURCE}@${REF}"

# --- Configure SSH auth ----------------------------------------------------

TMPGIT=$(mktemp)

_cleanup() {
  rm -f "$TMPGIT"
  rm -rf "$TMPDIR_INSTALL"
}
trap _cleanup EXIT

printf '[url "git@github.com:"]\n\tinsteadOf = https://github.com/\n' > "$TMPGIT"
export GIT_CONFIG_GLOBAL="$TMPGIT"

CLONE_URL="git@github.com:${SOURCE}.git"

# --- Clone and install -----------------------------------------------------

rm -rf "$TMPDIR_INSTALL"
git clone --depth 1 --branch "$REF" "$CLONE_URL" "$TMPDIR_INSTALL"

node "$TMPDIR_INSTALL/install.mjs" "$@"

echo ""
echo "✅ Global install complete."
