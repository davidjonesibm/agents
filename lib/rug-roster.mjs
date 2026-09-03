/**
 * Rewrites rug-orchestrator.agent.md's `agents:` frontmatter field to match
 * whatever agent files actually sit in the same directory. Shared by sync.mjs
 * (per-repo sync) and install.mjs (global install) so both keep RUG's roster
 * truthful after agents are filtered in or out.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const RUG_FILENAME = 'rug-orchestrator.agent.md';

function listAgentFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (f) => f.endsWith('.agent.md') && statSync(join(dir, f)).isFile(),
  );
}

/** Extract the name: field from a YAML frontmatter body string. */
function extractFrontmatterName(frontmatterBody) {
  const match = frontmatterBody.match(/^name:\s*['"]?(.*?)['"]?\s*$/m);
  return match ? match[1] : null;
}

/**
 * Rebuild rug-orchestrator's `agents:` list from the agent files present in
 * `agentDir`. No-op if the RUG file isn't in that directory.
 */
export function updateRugAgentRoster(agentDir, { log = console.log } = {}) {
  const rugFile = join(agentDir, RUG_FILENAME);
  if (!existsSync(rugFile)) return;

  const rugContent = readFileSync(rugFile, 'utf-8');
  const fmMatch = rugContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    log(`  ⚠️  ${RUG_FILENAME} has no frontmatter — skipping roster update`);
    return;
  }

  const rugName = extractFrontmatterName(fmMatch[1]);

  const agentNames = [];
  for (const file of listAgentFiles(agentDir)) {
    if (file === RUG_FILENAME) continue;

    const content = readFileSync(join(agentDir, file), 'utf-8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) continue;

    const name = extractFrontmatterName(match[1]);
    if (name && name !== rugName) agentNames.push(name);
  }

  const uniqueAgentNames = [...new Set(agentNames)].sort();

  let newAgentsField;
  if (uniqueAgentNames.length === 0) {
    newAgentsField = 'agents: []';
  } else {
    const items = uniqueAgentNames
      .map((n) => `    '${n.replace(/'/g, "''")}',`)
      .join('\n');
    newAgentsField = `agents:\n  [\n${items}\n  ]`;
  }

  const frontmatter = fmMatch[1];
  const agentsRegex = /^agents:\s*\[[\s\S]*?\]/m;

  const newFrontmatter = agentsRegex.test(frontmatter)
    ? frontmatter.replace(agentsRegex, newAgentsField)
    : frontmatter.trimEnd() + '\n' + newAgentsField;

  const newContent = rugContent.replace(
    /^---\r?\n[\s\S]*?\r?\n---/,
    `---\n${newFrontmatter}\n---`,
  );

  writeFileSync(rugFile, newContent, 'utf-8');

  log(
    uniqueAgentNames.length > 0
      ? `  ✅ Updated RUG agent roster: [${uniqueAgentNames.join(', ')}]`
      : '  ✅ Updated RUG agent roster: (no other agents found)',
  );
}
