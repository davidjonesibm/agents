#!/usr/bin/env node
/**
 * token-audit.mjs — Estimate where your Copilot AI credits go.
 *
 * VS Code does not record token counts, so this reconstructs an *estimate* from
 * the local session store using GitHub's Effective Tokens (ET) model:
 *
 *     ET = m × (1.0 × I + 0.1 × C + 4.0 × O)
 *
 *   m = model multiplier (Haiku 0.25, Sonnet 1.0, Opus 5.0)
 *   I = fresh input tokens        C = cached input tokens      O = output tokens
 *
 * Output is weighted 4× and cache reads only 0.1×, which is why long sessions and
 * chatty agents dominate cost while big-but-stable prompts barely register.
 *
 * These are ESTIMATES for spotting trends and outliers. For actual billed usage see
 * https://github.com/settings/billing → "AI usage".
 *
 * Usage:
 *   node token-audit.mjs                    # last 30 days, Sonnet pricing
 *   node token-audit.mjs --days 7
 *   node token-audit.mjs --model opus       # haiku | sonnet | opus
 *   node token-audit.mjs --base 20000       # per-turn fixed overhead in tokens
 *   node token-audit.mjs --top 15
 */

import { execFileSync } from 'node:child_process';
import {
  findSessionStoreDb,
  resolveSessionStoreDbPaths,
} from './lib/vscode-paths.mjs';

const DB = findSessionStoreDb();

// Model cost multipliers, per GitHub's ET model.
const MULTIPLIERS = { haiku: 0.25, sonnet: 1.0, opus: 5.0 };

// Fixed per-session overhead: system prompt + agent body + skill discovery + tool schemas.
const DEFAULT_BASE_TOKENS = 15000;

const CHARS_PER_TOKEN = 4;

function parseArgs(argv) {
  const opts = {
    days: 30,
    model: 'sonnet',
    base: DEFAULT_BASE_TOKENS,
    top: 10,
  };
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i];
    switch (argv[i]) {
      case '--days':
        opts.days = toPositiveInt(next(), '--days');
        break;
      case '--base':
        opts.base = toPositiveInt(next(), '--base');
        break;
      case '--top':
        opts.top = toPositiveInt(next(), '--top');
        break;
      case '--model': {
        const value = String(next() || '').toLowerCase();
        if (!(value in MULTIPLIERS)) {
          die(`--model must be one of: ${Object.keys(MULTIPLIERS).join(', ')}`);
        }
        opts.model = value;
        break;
      }
      case '-h':
      case '--help':
        console.log(
          'Usage: node token-audit.mjs [--days N] [--model haiku|sonnet|opus] [--base N] [--top N]',
        );
        process.exit(0);
        break;
      default:
        die(`Unknown argument: ${argv[i]}`);
    }
  }
  return opts;
}

function toPositiveInt(value, flag) {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0)
    die(`${flag} requires a positive integer`);
  return n;
}

function die(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

/** Query the session store read-only. Returns parsed rows. */
function query(sql) {
  try {
    const out = execFileSync('sqlite3', ['-readonly', '-json', DB, sql], {
      encoding: 'utf-8',
      maxBuffer: 256 * 1024 * 1024,
    });
    return out.trim() ? JSON.parse(out) : [];
  } catch (err) {
    die(`Query failed: ${err.message}`);
  }
}

const tokens = (chars) => Math.round((chars || 0) / CHARS_PER_TOKEN);
const fmt = (n) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${Math.round(n / 1000)}K`
      : String(Math.round(n));

/**
 * Model a session's token flow turn by turn, across its FULL history, but only
 * tally cost for turns flagged `in_window` (row.in_window === 1).
 *
 * Turn 1 pays the fixed overhead as fresh input. Every later turn re-sends the whole
 * conversation so far, which is served from cache at 0.1× — this is what makes long
 * sessions expensive even when each individual message is small. Simulating from
 * turn 1 (not from the first turn inside the window) keeps that cache cost honest
 * for sessions that started before the reporting window.
 */
function scoreSession(turns, baseTokens, multiplier) {
  let fresh = 0;
  let cached = 0;
  let output = 0;
  let windowTurns = 0;
  let running = baseTokens;

  turns.forEach((turn, index) => {
    const inTok = tokens(turn.in_chars);
    const outTok = tokens(turn.out_chars);
    const inWindow = turn.in_window === 1;

    if (inWindow) {
      if (index === 0) fresh += baseTokens;
      else cached += running;
      fresh += inTok;
      output += outTok;
      windowTurns += 1;
    }

    running += inTok + outTok;
  });

  const et = multiplier * (fresh + 0.1 * cached + 4 * output);
  return { fresh, cached, output, et, turns: windowTurns };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!DB) {
    const candidates = resolveSessionStoreDbPaths();
    die(
      `Session store not found. Checked:\n${candidates.map((p) => `   ${p}`).join('\n') || '   (no VS Code User directory found)'}\n\nEnable "github.copilot.chat.localIndex.enabled" in VS Code settings, then use Copilot for a while.`,
    );
  }

  const multiplier = MULTIPLIERS[opts.model];

  // Two-pass: find sessions with any turn in the window, then pull each
  // session's FULL turn history so cache-cost simulation starts from turn 1 —
  // otherwise a mid-session turn looks like a cheap "first turn".
  const rows = query(`
    SELECT s.id, COALESCE(NULLIF(s.repository,''),'(no repo)') AS repo,
           s.updated_at,
           t.turn_index,
           LENGTH(COALESCE(t.user_message,''))      AS in_chars,
           LENGTH(COALESCE(t.assistant_response,'')) AS out_chars,
           CASE WHEN t.timestamp >= datetime('now', '-${opts.days} day')
                THEN 1 ELSE 0 END AS in_window
    FROM sessions s JOIN turns t ON t.session_id = s.id
    WHERE s.id IN (
      SELECT DISTINCT session_id FROM turns
      WHERE timestamp >= datetime('now', '-${opts.days} day')
    )
    ORDER BY s.id, t.turn_index
  `);

  if (rows.length === 0) {
    console.log(`No sessions in the last ${opts.days} days.`);
    return;
  }

  const bySession = new Map();
  for (const row of rows) {
    if (!bySession.has(row.id)) {
      bySession.set(row.id, {
        repo: row.repo,
        when: row.updated_at,
        turns: [],
      });
    }
    bySession.get(row.id).turns.push(row);
  }

  const scored = [...bySession.entries()]
    .map(([id, s]) => ({
      id,
      repo: s.repo,
      when: (s.when || '').slice(0, 10),
      ...scoreSession(s.turns, opts.base, multiplier),
    }))
    .sort((a, b) => b.et - a.et);

  const totalEt = scored.reduce((sum, s) => sum + s.et, 0);
  const totalOut = scored.reduce((sum, s) => sum + s.output, 0);
  const totalTurns = scored.reduce((sum, s) => sum + s.turns, 0);

  console.log(
    `\n📊 Estimated token cost — last ${opts.days} days, ${opts.model} pricing (×${multiplier})`,
  );
  console.log(
    `   ${scored.length} sessions · ${totalTurns} turns · ${fmt(totalEt)} ET · ${fmt(totalOut)} output tokens\n`,
  );

  const short = (id) => id.slice(0, 8);
  const repoName = (r) =>
    r.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');

  console.log(`── Most expensive sessions ${'─'.repeat(34)}`);
  console.log('   ET      turns  out     share  repo');
  for (const s of scored.slice(0, opts.top)) {
    const share = `${((s.et / totalEt) * 100).toFixed(1)}%`.padStart(5);
    console.log(
      `   ${fmt(s.et).padEnd(7)} ${String(s.turns).padStart(5)}  ${fmt(s.output).padEnd(7)} ${share}  ${repoName(s.repo)}  ${short(s.id)}`,
    );
  }

  const byRepo = new Map();
  for (const s of scored) {
    const cur = byRepo.get(s.repo) || {
      et: 0,
      sessions: 0,
      turns: 0,
      output: 0,
    };
    cur.et += s.et;
    cur.sessions += 1;
    cur.turns += s.turns;
    cur.output += s.output;
    byRepo.set(s.repo, cur);
  }

  console.log(`\n── By repository ${'─'.repeat(43)}`);
  console.log('   ET      sess  turns  out     repo');
  for (const [repo, r] of [...byRepo.entries()].sort(
    (a, b) => b[1].et - a[1].et,
  )) {
    console.log(
      `   ${fmt(r.et).padEnd(7)} ${String(r.sessions).padStart(4)} ${String(r.turns).padStart(6)}  ${fmt(r.output).padEnd(7)} ${repoName(repo)}`,
    );
  }

  // Concentration: long sessions grow context quadratically, so a few can dominate.
  const long = scored.filter((s) => s.turns >= 16);
  const longEt = long.reduce((sum, s) => sum + s.et, 0);

  console.log(`\n── Findings ${'─'.repeat(48)}`);
  if (long.length) {
    console.log(
      `   ⚠  ${long.length} session(s) with 16+ turns = ${((longEt / totalEt) * 100).toFixed(0)}% of estimated cost.`,
    );
    console.log(
      `      Long threads re-send their whole history every turn. Start a new chat when the task changes.`,
    );
  }

  const outShare = (4 * totalOut * multiplier) / totalEt;
  console.log(
    `   ·  Output is ${(outShare * 100).toFixed(0)}% of estimated cost (4× weighted).`,
  );
  if (outShare > 0.5) {
    console.log(
      `      Over half your spend is the agent talking. Tighten verbosity rules.`,
    );
  }

  if (opts.model === 'opus') {
    console.log(
      `   ⚠  At Opus rates this workload would cost ${fmt(totalEt)} ET vs ${fmt(totalEt / 5)} on Sonnet.`,
    );
  }

  console.log(
    `\n   Estimates only — actual billing: https://github.com/settings/billing → AI usage\n`,
  );
}

main();
