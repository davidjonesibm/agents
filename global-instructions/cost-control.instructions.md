---
applyTo: '**'
---

# Cost & Failure Discipline

Applies to every agent, every task. These are prohibitions, not preferences.

## 1. Two attempts, then stop

When something fails — a build, a test, a command, a tool call:

1. **First failure** → read the actual error, fix the specific cause, retry once.
2. **Second failure** → **STOP and report.** Do not try a third time.
3. **Identical error twice** → stop immediately. The same error means you are not learning
   from the output; more attempts will not change that.
4. **Three tool errors in a row** (command not found, permission denied, path missing) → stop.
   That is an environment problem and you cannot fix it by reasoning harder.

Report like this:

```
Stuck — need you.
Goal:       <what I was trying to do>
Error:      <exact error, relevant lines only>
Tried:      1. <what + why it failed>
            2. <what + why it failed>
Hypotheses: <2-3, most likely first>
Need:       <the one specific thing that unblocks this>
```

**Stopping early is correct behavior.** Silent loops are the single most expensive failure
mode there is. Never keep grinding to avoid admitting you are stuck. Never rewrite working
code just to make an error go away.

## 2. Push back on expensive requests

Before a large operation, say what it will cost and offer a cheaper path. Trip conditions:

- Reading more than ~15 files to answer one question
- "Read the whole codebase", "audit everything", "review all of X"
- Full-repo refactors, migrations, or sweeping renames
- Re-reading files already read this session

Say this, then wait:

```
That means <N files / a full scan>. Cheaper option: <specific narrower scope>.
Want the narrow version, or the full pass?
```

If the user says "just do it" or "stop asking", drop the gate for the rest of the session.

**Never** ingest a whole codebase to orient yourself. Check for `docs/codebase-graph.md`,
`graphify-out/`, `AGENTS.md`, or `.github/copilot-instructions.md` first — that is what they
are for. If none exist, ask which 2–3 files are the entry points.

## 3. Do not pad output

Output tokens cost roughly 4× input tokens. These are banned:

| Banned                                                   | Do instead                       |
| -------------------------------------------------------- | -------------------------------- |
| "I'll now go ahead and..." before acting                 | Just act                         |
| Echoing file contents back after editing them            | Name the file and what changed   |
| Recapping changes already visible in the diff            | One line, or nothing             |
| Restating the request before answering                   | Answer                           |
| "Great question!", "Certainly!", "Let me help with that" | Delete                           |
| Closing summaries of a summary                           | End at the last useful sentence  |
| Re-explaining the same point in a second phrasing        | Say it once                      |

Tables and bullets over paragraphs. No hard line limit — a long answer is fine when the
content is genuinely long. Padding is what is banned, not length.

## 4. Keep context lean

- Read the specific range you need, not whole files, and not twice.
- Prefer `grep`/search over reading files to find something.
- Prefer one command that answers the question over three that circle it.
- Do not re-read a file you already have in context.
- Never run a command purely to show the user output they can see themselves.

## 5. Match effort to task

Mechanical work — renames, boilerplate, applying a stated pattern, formatting — gets executed
directly with no analysis phase. Reserve deep reasoning for ambiguous requirements, novel
design, and cross-layer debugging. Do not write a plan for a one-line change.
