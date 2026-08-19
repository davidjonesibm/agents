#!/usr/bin/env node
/**
 * install.mjs — Global installer for agents and skills.
 *
 * Installs ALL agents and ALL skills from this repo into user-level
 * (home directory) locations so they are available across every workspace,
 * without per-repo syncing.
 *
 * Supported targets (opt in/out with --targets):
 *   copilot → ~/.copilot (GitHub Copilot in VS Code + Copilot CLI) — agents + skills
 *   claude  → ~/.claude  (Claude Code; also discovered by VS Code) — skills only
 *
 * Agents are authored in Copilot `.agent.md` format and only install to the
 * copilot target. Skills follow the portable Agent Skills standard and install
 * to every selected target.
 *
 * Source of truth: the directory this script lives in. It reads:
 *   agents/*.agent.md              → all agents
 *   .github/agents/*.agent.md      → all agents (legacy location)
 *   skills/<name>/                 → all skills
 *   .github/skills/<name>/         → all skills (legacy location)
 *   global-instructions/*.md       → user-level instructions (VS Code prompts dir)
 *
 * Global instructions are machine-wide behaviour rules (applyTo: '**') and install
 * to the VS Code user prompts folder, not ~/.copilot. They apply in every workspace.
 *
 * What is NOT installed globally (stays per-repo by design):
 *   - .github/copilot-instructions.md   (project-specific)
 *   - instruction-templates/*           (path-scoped scaffolding for repos)
 *   - the local-routing scaffold skill  (customized per repo)
 *
 * Safety: a manifest (.agent-repo-manifest.json) is written at each target
 * root recording exactly what this script installed. Pruning only removes
 * items listed in that manifest — your own personal agents/skills are never
 * touched.
 *
 * Usage (from anywhere):
 *   node install.mjs                      # install copilot target
 *   node install.mjs --targets copilot,claude
 *   node install.mjs --skills-only
 *   node install.mjs --agents-only
 *   node install.mjs --no-instructions    # skip global instructions
 *   node install.mjs --dry-run            # preview, write nothing
 *   node install.mjs --no-prune           # keep stale items
 *   COPILOT_HOME=/custom node install.mjs # override copilot home
 *   VSCODE_USER_DIR=/custom node install.mjs # override VS Code user dir
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const MANIFEST_NAME = '.agent-repo-manifest.json';

// ---------------------------------------------------------------------------
// Target definitions
// ---------------------------------------------------------------------------

/**
 * A target describes where agents and skills are installed for a given tool.
 *
 * `supportsAgents` gates agent installation. Agents are authored in Copilot
 * `.agent.md` format (YAML-array `tools`, `handoffs`, subagent `agents` lists,
 * VS Code tool names) which does NOT map cleanly to Claude's sub-agent format.
 * Skills, by contrast, follow the open Agent Skills standard (agentskills.io)
 * and are portable, so they install to every target.
 *
 * `agentExt` controls the on-disk agent filename extension for targets that
 * support agents (copilot uses `.agent.md`).
 */
function buildTargets() {
  return {
    copilot: {
      label: 'GitHub Copilot (VS Code + Copilot CLI)',
      home: process.env.COPILOT_HOME || join(homedir(), '.copilot'),
      supportsAgents: true,
      agentExt: '.agent.md',
    },
    claude: {
      label: 'Claude (Claude Code + VS Code) — skills only',
      home: join(homedir(), '.claude'),
      supportsAgents: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    targets: ['copilot'],
    agents: true,
    skills: true,
    instructions: true,
    prune: true,
    dryRun: false,
    includeAgents: [],
    includeSkills: [],
    excludeAgents: [],
    excludeSkills: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--targets': {
        const value = argv[++i];
        if (!value) die('--targets requires a value (e.g. copilot,claude)');
        opts.targets = value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        break;
      }
      case '--include-skills': {
        const value = argv[++i];
        if (!value) die('--include-skills requires a comma-separated list');
        opts.includeSkills = splitList(value);
        break;
      }
      case '--include-agents': {
        const value = argv[++i];
        if (!value) die('--include-agents requires a comma-separated list');
        opts.includeAgents = splitList(value);
        break;
      }
      case '--exclude-skills': {
        const value = argv[++i];
        if (!value) die('--exclude-skills requires a comma-separated list');
        opts.excludeSkills = splitList(value);
        break;
      }
      case '--exclude-agents': {
        const value = argv[++i];
        if (!value) die('--exclude-agents requires a comma-separated list');
        opts.excludeAgents = splitList(value);
        break;
      }
      case '--agents-only':
        opts.skills = false;
        opts.instructions = false;
        break;
      case '--skills-only':
        opts.agents = false;
        opts.instructions = false;
        break;
      case '--no-instructions':
        opts.instructions = false;
        break;
      case '--no-prune':
        opts.prune = false;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        die(`Unknown argument: ${arg}\nRun with --help for usage.`);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
install.mjs — install all agents and skills to your home directory.

Usage:
  node install.mjs [options]

Options:
  --targets <list>          Comma-separated: copilot, claude (default: copilot)
  --agents-only             Install agents only
  --skills-only             Install skills only
  --no-instructions         Skip global instructions
  --include-skills <list>   Install ONLY these skills (empty = all)
  --include-agents <list>   Install ONLY these agents (empty = all)
  --exclude-skills <list>   Skills to skip (applied after include)
  --exclude-agents <list>   Agents to skip (applied after include)
  --no-prune                Do not remove previously installed items that are gone
  --dry-run                 Show what would change without writing
  -h, --help                Show this help

Global instructions:
  Files in global-instructions/ install to the VS Code user prompts folder and
  apply in EVERY workspace. This is separate from instruction-templates/, which
  is per-repo scaffolding copied by init-templates.sh.

Selection rules:
  An EMPTY include list means "install everything" — that is the default.
  A non-empty include list is an allowlist: only those items install.
  Exclude is applied afterwards, so you can take a profile minus one item.
  Anything not selected is PRUNED from the target on the next install.

Config file (optional):
  install.config.json, merged with (and overridden by) flags. First match wins:
    1. <this repo>/install.config.json      (local clone — gitignored)
    2. ~/.copilot/install.config.json       (persists across install.sh runs)

    { "includeSkills": ["dotnet-server", "xunit-v3-pro"], "excludeAgents": [] }

  Copy install.config.example.json — it ships with dotnet/web/mobile profiles.
  install.sh users must use location 2 — it clones to a temp dir and deletes it.

Environment:
  COPILOT_HOME       Override the copilot target home (default: ~/.copilot)
  VSCODE_USER_DIR    Override the VS Code User dir (where prompts/ lives)
`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function splitList(value) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Merge include/exclude lists from install.config.json with CLI flags (flags win).
 *
 * Checked in order, first match wins. The home-directory location exists because
 * install.sh clones this repo to a temp dir and deletes it afterwards, so a config
 * living next to the script would not survive for wrapper users.
 */
function applyConfigFile(opts) {
  const candidates = [
    join(SCRIPT_DIR, 'install.config.json'),
    join(homedir(), '.copilot', 'install.config.json'),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) return opts;

  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    die(`${path} is not valid JSON.`);
  }
  const keys = [
    'includeSkills',
    'includeAgents',
    'excludeSkills',
    'excludeAgents',
  ];
  for (const key of keys) {
    if (opts[key].length === 0 && Array.isArray(data[key])) {
      opts[key] = data[key].filter((v) => typeof v === 'string');
    }
  }
  opts.configPath = path;
  return opts;
}

/**
 * Apply allowlist then denylist. An empty `include` means "install everything",
 * so the default behaviour is unchanged for anyone without a config file.
 *
 * Unknown names are reported rather than ignored silently — a typo in an allowlist
 * would otherwise quietly drop a skill you meant to install.
 */
function selectItems(all, include, exclude, kind) {
  const known = new Set(all.map((item) => item.name));
  for (const name of [...include, ...exclude]) {
    if (!known.has(name)) {
      console.log(`⚠️  Unknown ${kind} "${name}" in config — ignored`);
    }
  }
  const allowed = include.length
    ? all.filter((item) => include.includes(item.name))
    : all;
  return allowed.filter((item) => !exclude.includes(item.name));
}

function listFiles(dir, filter) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => {
    if (filter && !filter(f)) return false;
    return statSync(join(dir, f)).isFile();
  });
}

function listDirectories(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory());
}

/** Read all files in a directory recursively into a Map of relPath→Buffer. */
function snapshotDir(dir) {
  const map = new Map();
  if (!existsSync(dir)) return map;
  const walk = (base, rel) => {
    for (const entry of readdirSync(base)) {
      const abs = join(base, entry);
      const relPath = rel ? join(rel, entry) : entry;
      if (statSync(abs).isDirectory()) walk(abs, relPath);
      else map.set(relPath, readFileSync(abs));
    }
  };
  walk(dir, '');
  return map;
}

function snapshotsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [key, val] of a) {
    const other = b.get(key);
    if (!other || !val.equals(other)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Source discovery
// ---------------------------------------------------------------------------

const SKILL_LOCATIONS = [join('.github', 'skills'), 'skills'];

const AGENT_LOCATIONS = ['agents', join('.github', 'agents')];

/** Discover all agent files: { name, srcPath }. */
function discoverAgents(sourceRoot) {
  const found = new Map();
  for (const loc of AGENT_LOCATIONS) {
    const dir = join(sourceRoot, loc);
    for (const file of listFiles(dir, (f) => f.endsWith('.agent.md'))) {
      const name = file.replace(/\.agent\.md$/, '');
      if (!found.has(name)) {
        found.set(name, { name, srcPath: join(dir, file) });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Discover all skills across known locations: { name, srcPath }. */
function discoverSkills(sourceRoot) {
  const found = new Map();
  for (const loc of SKILL_LOCATIONS) {
    const base = join(sourceRoot, loc);
    for (const name of listDirectories(base)) {
      if (!found.has(name)) {
        found.set(name, { name, srcPath: join(base, name) });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Discover user-level instruction files: { name, srcPath }. */
function discoverInstructions(sourceRoot) {
  const dir = join(sourceRoot, 'global-instructions');
  return listFiles(dir, (f) => f.endsWith('.md') && f !== 'README.md')
    .map((name) => ({ name, srcPath: join(dir, name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Locate every VS Code User directory on this machine.
 *
 * Instructions live in <User>/prompts, which is outside ~/.copilot and differs per
 * platform and per VS Code flavour. All detected flavours get the files so behaviour
 * is consistent whichever build you launch.
 */
function resolveVsCodeUserDirs() {
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

  return ['Code', 'Code - Insiders', 'VSCodium']
    .map((flavour) => join(base, flavour, 'User'))
    .filter((dir) => existsSync(dir));
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

function readManifest(targetHome) {
  const path = join(targetHome, MANIFEST_NAME);
  if (!existsSync(path)) return { agents: [], skills: [] };
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return {
      agents: Array.isArray(data.agents) ? data.agents : [],
      skills: Array.isArray(data.skills) ? data.skills : [],
    };
  } catch {
    return { agents: [], skills: [] };
  }
}

function writeManifest(targetHome, manifest, dryRun) {
  if (dryRun) return;
  const path = join(targetHome, MANIFEST_NAME);
  const payload = {
    source: 'agent-repo install.mjs',
    installedAt: new Date().toISOString(),
    agents: [...manifest.agents].sort(),
    skills: [...manifest.skills].sort(),
  };
  writeFileSync(path, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Install into a single target
// ---------------------------------------------------------------------------

function installTarget({ target, agents, skills, opts }) {
  const result = {
    agents: { added: [], updated: [], unchanged: [], removed: [] },
    skills: { added: [], updated: [], unchanged: [], removed: [] },
  };

  const prevManifest = readManifest(target.home);
  const nextManifest = { agents: [], skills: [] };

  const installAgents = opts.agents && target.supportsAgents;

  // --- Agents ---
  if (installAgents) {
    const agentDir = join(target.home, 'agents');
    if (!opts.dryRun) mkdirSync(agentDir, { recursive: true });

    for (const agent of agents) {
      const destFile = agent.name + target.agentExt;
      const dest = join(agentDir, destFile);
      const srcContent = readFileSync(agent.srcPath);
      const existed = existsSync(dest);
      const same = existed && readFileSync(dest).equals(srcContent);

      if (same) {
        result.agents.unchanged.push(destFile);
      } else if (existed) {
        if (!opts.dryRun) writeFileSync(dest, srcContent);
        result.agents.updated.push(destFile);
      } else {
        if (!opts.dryRun) writeFileSync(dest, srcContent);
        result.agents.added.push(destFile);
      }
      nextManifest.agents.push(destFile);
    }

    // Prune agents we previously installed but that no longer exist
    if (opts.prune) {
      const nextSet = new Set(nextManifest.agents);
      for (const stale of prevManifest.agents) {
        if (!nextSet.has(stale)) {
          const staleFile = join(agentDir, stale);
          if (existsSync(staleFile)) {
            if (!opts.dryRun) rmSync(staleFile, { force: true });
            result.agents.removed.push(stale);
          }
        }
      }
    } else {
      // Preserve prior manifest entries so we don't lose track of them
      for (const prev of prevManifest.agents) {
        if (!nextManifest.agents.includes(prev)) {
          nextManifest.agents.push(prev);
        }
      }
    }
  } else {
    nextManifest.agents = prevManifest.agents;
  }

  // --- Skills ---
  if (opts.skills) {
    const skillDir = join(target.home, 'skills');
    if (!opts.dryRun) mkdirSync(skillDir, { recursive: true });

    for (const skill of skills) {
      const dest = join(skillDir, skill.name);
      const before = snapshotDir(dest);
      const source = snapshotDir(skill.srcPath);

      if (before.size === 0) {
        if (!opts.dryRun) {
          mkdirSync(dest, { recursive: true });
          cpSync(skill.srcPath, dest, { recursive: true });
        }
        result.skills.added.push(skill.name);
      } else if (snapshotsEqual(before, source)) {
        result.skills.unchanged.push(skill.name);
      } else {
        if (!opts.dryRun) {
          rmSync(dest, { recursive: true, force: true });
          mkdirSync(dest, { recursive: true });
          cpSync(skill.srcPath, dest, { recursive: true });
        }
        result.skills.updated.push(skill.name);
      }
      nextManifest.skills.push(skill.name);
    }

    // Prune skills we previously installed but that no longer exist
    if (opts.prune) {
      const nextSet = new Set(nextManifest.skills);
      for (const stale of prevManifest.skills) {
        if (!nextSet.has(stale)) {
          const staleDir = join(skillDir, stale);
          if (existsSync(staleDir)) {
            if (!opts.dryRun)
              rmSync(staleDir, { recursive: true, force: true });
            result.skills.removed.push(stale);
          }
        }
      }
    } else {
      for (const prev of prevManifest.skills) {
        if (!nextManifest.skills.includes(prev)) {
          nextManifest.skills.push(prev);
        }
      }
    }
  } else {
    nextManifest.skills = prevManifest.skills;
  }

  writeManifest(target.home, nextManifest, opts.dryRun);

  return result;
}

// ---------------------------------------------------------------------------
// Install global instructions
// ---------------------------------------------------------------------------

/**
 * Install user-level instruction files into <vsCodeUser>/prompts.
 *
 * Tracked by its own manifest in that folder so pruning only ever touches files
 * this script wrote — hand-authored prompts sitting alongside them are left alone.
 */
function installInstructions({ userDir, instructions, opts }) {
  const destDir = join(userDir, 'prompts');
  const manifestPath = join(destDir, MANIFEST_NAME);
  const result = { added: [], updated: [], unchanged: [], removed: [] };

  let previous = [];
  if (existsSync(manifestPath)) {
    try {
      const data = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      if (Array.isArray(data.instructions)) previous = data.instructions;
    } catch {
      previous = [];
    }
  }

  if (!opts.dryRun) mkdirSync(destDir, { recursive: true });

  const installed = [];
  for (const file of instructions) {
    const dest = join(destDir, file.name);
    const srcContent = readFileSync(file.srcPath);
    const existed = existsSync(dest);
    const same = existed && readFileSync(dest).equals(srcContent);

    if (same) {
      result.unchanged.push(file.name);
    } else {
      if (!opts.dryRun) writeFileSync(dest, srcContent);
      (existed ? result.updated : result.added).push(file.name);
    }
    installed.push(file.name);
  }

  if (opts.prune) {
    const keep = new Set(installed);
    for (const stale of previous) {
      if (keep.has(stale)) continue;
      const stalePath = join(destDir, stale);
      if (existsSync(stalePath)) {
        if (!opts.dryRun) rmSync(stalePath, { force: true });
        result.removed.push(stale);
      }
    }
  } else {
    for (const prev of previous) {
      if (!installed.includes(prev)) installed.push(prev);
    }
  }

  if (!opts.dryRun) {
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          source: 'agent-repo install.mjs',
          installedAt: new Date().toISOString(),
          instructions: [...installed].sort(),
        },
        null,
        2,
      ) + '\n',
      'utf-8',
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function printSection(label, bucket) {
  const { added, updated, unchanged, removed } = bucket;
  console.log(`  ${label}:`);
  if (added.length) {
    added.forEach((f) => console.log(`    ✅ added    ${f}`));
  }
  if (updated.length) {
    updated.forEach((f) => console.log(`    🔄 updated  ${f}`));
  }
  if (removed.length) {
    removed.forEach((f) => console.log(`    ❌ removed  ${f}`));
  }
  if (unchanged.length) {
    console.log(`    – ${unchanged.length} unchanged`);
  }
  if (
    !added.length &&
    !updated.length &&
    !removed.length &&
    !unchanged.length
  ) {
    console.log('    (none)');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const opts = applyConfigFile(parseArgs(process.argv.slice(2)));
  const allTargets = buildTargets();

  // Validate requested targets
  const unknown = opts.targets.filter((t) => !allTargets[t]);
  if (unknown.length) {
    die(
      `Unknown target(s): ${unknown.join(', ')}\nValid targets: ${Object.keys(
        allTargets,
      ).join(', ')}`,
    );
  }
  if (opts.targets.length === 0) die('No targets selected.');

  const allAgents = opts.agents ? discoverAgents(SCRIPT_DIR) : [];
  const allSkills = opts.skills ? discoverSkills(SCRIPT_DIR) : [];

  const agents = selectItems(
    allAgents,
    opts.includeAgents,
    opts.excludeAgents,
    'agent',
  );
  const skills = selectItems(
    allSkills,
    opts.includeSkills,
    opts.excludeSkills,
    'skill',
  );

  if (
    agents.length !== allAgents.length ||
    skills.length !== allSkills.length
  ) {
    const via = opts.configPath ? ` (via ${opts.configPath})` : '';
    console.log(
      `\nFiltered: ${agents.length}/${allAgents.length} agent(s), ${skills.length}/${allSkills.length} skill(s)${via}`,
    );
  }

  if (opts.agents && agents.length === 0) {
    console.log('⚠️  No agents found in .github/agents/');
  }
  if (opts.skills && skills.length === 0) {
    console.log('⚠️  No skills found in .github/skills/ or skills/');
  }

  const instructions = opts.instructions
    ? discoverInstructions(SCRIPT_DIR)
    : [];

  console.log(`\nSource: ${SCRIPT_DIR}`);
  console.log(
    `Installing ${opts.agents ? agents.length : 0} agent(s), ${
      opts.skills ? skills.length : 0
    } skill(s), ${instructions.length} global instruction(s)`,
  );
  if (opts.dryRun) console.log('Mode: DRY RUN (no files written)');

  for (const key of opts.targets) {
    const target = allTargets[key];
    console.log(`\n─── ${target.label} ───`);
    console.log(`Home: ${target.home}`);

    const installAgents = opts.agents && target.supportsAgents;
    if (opts.agents && !target.supportsAgents) {
      console.log(
        '  ⏭️  Skipping agents — they are authored in Copilot format and do\n' +
          '      not port to this target. Installing portable skills only.',
      );
    }

    const result = installTarget({ target, agents, skills, opts });

    if (installAgents) printSection('Agents', result.agents);
    if (opts.skills) printSection('Skills', result.skills);
  }

  if (opts.instructions && instructions.length) {
    const userDirs = resolveVsCodeUserDirs();
    if (userDirs.length === 0) {
      console.log(
        '\n⚠️  No VS Code User directory found — skipping global instructions.\n' +
          '   Set VSCODE_USER_DIR to install them to a custom location.',
      );
    }
    for (const userDir of userDirs) {
      console.log(`\n─── Global instructions ───`);
      console.log(`Home: ${join(userDir, 'prompts')}`);
      const result = installInstructions({ userDir, instructions, opts });
      printSection('Instructions', result);
    }
  }

  // Duplicate-discovery caveat when installing skills to both trees
  if (
    opts.skills &&
    opts.targets.includes('copilot') &&
    opts.targets.includes('claude')
  ) {
    console.log(
      '\nℹ️  You installed skills to both ~/.copilot and ~/.claude. VS Code reads\n' +
        '   both, so skills may appear twice. Disable one set in VS Code via the\n' +
        '   chat.agentSkillsLocations setting if needed.',
    );
  }

  console.log(
    `\n✅ ${opts.dryRun ? 'Dry run complete.' : 'Install complete.'}\n`,
  );
}

main();
