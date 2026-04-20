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

// ---------------------------------------------------------------------------
// Sync: Agents
// ---------------------------------------------------------------------------

function syncAgents(sourceRoot, targetRoot) {
  const srcDir = join(sourceRoot, '.github', 'agents');
  const tgtDir = join(targetRoot, '.github', 'agents');

  const isAgent = (f) => f.endsWith('.agent.md');

  const srcAgents = new Set(listFiles(srcDir, isAgent));
  const tgtAgents = new Set(listFiles(tgtDir, isAgent));

  if (srcAgents.size === 0) {
    console.log('  ⚠  No .agent.md files found in source repo.');
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
    } else if (!srcContent.equals(tgtContent)) {
      cpSync(src, tgt);
      updated.push(file);
    }
    // else: unchanged — skip
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

function syncSkills(sourceRoot, targetRoot, skillNames) {
  const results = { synced: [], notFound: [] };

  for (const name of skillNames) {
    const found = findSkillSource(sourceRoot, name);
    if (!found) {
      results.notFound.push(name);
      continue;
    }

    const tgtDir = join(targetRoot, found.tgtBase, name);

    // Remove existing skill directory so we get a clean copy
    if (existsSync(tgtDir)) {
      rmSync(tgtDir, { recursive: true, force: true });
    }

    mkdirSync(tgtDir, { recursive: true });
    cpSync(found.srcPath, tgtDir, { recursive: true });
    results.synced.push({ name, dest: join(found.tgtBase, name) });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Skill Dependency Check
// ---------------------------------------------------------------------------

function checkSkillDeps(sourceRoot, targetRoot, manifestSkills) {
  const depsPath = join(sourceRoot, 'skill-deps.json');
  if (!existsSync(depsPath)) return null;

  let deps;
  try {
    deps = JSON.parse(readFileSync(depsPath, 'utf-8'));
  } catch {
    return null;
  }

  // All source agents are synced to the target — derive the list from source
  const srcAgentDir = join(sourceRoot, '.github', 'agents');
  const syncedAgents = listFiles(srcAgentDir, (f) =>
    f.endsWith('.agent.md'),
  ).map((f) => f.replace(/\.agent\.md$/, ''));

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
      `  ⚠ Agent "${w.agent}" requires skill "${w.skill}" — add it to your .copilot-deps.json skills array`,
    );
  }

  return { warnings, scaffolded, skipped, templateMissing };
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
    agentResult.added.forEach((f) => console.log(`    + ${f}`));
  }
  if (agentResult.updated.length) {
    console.log(`  Updated (${agentResult.updated.length}):`);
    agentResult.updated.forEach((f) => console.log(`    ~ ${f}`));
  }
  if (agentResult.removed.length) {
    console.log(`  Removed (${agentResult.removed.length}):`);
    agentResult.removed.forEach((f) => console.log(`    - ${f}`));
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
    skillResult.synced.forEach((s) => console.log(`  ✔ ${s.name} → ${s.dest}`));
  }
  if (skillResult.notFound.length) {
    skillResult.notFound.forEach((s) =>
      console.log(`  ⚠ ${s} — not found in source repo`),
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
        console.log(`  ✔ ${s.skill} → already exists at ${s.path}`),
      );
    }
    if (depResult.warnings.length) {
      hasOutput = true;
      depResult.warnings.forEach((w) =>
        console.log(`  ⚠ ${w.skill} — missing (required by ${w.agent})`),
      );
    }
    if (depResult.templateMissing.length) {
      hasOutput = true;
      depResult.templateMissing.forEach((t) =>
        console.log(
          `  ⚠ ${t.skill} — template not found (required by ${t.agent})`,
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

  const { source, ref = 'main', skills = [] } = manifest;
  if (!source) die('"source" field is required in .copilot-deps.json');

  console.log(`Cloning ${source} (ref: ${ref}) …`);
  const tmp = cloneSource(source, ref);

  try {
    console.log('Syncing agents …');
    const agentResult = syncAgents(tmp, cwd);

    console.log('Syncing skills …');
    const skillResult = syncSkills(tmp, cwd, skills);

    console.log('Checking skill dependencies …');
    const depResult = checkSkillDeps(tmp, cwd, skills);

    printSummary(agentResult, skillResult, depResult);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
