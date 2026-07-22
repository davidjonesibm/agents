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
  // If sync.sh already cloned the source, reuse it (avoids double-clone + auth issues)
  const preCloned = process.env.COPILOT_SYNC_SOURCE_DIR;
  if (preCloned && existsSync(preCloned)) {
    console.log('  (using pre-cloned source from COPILOT_SYNC_SOURCE_DIR)');
    return preCloned;
  }

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

/** List directories in a directory matching an optional filter. Non-recursive. */
function listDirectories(dir, filter) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => {
    if (filter && !filter(f)) return false;
    return statSync(join(dir, f)).isDirectory();
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
  const tgtDir = join(targetRoot, '.github', 'agents');

  const isAgent = (f) => f.endsWith('.agent.md');

  // Discover agents from all known source locations
  const allSrcAgents = new Set();
  const agentSrcMap = new Map(); // filename → source path
  for (const loc of AGENT_LOCATIONS) {
    const dir = join(sourceRoot, loc);
    for (const f of listFiles(dir, isAgent)) {
      if (!allSrcAgents.has(f)) {
        allSrcAgents.add(f);
        agentSrcMap.set(f, join(dir, f));
      }
    }
  }
  const tgtAgents = new Set(listFiles(tgtDir, isAgent));

  // Filter source agents to only those in the requested set
  const srcAgents = new Set(
    [...allSrcAgents].filter((f) =>
      requestedAgents.has(f.replace(/\.agent\.md$/, '')),
    ),
  );

  if (allSrcAgents.size === 0) {
    console.log('  ⚠️  No .agent.md files found in source repo.');
    return { added: [], updated: [], removed: [] };
  }

  mkdirSync(tgtDir, { recursive: true });

  const added = [];
  const updated = [];
  const removed = [];

  // Copy source → target
  for (const file of srcAgents) {
    const src = agentSrcMap.get(file);
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

  // Remove source-managed agents that are now excluded from sync.
  for (const file of tgtAgents) {
    const name = file.replace(/\.agent\.md$/, '');
    if (allSrcAgents.has(file) && !requestedAgents.has(name)) {
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
  { srcBase: 'skills', tgtBase: join('.github', 'skills') },
  { srcBase: join('.github', 'skills'), tgtBase: join('.github', 'skills') },
];

/** Known locations where agents live in the source repo. */
const AGENT_LOCATIONS = ['agents', join('.github', 'agents')];

function discoverSkillNames(sourceRoot) {
  const skillNames = new Set();

  for (const loc of SKILL_LOCATIONS) {
    const dir = join(sourceRoot, loc.srcBase);
    for (const name of listDirectories(dir)) {
      skillNames.add(name);
    }
  }

  return [...skillNames].sort();
}

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

/** Mirror a directory from sourceRoot/<dirName> to targetRoot/<dirName>. Full overwrite. */
function syncDirectory(sourceRoot, targetRoot, dirName) {
  const result = { synced: [], unchanged: [] };
  const srcPath = join(sourceRoot, dirName);
  if (!existsSync(srcPath)) return result;
  const tgtPath = join(targetRoot, dirName);
  const before = snapshotDir(tgtPath);
  if (existsSync(tgtPath)) {
    rmSync(tgtPath, { recursive: true, force: true });
  }
  mkdirSync(tgtPath, { recursive: true });
  cpSync(srcPath, tgtPath, { recursive: true });
  const after = snapshotDir(tgtPath);
  if (before.size > 0 && snapshotsEqual(before, after)) {
    result.unchanged.push(`${dirName}/`);
  } else {
    result.synced.push(`${dirName}/`);
  }
  return result;
}

/**
 * Merge files from sourceRoot/<dirName> into targetRoot/<dirName>.
 * Adds and updates files from source but never deletes target-only files,
 * preserving any bespoke content the consumer has added.
 */
function mergeDirectory(sourceRoot, targetRoot, dirName) {
  const result = { added: [], updated: [], unchanged: [] };
  const srcPath = join(sourceRoot, dirName);
  if (!existsSync(srcPath)) return result;
  const srcSnapshot = snapshotDir(srcPath);
  const tgtPath = join(targetRoot, dirName);
  mkdirSync(tgtPath, { recursive: true });
  for (const [relPath, srcContent] of srcSnapshot) {
    const tgtFile = join(tgtPath, relPath);
    const tgtDir = join(tgtFile, '..');
    mkdirSync(tgtDir, { recursive: true });
    if (!existsSync(tgtFile)) {
      writeFileSync(tgtFile, srcContent);
      result.added.push(`${dirName}/${relPath}`);
    } else {
      const tgtContent = readFileSync(tgtFile);
      if (!srcContent.equals(tgtContent)) {
        writeFileSync(tgtFile, srcContent);
        result.updated.push(`${dirName}/${relPath}`);
      } else {
        result.unchanged.push(`${dirName}/${relPath}`);
      }
    }
  }
  return result;
}

function syncSkills(sourceRoot, targetRoot, skillNames) {
  const results = { synced: [], unchanged: [], notFound: [] };
  const requestedSkillSet = new Set(skillNames);

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
  const syncedAgents = [];
  for (const loc of AGENT_LOCATIONS) {
    for (const f of listFiles(join(sourceRoot, loc), (f) =>
      f.endsWith('.agent.md'),
    )) {
      const name = f.replace(/\.agent\.md$/, '');
      if (requestedAgents.has(name) && !syncedAgents.includes(name)) {
        syncedAgents.push(name);
      }
    }
  }

  const warnings = [];
  const scaffolded = [];
  const skipped = [];
  const templateMissing = [];

  for (const agent of syncedAgents) {
    const agentDeps = deps[agent];
    if (!agentDeps?.skills) continue;

    for (const dep of agentDeps.skills) {
      if (dep.type === 'scaffold') {
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

  return { warnings, scaffolded, skipped, templateMissing };
}

// ---------------------------------------------------------------------------
// Local Routing Version Check
// ---------------------------------------------------------------------------

/** Extract the template-version: field from a YAML frontmatter body string. */
function extractTemplateVersion(frontmatterBody) {
  const match = frontmatterBody.match(
    /^template-version:\s*['"]?(.*?)['"]?\s*$/m,
  );
  return match ? match[1].trim() : null;
}

function checkLocalRoutingVersion(sourceRoot, targetRoot) {
  const templatePath = join(
    sourceRoot,
    'skill-templates',
    'local-routing',
    'SKILL.md',
  );
  const consumerPath = join(
    targetRoot,
    '.github',
    'skills',
    'local-routing',
    'SKILL.md',
  );

  if (!existsSync(templatePath) || !existsSync(consumerPath)) return;

  const templateContent = readFileSync(templatePath, 'utf-8');
  const consumerContent = readFileSync(consumerPath, 'utf-8');

  const templateFm = templateContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const consumerFm = consumerContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  const templateVersion = templateFm
    ? extractTemplateVersion(templateFm[1])
    : null;
  const consumerVersion = consumerFm
    ? extractTemplateVersion(consumerFm[1])
    : null;

  if (!templateVersion) return; // Template has no version — nothing to check

  if (consumerVersion === templateVersion) return; // Up to date

  // Copy the new template alongside the consumer's existing file so an agent can merge them
  const stagingPath = join(
    targetRoot,
    '.github',
    'skills',
    'local-routing',
    'SKILL.template.md',
  );
  writeFileSync(stagingPath, templateContent, 'utf-8');

  const bar = '═'.repeat(64);
  const pad = (s) => `║  ${s.padEnd(60)}  ║`;
  console.log(`\n╔${bar}╗`);
  console.log(pad('⚠️  LOCAL ROUTING TEMPLATE HAS CHANGED'));
  console.log(`║${'─'.repeat(64)}║`);
  if (consumerVersion) {
    console.log(
      pad(`Your local-routing is based on template v${consumerVersion}.`),
    );
    console.log(pad(`The source template is now v${templateVersion}.`));
  } else {
    console.log(pad('Your local-routing has no template-version.'));
    console.log(pad(`The source template is now v${templateVersion}.`));
  }
  console.log(`║${' '.repeat(64)}║`);
  console.log(pad('The updated template has been saved alongside your file:'));
  console.log(pad('  .github/skills/local-routing/SKILL.template.md'));
  console.log(`║${' '.repeat(64)}║`);
  console.log(pad('To merge, open Copilot Chat and use the Foundry agent:'));
  console.log(
    pad('  "Merge SKILL.template.md into SKILL.md for local-routing,'),
  );
  console.log(
    pad('   preserving my customizations, then delete the template file."'),
  );
  console.log(`║${' '.repeat(64)}║`);
  console.log(pad('After merging, add template-version to your frontmatter:'));
  console.log(pad(`  template-version: "${templateVersion}"`));
  console.log(`╚${bar}╝\n`);
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
// Source-Repo Sync (full mirror for forked agent repos)
// ---------------------------------------------------------------------------

/**
 * Files to mirror verbatim from the source repo root into the consuming repo
 * root when operating in source-repo mode.
 */
const SOURCE_REPO_EXTRA_FILES = [
  'skill-deps.json',
  'core-agents.json',
  'consumer-workflow.yml',
  'sync.mjs',
  'sync.sh',
  'init-templates.sh',
  '.copilot-deps.example.json',
];

/**
 * Full-mirror sync for repos that are themselves agent source repos (e.g. a
 * client fork of this repo). Syncs every agent, every skill, all
 * skill-templates, and key infrastructure files — no filtering, full overwrite.
 */
function syncSourceRepo(sourceRoot, targetRoot) {
  // 1. Merge agents/ — adds/updates upstream agents, preserves fork-only agents
  const agentsRootResult = mergeDirectory(sourceRoot, targetRoot, 'agents');

  // Also sync any agents still in .github/agents/ into target .github/agents/
  const allAgentNames = new Set();
  for (const loc of AGENT_LOCATIONS) {
    for (const f of listFiles(join(sourceRoot, loc), (f) =>
      f.endsWith('.agent.md'),
    )) {
      allAgentNames.add(f.replace(/\.agent\.md$/, ''));
    }
  }
  const agentResult = syncAgents(sourceRoot, targetRoot, allAgentNames);

  // 2. Merge skills/ — adds/updates upstream skills, preserves fork-only skills
  const skillsRootResult = mergeDirectory(sourceRoot, targetRoot, 'skills');

  // Also sync any skills still in .github/skills/ into target .github/skills/
  const ghSkillNames = listDirectories(join(sourceRoot, '.github', 'skills'));
  const skillResult =
    ghSkillNames.length > 0
      ? syncSkills(sourceRoot, targetRoot, ghSkillNames)
      : { synced: [], unchanged: [], notFound: [] };

  // 3. Mirror skill-templates/ in full (always overwrite)
  const templateResult = { synced: [], unchanged: [] };
  const templateSrc = join(sourceRoot, 'skill-templates');
  if (existsSync(templateSrc)) {
    const templateDst = join(targetRoot, 'skill-templates');
    const before = snapshotDir(templateDst);
    if (existsSync(templateDst)) {
      rmSync(templateDst, { recursive: true, force: true });
    }
    mkdirSync(templateDst, { recursive: true });
    cpSync(templateSrc, templateDst, { recursive: true });
    const after = snapshotDir(templateDst);
    if (before.size > 0 && snapshotsEqual(before, after)) {
      templateResult.unchanged.push('skill-templates/');
    } else {
      templateResult.synced.push('skill-templates/');
    }
  }

  // 4. Mirror individual infrastructure files
  const extraResult = { synced: [], unchanged: [] };
  for (const file of SOURCE_REPO_EXTRA_FILES) {
    const srcPath = join(sourceRoot, file);
    if (!existsSync(srcPath)) continue;
    const tgtPath = join(targetRoot, file);
    const srcContent = readFileSync(srcPath);
    const tgtContent = existsSync(tgtPath) ? readFileSync(tgtPath) : null;
    if (tgtContent && srcContent.equals(tgtContent)) {
      extraResult.unchanged.push(file);
    } else {
      writeFileSync(tgtPath, srcContent);
      extraResult.synced.push(file);
    }
  }

  // 5. Mirror docs/
  const docsResult = syncDirectory(sourceRoot, targetRoot, 'docs');

  // 6. Mirror instruction-templates/
  const instructionTemplatesResult = syncDirectory(
    sourceRoot,
    targetRoot,
    'instruction-templates',
  );

  return {
    agentsRootResult,
    agentResult,
    skillsRootResult,
    skillResult,
    templateResult,
    extraResult,
    docsResult,
    instructionTemplatesResult,
  };
}

function printSourceRepoSummary({
  agentsRootResult,
  agentResult,
  skillsRootResult,
  skillResult,
  templateResult,
  extraResult,
  docsResult,
  instructionTemplatesResult,
}) {
  console.log('\n─── Source-Repo Sync Summary ───────────────\n');

  // Agents (root merge)
  console.log('Agents (agents/ → agents/):');
  if (agentsRootResult.added.length) {
    agentsRootResult.added.forEach((f) => console.log(`  ✅ ${f} (added)`));
  }
  if (agentsRootResult.updated.length) {
    agentsRootResult.updated.forEach((f) => console.log(`  🔄 ${f} (updated)`));
  }
  if (agentsRootResult.unchanged.length) {
    console.log(`  – ${agentsRootResult.unchanged.length} file(s) unchanged`);
  }
  if (
    agentsRootResult.added.length === 0 &&
    agentsRootResult.updated.length === 0 &&
    agentsRootResult.unchanged.length === 0
  ) {
    console.log('  (none found in source)');
  }

  // Agents (.github/agents/)
  console.log('\nAgents (→ .github/agents/):');
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
  if (
    agentResult.added.length === 0 &&
    agentResult.updated.length === 0 &&
    agentResult.removed.length === 0
  ) {
    console.log('  (no changes)');
  }

  // Skills (root merge)
  console.log('\nSkills (skills/ → skills/):');
  if (skillsRootResult.added.length) {
    skillsRootResult.added.forEach((f) => console.log(`  ✅ ${f} (added)`));
  }
  if (skillsRootResult.updated.length) {
    skillsRootResult.updated.forEach((f) => console.log(`  🔄 ${f} (updated)`));
  }
  if (skillsRootResult.unchanged.length) {
    console.log(`  – ${skillsRootResult.unchanged.length} file(s) unchanged`);
  }
  if (
    skillsRootResult.added.length === 0 &&
    skillsRootResult.updated.length === 0 &&
    skillsRootResult.unchanged.length === 0
  ) {
    console.log('  (none found in source)');
  }

  // Skills (.github/skills/)
  console.log('\nSkills (→ .github/skills/):');
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
    console.log('  (no changes)');
  }

  // Skill Templates
  console.log('\nSkill Templates (skill-templates/):');
  if (templateResult.synced.length) {
    templateResult.synced.forEach((name) => console.log(`  ✅ ${name}`));
  }
  if (templateResult.unchanged.length) {
    templateResult.unchanged.forEach((name) =>
      console.log(`  – ${name} (unchanged)`),
    );
  }
  if (
    templateResult.synced.length === 0 &&
    templateResult.unchanged.length === 0
  ) {
    console.log('  (none found in source)');
  }

  // Docs
  console.log('\nDocs (docs/):');
  if (docsResult.synced.length) {
    docsResult.synced.forEach((name) => console.log(`  ✅ ${name}`));
  }
  if (docsResult.unchanged.length) {
    docsResult.unchanged.forEach((name) =>
      console.log(`  – ${name} (unchanged)`),
    );
  }
  if (docsResult.synced.length === 0 && docsResult.unchanged.length === 0) {
    console.log('  (none found in source)');
  }

  // Instruction Templates
  console.log('\nInstruction Templates (instruction-templates/):');
  if (instructionTemplatesResult.synced.length) {
    instructionTemplatesResult.synced.forEach((name) =>
      console.log(`  ✅ ${name}`),
    );
  }
  if (instructionTemplatesResult.unchanged.length) {
    instructionTemplatesResult.unchanged.forEach((name) =>
      console.log(`  – ${name} (unchanged)`),
    );
  }
  if (
    instructionTemplatesResult.synced.length === 0 &&
    instructionTemplatesResult.unchanged.length === 0
  ) {
    console.log('  (none found in source)');
  }

  // Infrastructure Files
  console.log('\nInfrastructure Files:');
  if (extraResult.synced.length === 0 && extraResult.unchanged.length === 0) {
    console.log('  (no files found)');
  } else {
    extraResult.synced.forEach((f) =>
      console.log(`  ⚠️  ${f} (updated — review for local customizations)`),
    );
    if (extraResult.unchanged.length) {
      console.log(
        `  (${extraResult.unchanged.length} file(s) unchanged: ${extraResult.unchanged.join(', ')})`,
      );
    }
  }

  console.log('\n────────────────────────────────────────────\n');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function printSummary(
  agentResult,
  skillResult,
  depResult,
  instructionTemplatesResult,
  docsResult,
) {
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
    console.log('  (no changes)');
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

  // Instruction Templates
  if (instructionTemplatesResult) {
    console.log('\nInstruction Templates (instruction-templates/):');
    if (instructionTemplatesResult.synced.length) {
      instructionTemplatesResult.synced.forEach((name) =>
        console.log(`  ✅ ${name}`),
      );
    }
    if (instructionTemplatesResult.unchanged.length) {
      instructionTemplatesResult.unchanged.forEach((name) =>
        console.log(`  – ${name} (unchanged)`),
      );
    }
    if (
      instructionTemplatesResult.synced.length === 0 &&
      instructionTemplatesResult.unchanged.length === 0
    ) {
      console.log('  (none found in source)');
    }
  }

  // Docs (merged — consumer files preserved)
  if (docsResult) {
    console.log('\nDocs (docs/):');
    if (docsResult.added.length) {
      docsResult.added.forEach((f) => console.log(`  ✅ ${f} (added)`));
    }
    if (docsResult.updated.length) {
      docsResult.updated.forEach((f) => console.log(`  🔄 ${f} (updated)`));
    }
    if (
      docsResult.added.length === 0 &&
      docsResult.updated.length === 0 &&
      docsResult.unchanged.length === 0
    ) {
      console.log('  (none found in source)');
    } else if (
      docsResult.added.length === 0 &&
      docsResult.updated.length === 0
    ) {
      console.log('  (no changes)');
    }
  }

  console.log('\n────────────────────────────────────────────\n');
}

// ---------------------------------------------------------------------------
// Post-Sync: Detect fork-only content in .github/ that should move to root
// ---------------------------------------------------------------------------

/**
 * In source-repo mode, root agents/ and skills/ are the source of truth.
 * .github/agents/ and .github/skills/ are auto-generated for Copilot discovery.
 *
 * If the fork previously used .github/ as its primary location, it may still
 * have core agents committed there (duplicates of what's now in root). This
 * function detects that pattern and suggests cleanup.
 */
function suggestMoveFromGitHub(targetRoot) {
  const isAgent = (f) => f.endsWith('.agent.md');

  const ghAgentDir = join(targetRoot, '.github', 'agents');
  const rootAgentDir = join(targetRoot, 'agents');
  const ghAgents = listFiles(ghAgentDir, isAgent);
  const rootAgents = new Set(listFiles(rootAgentDir, isAgent));

  // Agents in .github/ that ALSO exist in root — these are duplicates (core agents)
  const duplicateAgents = ghAgents.filter((f) => rootAgents.has(f));
  // Agents in .github/ that DON'T exist in root — fork-only, should move to root
  const orphanAgents = ghAgents.filter((f) => !rootAgents.has(f));

  const ghSkillDir = join(targetRoot, '.github', 'skills');
  const rootSkillDir = join(targetRoot, 'skills');
  const ghSkills = listDirectories(ghSkillDir);
  const rootSkills = new Set(listDirectories(rootSkillDir));

  // Skills in .github/ that ALSO exist in root — duplicates
  const duplicateSkills = ghSkills.filter((s) => rootSkills.has(s));
  // Skills in .github/ that DON'T exist in root — fork-only, should move to root
  const orphanSkills = ghSkills.filter((s) => !rootSkills.has(s));

  const hasDuplicates =
    duplicateAgents.length > 0 || duplicateSkills.length > 0;
  const hasOrphans = orphanAgents.length > 0 || orphanSkills.length > 0;

  if (!hasDuplicates && !hasOrphans) return;

  console.log('💡 Migration suggestion\n');
  console.log(
    '   In source-repo mode, root agents/ and skills/ are the source',
  );
  console.log(
    '   of truth. The .github/ copies are auto-generated by sync for',
  );
  console.log(
    "   Copilot discovery — you don't need to maintain them manually.\n",
  );

  if (hasDuplicates) {
    console.log(
      '   Core agents/skills found in .github/ (duplicates of root):',
    );
    if (duplicateAgents.length) {
      duplicateAgents.forEach((f) =>
        console.log(
          `     .github/agents/${f}  ← managed by sync, safe to delete from git`,
        ),
      );
    }
    if (duplicateSkills.length) {
      duplicateSkills.forEach((s) =>
        console.log(
          `     .github/skills/${s}/  ← managed by sync, safe to delete from git`,
        ),
      );
    }
    console.log('');
  }

  if (hasOrphans) {
    console.log('   Custom content found only in .github/ (move to root):');
    if (orphanAgents.length) {
      orphanAgents.forEach((f) =>
        console.log(`     mv .github/agents/${f} agents/${f}`),
      );
    }
    if (orphanSkills.length) {
      orphanSkills.forEach((s) =>
        console.log(`     mv .github/skills/${s} skills/${s}`),
      );
    }
    console.log('');
  }

  console.log(
    '   After cleanup, re-run sync — .github/ will be regenerated automatically.\n',
  );
}

// ---------------------------------------------------------------------------
// Post-Sync: Check if local sync.sh is outdated
// ---------------------------------------------------------------------------

/**
 * Compares the local sync.sh (in the consumer/fork root) against the upstream
 * sync.sh that was just used to run this script. If they differ, warn the user
 * to update and re-run.
 */
function checkSyncShOutdated(sourceRoot, targetRoot) {
  const localSyncSh = join(targetRoot, 'sync.sh');
  const upstreamSyncSh = join(sourceRoot, 'sync.sh');

  if (!existsSync(localSyncSh) || !existsSync(upstreamSyncSh)) return;

  const localContent = readFileSync(localSyncSh);
  const upstreamContent = readFileSync(upstreamSyncSh);

  if (localContent.equals(upstreamContent)) return;

  console.log('⚠️  Your sync.sh is outdated.\n');
  console.log('   The upstream sync.sh has changed. Update it and re-run:');
  console.log('     cp <source>/sync.sh ./sync.sh  # or let sync update it');
  console.log('     ./sync.sh\n');
  console.log(
    '   The updated version has been written to sync.sh automatically.',
  );

  // Auto-update sync.sh in the target
  writeFileSync(localSyncSh, upstreamContent);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const cwd = process.cwd();

  console.log('Reading .copilot-deps.json …');
  const manifest = readManifest(cwd);

  if (Array.isArray(manifest.agents)) {
    console.error('\n⚠️  Deprecated .copilot-deps.json format detected.');
    console.error(
      '   Remove the "agents" array. Agents now sync by default — use "excludeAgents" to opt out.',
    );
    console.error('   New format:');
    console.error('   {');
    console.error('     "source": "owner/repo",');
    console.error('     "ref": "main",');
    console.error('     "excludeAgents": [],');
    console.error('     "skills": ["skill-name", ...]');
    console.error('   }');
    die('Migrate .copilot-deps.json and rerun sync.');
  }

  const {
    type,
    source,
    ref = 'main',
    excludeAgents = [],
    skills = [],
  } = manifest;
  if (!source) die('"source" field is required in .copilot-deps.json');

  // --- Source-repo mode: full mirror for forked agent repos ---
  if (type === 'source') {
    console.log(`Mode: source-repo — cloning ${source} (ref: ${ref}) …`);
    const tmp = cloneSource(source, ref);
    const isPreCloned = tmp === process.env.COPILOT_SYNC_SOURCE_DIR;
    try {
      console.log(
        'Syncing all agents, skills, templates, and infrastructure …',
      );
      const results = syncSourceRepo(tmp, cwd);
      console.log('Updating RUG agent roster …');
      updateRugAgentRoster(cwd);
      printSourceRepoSummary(results);
      suggestMoveFromGitHub(cwd);
      checkSyncShOutdated(tmp, cwd);
    } finally {
      if (!isPreCloned) rmSync(tmp, { recursive: true, force: true });
    }
    return;
  }

  if (!Array.isArray(excludeAgents)) {
    die('"excludeAgents" must be an array in .copilot-deps.json');
  }
  if (!Array.isArray(skills)) {
    die('"skills" must be an array in .copilot-deps.json');
  }

  console.log(`Cloning ${source} (ref: ${ref}) …`);
  const tmp = cloneSource(source, ref);
  const isPreCloned = tmp === process.env.COPILOT_SYNC_SOURCE_DIR;

  try {
    const excludedAgentSet = new Set(excludeAgents);

    const allAgentNames = [];
    for (const loc of AGENT_LOCATIONS) {
      for (const f of listFiles(join(tmp, loc), (f) =>
        f.endsWith('.agent.md'),
      )) {
        const name = f.replace(/\.agent\.md$/, '');
        if (!allAgentNames.includes(name)) allAgentNames.push(name);
      }
    }
    allAgentNames.sort();
    const requestedAgents = new Set(
      allAgentNames.filter((name) => !excludedAgentSet.has(name)),
    );

    const requestedSkills = skills;

    const existingAgentNames = new Set(
      listFiles(join(cwd, '.github', 'agents'), (f) =>
        f.endsWith('.agent.md'),
      ).map((f) => f.replace(/\.agent\.md$/, '')),
    );
    const newAgentNames = [...requestedAgents]
      .filter((name) => !existingAgentNames.has(name))
      .sort();

    if (newAgentNames.length) {
      console.log('\n🆕 New agents available from source:');
      newAgentNames.forEach((name) => console.log(`  • ${name}`));
      console.log(
        'These will be synced. Add to "excludeAgents" in .copilot-deps.json to skip them.\n',
      );
    }

    console.log('Syncing agents …');
    const agentResult = syncAgents(tmp, cwd, requestedAgents);

    console.log('Syncing skills …');
    const skillResult = syncSkills(tmp, cwd, requestedSkills);

    console.log('Syncing instruction-templates …');
    const instructionTemplatesResult = syncDirectory(
      tmp,
      cwd,
      'instruction-templates',
    );

    console.log('Merging docs …');
    const docsResult = mergeDirectory(tmp, cwd, 'docs');

    console.log('Checking skill dependencies …');
    const depResult = checkSkillDeps(tmp, cwd, skills, requestedAgents);

    console.log('Updating RUG agent roster …');
    updateRugAgentRoster(cwd);

    printSummary(
      agentResult,
      skillResult,
      depResult,
      instructionTemplatesResult,
      docsResult,
    );

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

    // Print the local-routing template warning last so it's impossible to miss
    checkLocalRoutingVersion(tmp, cwd);

    // Check if sync.sh itself is outdated
    checkSyncShOutdated(tmp, cwd);
  } finally {
    if (!isPreCloned) rmSync(tmp, { recursive: true, force: true });
  }
}

main();
