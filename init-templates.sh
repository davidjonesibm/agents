#!/usr/bin/env bash
# init-templates.sh — Scaffold instruction templates into a repo.
#
# Copies token-optimized .instructions.md templates into the current repo's
# .github/ directory. Existing files are never overwritten.
#
# This is a standalone script — it does NOT require agents/skills to be
# synced or installed. Use it alongside a global install (install.mjs) to
# get instruction templates into each new repo.
#
# Setup (one-time):
#   chmod +x init-templates.sh
#   # Optionally copy to ~/bin or somewhere on your PATH
#
# Usage (run from any repo root):
#   ./init-templates.sh                # scaffold all templates
#   ./init-templates.sh --dry-run      # preview, write nothing
#   ./init-templates.sh --list         # list available templates
#
# Source resolution (first match wins):
#   1. COPILOT_AGENTS_SOURCE env var (owner/repo)
#   2. "source" field in ./.copilot-deps.json (if present)
#   3. A local clone at COPILOT_AGENTS_DIR (skips git clone)
#   4. Default: davidjonesibm/agents
#
# Authentication: uses your existing GitHub SSH key (~/.ssh).

set -euo pipefail

DEFAULT_SOURCE="davidjonesibm/agents"
DEFAULT_REF="main"

# --- Arg parsing -----------------------------------------------------------

DRY_RUN=false
LIST_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY_RUN=true ;;
    --list)     LIST_ONLY=true ;;
    --help|-h)
      cat <<'EOF'
init-templates.sh — Scaffold instruction templates into a repo.

Usage:
  init-templates.sh [options]

Options:
  --dry-run    Preview what would be copied without writing
  --list       List available templates and exit
  -h, --help   Show this help

Environment:
  COPILOT_AGENTS_DIR      Path to a local agent-repo clone (skips git clone)
  COPILOT_AGENTS_SOURCE   GitHub owner/repo override (default: davidjonesibm/agents)
  COPILOT_AGENTS_REF      Branch/tag override (default: main)

Templates are copied into .github/ with proper structure. Existing files
are never overwritten — run it safely on repos that already have some
instruction files.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg (use --help for usage)" >&2
      exit 1
      ;;
  esac
done

# --- Template map -----------------------------------------------------------

# Each entry: "source_filename|destination_path|description"
TEMPLATES=(
  "copilot-instructions.md|.github/copilot-instructions.md|Always-on project instructions (every request)"
  "testing.instructions.md|.github/instructions/testing.instructions.md|Testing conventions (scoped to test files)"
  "api.instructions.md|.github/instructions/api.instructions.md|API patterns (scoped to API/route files)"
  "architecture.instructions.md|.github/instructions/architecture.instructions.md|Architecture context (scoped to doc files)"
)

if $LIST_ONLY; then
  echo "Available instruction templates:"
  echo ""
  for entry in "${TEMPLATES[@]}"; do
    IFS='|' read -r src dest desc <<< "$entry"
    printf "  %-35s → %s\n" "$src" "$dest"
    printf "  %-35s   %s\n" "" "$desc"
    echo ""
  done
  exit 0
fi

# --- Resolve template source ------------------------------------------------

TEMPLATE_DIR=""

# Option 1: Local clone via env var
if [[ -n "${COPILOT_AGENTS_DIR:-}" ]]; then
  if [[ -d "$COPILOT_AGENTS_DIR/instruction-templates" ]]; then
    TEMPLATE_DIR="$COPILOT_AGENTS_DIR/instruction-templates"
    echo "→ Using local agent-repo: $COPILOT_AGENTS_DIR"
  else
    echo "⚠️  COPILOT_AGENTS_DIR is set but instruction-templates/ not found there" >&2
    exit 1
  fi
fi

# Option 2: Clone from GitHub
if [[ -z "$TEMPLATE_DIR" ]]; then
  SOURCE="${COPILOT_AGENTS_SOURCE:-}"
  REF="${COPILOT_AGENTS_REF:-}"

  if [[ -z "$SOURCE" && -f .copilot-deps.json ]]; then
    SOURCE=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('.copilot-deps.json','utf8')).source ?? '')" 2>/dev/null || true)
    REF=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('.copilot-deps.json','utf8')).ref ?? '')" 2>/dev/null || true)
  fi

  SOURCE="${SOURCE:-$DEFAULT_SOURCE}"
  REF="${REF:-$DEFAULT_REF}"

  TMPDIR_CLONE=$(mktemp -d)

  _cleanup() {
    rm -rf "$TMPDIR_CLONE"
  }
  trap _cleanup EXIT

  # Configure SSH auth
  TMPGIT=$(mktemp)
  printf '[url "git@github.com:"]\n\tinsteadOf = https://github.com/\n' > "$TMPGIT"
  export GIT_CONFIG_GLOBAL="$TMPGIT"

  CLONE_URL="git@github.com:${SOURCE}.git"

  echo "→ Cloning ${SOURCE}@${REF} (sparse: instruction-templates only)…"
  git clone --depth 1 --branch "$REF" --filter=blob:none --sparse "$CLONE_URL" "$TMPDIR_CLONE" 2>/dev/null
  (cd "$TMPDIR_CLONE" && git sparse-checkout set instruction-templates 2>/dev/null)

  rm -f "$TMPGIT"

  if [[ ! -d "$TMPDIR_CLONE/instruction-templates" ]]; then
    echo "❌ instruction-templates/ not found in ${SOURCE}@${REF}" >&2
    exit 1
  fi

  TEMPLATE_DIR="$TMPDIR_CLONE/instruction-templates"
fi

# --- Copy templates ---------------------------------------------------------

ADDED=0
SKIPPED=0

echo ""
if $DRY_RUN; then
  echo "Mode: DRY RUN (no files written)"
  echo ""
fi

for entry in "${TEMPLATES[@]}"; do
  IFS='|' read -r src dest desc <<< "$entry"
  src_path="$TEMPLATE_DIR/$src"

  if [[ ! -f "$src_path" ]]; then
    echo "  ⚠️  Source not found: $src"
    continue
  fi

  if [[ -f "$dest" ]]; then
    echo "  – $dest (already exists, skipped)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if $DRY_RUN; then
    echo "  ✅ would create $dest"
  else
    mkdir -p "$(dirname "$dest")"
    cp "$src_path" "$dest"
    echo "  ✅ $dest"
  fi
  ADDED=$((ADDED + 1))
done

echo ""

if [[ $ADDED -gt 0 ]]; then
  echo "Next steps:"
  echo "  1. Open each new file and replace [bracketed placeholders] with your project details"
  echo "  2. Delete the <!-- comment blocks --> once you've read them (they add tokens)"
  echo "  3. Commit: git add .github && git commit -m 'chore: add copilot instruction templates'"
  echo ""
  echo "See: https://github.com/${SOURCE:-$DEFAULT_SOURCE}/blob/${REF:-$DEFAULT_REF}/docs/instruction-templates.md"
elif [[ $SKIPPED -gt 0 ]]; then
  echo "All templates already exist — nothing to do."
fi

echo ""
if $DRY_RUN; then
  echo "✅ Dry run complete."
else
  echo "✅ Done."
fi
