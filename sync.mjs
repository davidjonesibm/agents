#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function readManifest(cwd) {
  const manifestPath = join(cwd, '.copilot-deps.json');
  if (!existsSync(manifestPath)) {
    die(
      `No .copilot-deps.json found in ${cwd}.\nCreate one based on .copilot-deps.example.json from the agent repo.`,
    );
  }
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    die(`Failed to parse .copilot-deps.json: ${err.message}`);
  }
}

function cloneSource(source, ref) {
  const tmp = mkdtempSync(join(tmpdir(), 'copilot-sync-'));
  const url = `https://github.com/${source}.git`;
  try {
    execFileSync('git', ['clone', '--depth', '1', '--branch', ref, url, tmp], {
      stdio: 'pipe',
    });
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true });
    die(
      `Failed to clone ${url} (ref: ${ref}):\n${err.stderr?.toString() ?? err.message}`,
    );
  }
  return tmp;
}

/** List files in a directory matching an optional filter. Non-recursive. */
function listFiles(dir, filter) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => {
    if (filter && !filter(f)) return false;
    return statSync(join(dir, f)).isFile();
  });
}

/** Extract the name: field from a YAML frontmatter body string. */
function extractFrontmatterName(frontmatterBody) {
  const match = frontmatterBody.match(/^name:\s*['"]?(.*?)['"]?\s*$/m);
  return match ? match[1] : null;
}

/**
 * Strip the agents: [...] field from frontmatter so roster-only differences
 * in rug-orchestrator.agent.md don't cause a spurious "updated" on every sync.
 */
function stripAgentsField(content) {
  return content.replace(/^agents:\s*\[[\s\S]*?\]\s*\n?/m, '');
}

/**
 * Compare two file buffers for equality, ignoring the agents: frontmatter
 * field for rug-orchestrator.agent.md (managed by updateRugAgentRoster).
 */
function contentsEqual(filename, srcBuf, tgtBuf) {
  if (srcBuf.equals(tgtBuf)) return true;
  if (filename === 'rug-orchestrator.agent.md') {
    return (
      stripAgentsField(srcBuf.toString('utf-8')) ===
      stripAgentsField(tgtBuf.toString('utf-8'))
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// Sync: Agents
// ---------------------------------------------------------------------------

function syncAgents(sourceRoot, targetRoot, requestedAgents) {
  const srcDir = join(sourceRoot, '.github', 'agents');
  const tgtDir = join(targetRoot, '.github', 'agents');

  const isAgent = (f) => f.endsWith('.agent.md');

  const allSrcAgents = new Set(listFiles(srcDir, isAgent));
  const tgtAgents = new Set(listFiles(tgtDir, isAgent));

  // Filter source agents to only those in the requested set
  const srcAgents = new Set(
    [...allSrcAgents].filter((f) =>
      requestedAgents.has(f.replace(/\.agent\.md$/, '')),
    ),
  );

  if (srcAgents.size === 0) {
    console.log('  ⚠️  No requested .agent.md files found in source repo.');
    return { added: [], updated: [], removed: [] };
  }

  mkdirSync(tgtDir, { recursive: true });

  const added = [];
  const updated = [];
  const removed = [];

  // Copy source → target
  for (const file of srcAgents) {
    const src = join(srcDir, file);
    const tgt = join(tgtDir, file);
    const existed = tgtAgents.has(file);

    const srcContent = readFileSync(src);
    const tgtContent = existed ? readFileSync(tgt) : null;

    if (!existed) {
      cpSync(src, tgt);
      added.push(file);
    } else if (!contentsEqual(file, srcContent, tgtContent)) {
      cpSync(src, tgt);
      updated.push(file);
    }
    // else: unchanged — skip
  }

  // Remove agents from target that are in the requested set but no longer in source
  for (const file of tgtAgents) {
    const name = file.replace(/\.agent\.md$/, '');
    if (requestedAgents.has(name) && !allSrcAgents.has(file)) {
      rmSync(join(tgtDir, file));
      removed.push(file);
    }
  }

  return { added, updated, removed };
}

// ---------------------------------------------------------------------------
// Sync: Skills
// ---------------------------------------------------------------------------

/** Known locations where skills live in the source repo. */
const SKILL_LOCATIONS = [
  { srcBase: 'skills', tgtBase: 'skills' },
  { srcBase: join('.github', 'skills'), tgtBase: join('.github', 'skills') },
];

function findSkillSource(sourceRoot, skillName) {
  for (const loc of SKILL_LOCATIONS) {
    const candidate = join(sourceRoot, loc.srcBase, skillName);
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return { srcPath: candidate, tgtBase: loc.tgtBase };
    }
  }
  return null;
}

/** Read all files in a directory recursively, returning a Map of relPath→Buffer. */
function snapshotDir(dir) {
  const map = new Map();
  if (!existsSync(dir)) return map;
  const walk = (base, rel) => {
    for (const entry of readdirSync(base)) {
      const fullPath = join(base, entry);
      const relPath = rel ? `${rel}/${entry}` : entry;
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath, relPath);
      } else {
        map.set(relPath, readFileSync(fullPath));
      }
    }
  };
  walk(dir, '');
  return map;
}

/** Return true if two directory snapshots have identical file sets and contents. */
function snapshotsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [key, val] of a) {
    const other = b.get(key);
    if (!other || !val.equals(other)) return false;
  }
  return true;
}

function syncSkills(sourceRoot, targetRoot, skillNames) {
  const results = { synced: [], unchanged: [], notFound: [] };

  for (const name of skillNames) {
    const found = findSkillSource(sourceRoot, name);
    if (!found) {
      results.notFound.push(name);
      continue;
    }

    const tgtDir = join(targetRoot, found.tgtBase, name);

    // Snapshot existing target contents before wiping
    const before = snapshotDir(tgtDir);

    // Remove existing skill directory so we get a clean copy
    if (existsSync(tgtDir)) {
      rmSync(tgtDir, { recursive: true, force: true });
    }

    mkdirSync(tgtDir, { recursive: true });
    cpSync(found.srcPath, tgtDir, { recursive: true });

    const after = snapshotDir(tgtDir);
    const dest = join(found.tgtBase, name);

    if (before.size > 0 && snapshotsEqual(before, after)) {
      results.unchanged.push({ name, dest });
    } else {
      results.synced.push({ name, dest });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Skill Dependency Check
// ---------------------------------------------------------------------------

function checkSkillDeps(
  sourceRoot,
  targetRoot,
  manifestSkills,
  requestedAgents,
) {
  const depsPath = join(sourceRoot, 'skill-deps.json');
  if (!existsSync(depsPath)) return null;

  let deps;
  try {
    deps = JSON.parse(readFileSync(depsPath, 'utf-8'));
  } catch {
    return null;
  }

  // Only check skill deps for agents the consumer actually requested
  const srcAgentDir = join(sourceRoot, '.github', 'agents');
  const syncedAgents = listFiles(srcAgentDir, (f) => f.endsWith('.agent.md'))
    .map((f) => f.replace(/\.agent\.md$/, ''))
    .filter((name) => requestedAgents.has(name));

  const manifestSkillSet = new Set(manifestSkills);

  const warnings = [];
  const scaffolded = [];
  const skipped = [];
  const templateMissing = [];

  for (const agent of syncedAgents) {
    const agentDeps = deps[agent];
    if (!agentDeps?.skills) continue;

    for (const dep of agentDeps.skills) {
      if (dep.type === 'bundled') {
        if (!manifestSkillSet.has(dep.name)) {
          warnings.push({ agent, skill: dep.name });
        }
      } else if (dep.type === 'scaffold') {
        const targetPath = join(targetRoot, dep.location);
        if (existsSync(targetPath)) {
          skipped.push({ agent, skill: dep.name, path: dep.location });
        } else {
          const templatePath = join(sourceRoot, 'skill-templates', dep.name);
          if (!existsSync(templatePath)) {
            templateMissing.push({ agent, skill: dep.name });
            continue;
          }
          mkdirSync(targetPath, { recursive: true });
          cpSync(templatePath, targetPath, { recursive: true });
          scaffolded.push({ agent, skill: dep.name, path: dep.location });
          console.log(
            `  📋 Scaffolded "${dep.name}" for agent "${agent}" — customize it in ${dep.location}/SKILL.md`,
          );
        }
      }
    }
  }

  for (const w of warnings) {
    console.log(
      `  ⚠️ Agent "${w.agent}" requires skill "${w.skill}" — add it to your .copilot-deps.json skills array`,
    );
  }

  return { warnings, scaffolded, skipped, templateMissing };
}

// ---------------------------------------------------------------------------
// Post-Sync: Update RUG Agent Roster
// ---------------------------------------------------------------------------

function updateRugAgentRoster(targetRoot) {
  const agentDir = join(targetRoot, '.github', 'agents');
  const rugFile = join(agentDir, 'rug-orchestrator.agent.md');

  if (!existsSync(rugFile)) return;

  const rugContent = readFileSync(rugFile, 'utf-8');
  const fmMatch = rugContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    console.log(
      '  ⚠️  rug-orchestrator.agent.md has no frontmatter — skipping roster update',
    );
    return;
  }

  const rugName = extractFrontmatterName(fmMatch[1]);

  // Collect names from all agent files in the consumer's agents directory
  const agentFiles = listFiles(agentDir, (f) => f.endsWith('.agent.md'));
  const agentNames = [];

  for (const file of agentFiles) {
    if (file === 'rug-orchestrator.agent.md') continue;

    const content = readFileSync(join(agentDir, file), 'utf-8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) continue;

    const name = extractFrontmatterName(match[1]);
    if (name && name !== rugName) {
      agentNames.push(name);
    }
  }

  const uniqueAgentNames = [...new Set(agentNames)].sort();

  // Build the new agents field in flow-sequence format
  let newAgentsField;
  if (uniqueAgentNames.length === 0) {
    newAgentsField = 'agents: []';
  } else {
    const items = uniqueAgentNames
      .map((n) => `    '${n.replace(/'/g, "''")}',`)
      .join('\n');
    newAgentsField = `agents:\n  [\n${items}\n  ]`;
  }

  // Replace or add the agents field in frontmatter
  const frontmatter = fmMatch[1];
  const agentsRegex = /^agents:\s*\[[\s\S]*?\]/m;

  let newFrontmatter;
  if (agentsRegex.test(frontmatter)) {
    newFrontmatter = frontmatter.replace(agentsRegex, newAgentsField);
  } else {
    newFrontmatter = frontmatter.trimEnd() + '\n' + newAgentsField;
  }

  const newContent = rugContent.replace(
    /^---\r?\n[\s\S]*?\r?\n---/,
    `---\n${newFrontmatter}\n---`,
  );

  writeFileSync(rugFile, newContent, 'utf-8');

  if (uniqueAgentNames.length > 0) {
    console.log(
      `  ✅ Updated RUG agent roster: [${uniqueAgentNames.join(', ')}]`,
    );
  } else {
    console.log('  ✅ Updated RUG agent roster: (no other agents found)');
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function printSummary(agentResult, skillResult, depResult) {
  console.log('\n─── Sync Summary ───────────────────────────\n');

  // Agents
  console.log('Agents (.github/agents/):');
  if (agentResult.added.length) {
    console.log(`  Added (${agentResult.added.length}):`);
    agentResult.added.forEach((f) => console.log(`    ✅ ${f}`));
  }
  if (agentResult.updated.length) {
    console.log(`  Updated (${agentResult.updated.length}):`);
    agentResult.updated.forEach((f) => console.log(`    🔄 ${f}`));
  }
  if (agentResult.removed.length) {
    console.log(`  Removed (${agentResult.removed.length}):`);
    agentResult.removed.forEach((f) => console.log(`    ❌ ${f}`));
  }
  const unchanged =
    agentResult.added.length === 0 &&
    agentResult.updated.length === 0 &&
    agentResult.removed.length === 0;
  if (unchanged) {
    console.log('  (no changes)');
  }

  // Skills
  console.log('\nSkills:');
  if (skillResult.synced.length) {
    skillResult.synced.forEach((s) =>
      console.log(`  ✅ ${s.name} → ${s.dest}`),
    );
  }
  if (skillResult.notFound.length) {
    skillResult.notFound.forEach((s) =>
      console.log(`  ⚠️ ${s} — not found in source repo`),
    );
  }
  if (skillResult.synced.length === 0 && skillResult.notFound.length === 0) {
    console.log('  (no skills requested)');
  }

  // Skill Dependencies
  if (depResult) {
    console.log('\nSkill Dependencies:');
    let hasOutput = false;
    if (depResult.scaffolded.length) {
      hasOutput = true;
      depResult.scaffolded.forEach((s) =>
        console.log(
          `  📋 ${s.skill} → scaffolded at ${s.path} (for ${s.agent})`,
        ),
      );
    }
    if (depResult.skipped.length) {
      hasOutput = true;
      depResult.skipped.forEach((s) =>
        console.log(`  ✅ ${s.skill} → already exists at ${s.path}`),
      );
    }
    if (depResult.warnings.length) {
      hasOutput = true;
      depResult.warnings.forEach((w) =>
        console.log(`  ⚠️ ${w.skill} — missing (required by ${w.agent})`),
      );
    }
    if (depResult.templateMissing.length) {
      hasOutput = true;
      depResult.templateMissing.forEach((t) =>
        console.log(
          `  ❌ ${t.skill} — template not found (required by ${t.agent})`,
        ),
      );
    }
    if (!hasOutput) {
      console.log('  (all dependencies satisfied)');
    }
  }

  console.log('\n────────────────────────────────────────────\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const cwd = process.cwd();

  console.log('Reading .copilot-deps.json …');
  const manifest = readManifest(cwd);

  const {
    source,
    ref = 'main',
    skills = [],
    agents: consumerAgents = [],
  } = manifest;
  if (!source) die('"source" field is required in .copilot-deps.json');

  console.log(`Cloning ${source} (ref: ${ref}) …`);
  const tmp = cloneSource(source, ref);

  // Read core agents from source repo
  const coreAgentsPath = join(tmp, 'core-agents.json');
  let coreAgents = [];
  if (existsSync(coreAgentsPath)) {
    try {
      coreAgents = JSON.parse(readFileSync(coreAgentsPath, 'utf-8'));
    } catch (err) {
      console.log(`  ⚠  Failed to parse core-agents.json: ${err.message}`);
    }
  }

  // Build the combined requested agents set (core + consumer-requested)
  const requestedAgents = new Set([...coreAgents, ...consumerAgents]);

  try {
    console.log('Syncing agents …');
    const agentResult = syncAgents(tmp, cwd, requestedAgents);

    console.log('Syncing skills …');
    const skillResult = syncSkills(tmp, cwd, skills);

    console.log('Checking skill dependencies …');
    const depResult = checkSkillDeps(tmp, cwd, skills, requestedAgents);

    console.log('Updating RUG agent roster …');
    updateRugAgentRoster(cwd);

    printSummary(agentResult, skillResult, depResult);

    // Warn if rug-routing was updated and local-routing exists in target
    const rugSynced = skillResult.synced.some((s) => s.name === 'rug-routing');
    if (
      rugSynced &&
      existsSync(join(cwd, '.github', 'skills', 'local-routing', 'SKILL.md'))
    ) {
      console.log(
        '  ⚠️ rug-routing was updated — review .github/skills/local-routing/SKILL.md for new agents or routing changes',
      );
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
