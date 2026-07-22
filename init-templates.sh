#!/usr/bin/env bash
# init-templates.sh — Thin wrapper that clones agent-repo and runs init-templates.mjs.
#
# Copy this file into any repo. All logic lives in init-templates.mjs in the
# source repo — changes there are picked up automatically on next run without
# needing to update this script.
#
# Setup (one-time):
#   chmod +x init-templates.sh
#
# Usage (run from any repo root):
#   ./init-templates.sh                # scaffold all templates
#   ./init-templates.sh --dry-run      # preview, write nothing
#   ./init-templates.sh --list         # list available templates
#
# Source resolution (first match wins):
#   1. COPILOT_AGENTS_DIR env var (path to local clone — skips git clone)
#   2. COPILOT_AGENTS_SOURCE env var (owner/repo)
#   3. "source" field in ./.copilot-deps.json (if present)
#   4. Default: davidjonesibm/agents
#
# Authentication: uses your existing GitHub SSH key (~/.ssh).

set -euo pipefail

DEFAULT_SOURCE="davidjonesibm/agents"
DEFAULT_REF="main"
TMPDIR_INIT="/tmp/copilot-agent-init-templates"

# --- Resolve source ---------------------------------------------------------

# Option 1: Local clone via env var (skip network)
if [[ -n "${COPILOT_AGENTS_DIR:-}" ]]; then
  if [[ -f "$COPILOT_AGENTS_DIR/init-templates.mjs" ]]; then
    echo "→ Using local agent-repo: $COPILOT_AGENTS_DIR"
    node "$COPILOT_AGENTS_DIR/init-templates.mjs" "$@"
    exit $?
  else
    echo "⚠️  COPILOT_AGENTS_DIR is set but init-templates.mjs not found there" >&2
    exit 1
  fi
fi

# Option 2: Clone from GitHub
SOURCE="${COPILOT_AGENTS_SOURCE:-}"
REF="${COPILOT_AGENTS_REF:-}"

if [[ -z "$SOURCE" && -f .copilot-deps.json ]]; then
  SOURCE=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('.copilot-deps.json','utf8')).source ?? '')" 2>/dev/null || true)
  REF=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('.copilot-deps.json','utf8')).ref ?? '')" 2>/dev/null || true)
fi

SOURCE="${SOURCE:-$DEFAULT_SOURCE}"
REF="${REF:-$DEFAULT_REF}"

# --- Configure SSH auth -----------------------------------------------------

TMPGIT=$(mktemp)

_cleanup() {
  rm -f "$TMPGIT"
  rm -rf "$TMPDIR_INIT"
}
trap _cleanup EXIT

printf '[url "git@github.com:"]\n\tinsteadOf = https://github.com/\n' > "$TMPGIT"
export GIT_CONFIG_GLOBAL="$TMPGIT"

CLONE_URL="git@github.com:${SOURCE}.git"

# --- Clone and run ----------------------------------------------------------

rm -rf "$TMPDIR_INIT"
echo "→ Cloning ${SOURCE}@${REF}…"
git clone --depth 1 --branch "$REF" --filter=blob:none --sparse "$CLONE_URL" "$TMPDIR_INIT" 2>/dev/null
(cd "$TMPDIR_INIT" && git sparse-checkout set instruction-templates init-templates.mjs 2>/dev/null)

if [[ ! -f "$TMPDIR_INIT/init-templates.mjs" ]]; then
  echo "❌ init-templates.mjs not found in ${SOURCE}@${REF}" >&2
  exit 1
fi

export COPILOT_AGENTS_SOURCE="$SOURCE"
export COPILOT_AGENTS_REF="$REF"
node "$TMPDIR_INIT/init-templates.mjs" "$@"
