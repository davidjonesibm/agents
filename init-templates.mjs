#!/usr/bin/env node
/**
 * init-templates.mjs — Scaffold instruction templates into a repo.
 *
 * Copies token-optimized .instructions.md templates into the current repo's
 * .github/ directory. Existing files are never overwritten.
 *
 * Usage (run from any repo root):
 *   node init-templates.mjs                # scaffold all templates
 *   node init-templates.mjs --dry-run      # preview, write nothing
 *   node init-templates.mjs --list         # list available templates
 *
 * Source resolution: this script reads templates from its own directory
 * (instruction-templates/). When invoked via init-templates.sh, that directory
 * is inside the cloned source repo — so consumers always get the latest
 * templates without needing to update the shell wrapper.
 */

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(SCRIPT_DIR, 'instruction-templates');

// ---------------------------------------------------------------------------
// Template map
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    src: 'copilot-instructions.md',
    dest: '.github/copilot-instructions.md',
    desc: 'Always-on project instructions (every request)',
  },
  {
    src: 'testing.instructions.md',
    dest: '.github/instructions/testing.instructions.md',
    desc: 'Testing conventions (scoped to test files)',
  },
  {
    src: 'api.instructions.md',
    dest: '.github/instructions/api.instructions.md',
    desc: 'API patterns (scoped to API/route files)',
  },
  {
    src: 'architecture.instructions.md',
    dest: '.github/instructions/architecture.instructions.md',
    desc: 'Architecture context (scoped to doc files)',
  },
];

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { dryRun: false, list: false };

  for (const arg of argv) {
    switch (arg) {
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--list':
        opts.list = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg} (use --help for usage)`);
        process.exit(1);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
init-templates.mjs — Scaffold instruction templates into a repo.

Usage:
  node init-templates.mjs [options]

Options:
  --dry-run    Preview what would be copied without writing
  --list       List available templates and exit
  -h, --help   Show this help

Templates are copied into .github/ with proper structure. Existing files
are never overwritten — run it safely on repos that already have some
instruction files.
`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function listTemplates() {
  console.log('Available instruction templates:\n');
  for (const t of TEMPLATES) {
    console.log(`  ${t.src.padEnd(35)} → ${t.dest}`);
    console.log(`  ${''.padEnd(35)}   ${t.desc}\n`);
  }
}

function scaffoldTemplates(dryRun) {
  if (!existsSync(TEMPLATE_DIR)) {
    console.error(`❌ instruction-templates/ not found at ${TEMPLATE_DIR}`);
    process.exit(1);
  }

  let added = 0;
  let skipped = 0;

  console.log('');
  if (dryRun) {
    console.log('Mode: DRY RUN (no files written)\n');
  }

  for (const t of TEMPLATES) {
    const srcPath = join(TEMPLATE_DIR, t.src);

    if (!existsSync(srcPath)) {
      console.log(`  ⚠️  Source not found: ${t.src}`);
      continue;
    }

    if (existsSync(t.dest)) {
      console.log(`  – ${t.dest} (already exists, skipped)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  ✅ would create ${t.dest}`);
    } else {
      mkdirSync(dirname(t.dest), { recursive: true });
      cpSync(srcPath, t.dest);
      console.log(`  ✅ ${t.dest}`);
    }
    added++;
  }

  console.log('');

  if (added > 0) {
    // Resolve source for the docs link
    const source = process.env.COPILOT_AGENTS_SOURCE || 'davidjonesibm/agents';
    const ref = process.env.COPILOT_AGENTS_REF || 'main';

    console.log('Next steps:');
    console.log(
      '  1. Open each new file and replace [bracketed placeholders] with your project details',
    );
    console.log(
      "  2. Delete the <!-- comment blocks --> once you've read them (they add tokens)",
    );
    console.log(
      "  3. Commit: git add .github && git commit -m 'chore: add copilot instruction templates'",
    );
    console.log('');
    console.log(
      `See: https://github.com/${source}/blob/${ref}/docs/instruction-templates.md`,
    );
  } else if (skipped > 0) {
    console.log('All templates already exist — nothing to do.');
  }

  console.log('');
  if (dryRun) {
    console.log('✅ Dry run complete.');
  } else {
    console.log('✅ Done.');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));

if (opts.list) {
  listTemplates();
} else {
  scaffoldTemplates(opts.dryRun);
}
