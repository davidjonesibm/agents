---
name: root-cause-analysis
description: >-
  Disciplined debugging for symptom-driven problems — "X is wrong", "not working",
  "wrong value in production", "worked before, broken now". Enforces proving the cause
  before changing code, checking the environment before the source, detecting stale
  library knowledge, directing cheap subagents to gather facts, and stopping honestly
  after two failed hypotheses. USE WHEN the input is a symptom rather than a
  specification, when a fix has already failed once, or when builds pass but behaviour
  is still wrong. DO NOT USE FOR: implementing a specified feature, compile errors with
  an obvious cause, or code review.
---

# Root Cause Analysis

A symptom is not a specification. You do not know what to change yet, and the fastest
route to knowing is **not** to start changing things.

## Prime directive

> **Prove the cause before you edit code.** A patch shipped without a proven cause is a
> guess. Guesses compound: the third one is repairing damage from the first.

Your first move on any symptom is a **diagnosis pass that modifies nothing**. It ends with
a written cause and the evidence for it, or with an honest "not found yet, here's what's
ruled out."

## 1. Establish the observation loop first

Before any hypothesis, answer: **how will I see whether this changed?**

| Symptom lives in                       | Your evidence is                             | Not             |
| -------------------------------------- | -------------------------------------------- | --------------- |
| Compiler / tests                       | build + test output                          | —               |
| Runtime behaviour, logs, telemetry, UI | a fresh run the user or you can observe      | "build clean"   |
| A dashboard or external system         | a query against that system after a redeploy | local reasoning |

If the only observer is the user, **say so explicitly and stop after one change.** Shipping
three speculative fixes between observations makes the results uninterpretable — you can no
longer tell which change did what.

**"Build clean" is never evidence that a behavioural bug is fixed.** Never report a
behavioural fix as done. Report it as: `Changed X. Unverified — needs a run; check <the
specific thing to look at>.`

## 2. Environment before source

Most "impossible" bugs are not in the code you are reading. Before forming any hypothesis
about logic, confirm **the code you are editing is the code that runs**:

- **Branch / sync state** — is every involved repo on the expected branch and pulled?
- **Package resolution** — is the consumer using the published package, a project
  reference, or a sideload (`Directory.Build.targets`/`.props`, `nuget.config` local
  source, `paket`, npm `link`, workspace protocol)?
- **Version actually restored** — not the version requested. Check the lock/assets file.
- **Duplicate types / shadowing** — the same class name in two assemblies or namespaces,
  where a generic or DI resolution binds to the one you are not looking at.
- **Stale artifacts** — old build output, cached container layer, unrestarted process,
  not-redeployed service.
- **Config precedence** — env var or vault value overriding the file you are reading.

In a multi-repo or shared-package setup, do this **first**, not after logic is exhausted.

## 3. Check your own knowledge is current

Symptoms involving an SDK or library are often your knowledge being out of date, not the
code being wrong.

Before asserting how a dependency behaves, **read the pinned version** — `PackageReference`,
`package.json`, `go.mod`, TFM, `global.json` — then:

- If you cannot confidently date that version, **say so** and get current facts before
  answering.
- Preferred sources, in order: the **installed artifact itself**
  (`~/.nuget/packages/<pkg>/<version>/`, `node_modules/<pkg>/`) — it is the exact code
  running; then the project's own source; then official docs via web fetch.
- Internal string constants, tag names, and activity/span conventions change between minor
  versions and are the single most common stale-knowledge trap.

> **A build error or a user correction that contradicts something you "know" is evidence
> about your knowledge, not about the code.** Go and look. Never re-derive the same claim
> from memory twice.

## 4. Hypothesis discipline

One hypothesis at a time, each stated so it can be **killed**:

```
HYPOTHESIS: <mechanism, specific enough to be wrong>
PREDICTS:   <what must be observable if true>
KILLED BY:  <the cheapest observation that disproves it>
```

Run the **cheapest discriminating check first** — a log line, a grep, a config dump, a
`dotnet list package` — before editing anything. Prefer a check that splits the search
space in half over one that confirms your favourite theory.

Keep a running **ruled out** list and carry it into every later turn and dispatch. Losing
it is how loops start.

## 5. Use scouts for facts, never for findings

You may dispatch cheap subagents (`runSubagent` → `Haiku Engineer`), but only for **closed
questions with lossless answers**:

| Good scout task                                              | Bad scout task                                |
| ------------------------------------------------------------ | --------------------------------------------- |
| "List every type named `X` and its namespace and assembly"   | "Investigate why the name is wrong"           |
| "Report the resolved version of package `P` in each project" | "Read the telemetry code and report findings" |
| "Print how package `P` is referenced in each csproj"         | "Summarise what's relevant here"              |

A scout that summarises decides what matters — that is the analysis, and it is the one thing
you must not delegate. If the answer is prose, do it yourself. If it is a list, a version, a
path, or a yes/no, delegate it, and delegate several at once.

## 6. Two failed hypotheses, then change something structural

Two disproven hypotheses on one symptom means the cause is outside where everyone is looking.
Do **not** try a third from the same frame. In cost order, cheapest first:

1. **Restart in a fresh session, same model.** Cost per turn scales with accumulated context,
   so a session carrying several dead theories is simultaneously the most expensive one to
   continue and the most anchored to the wrong frame. Resetting costs nothing. Carry the
   ruled-out list across; leave the reasoning behind.
2. **Stop and report** with the ruled-out list.
3. **Escalate the model** — fresh session, Opus — only after a reset has already failed. A
   bigger model multiplies every remaining token, so it has to buy a genuinely different frame,
   not just another lap.

**Never revert to a previously disproven hypothesis without new evidence.**

## 7. Report format

```
SYMPTOM:   <what is observably wrong>
CAUSE:     <mechanism> — evidence: <what proves it>
RULED OUT: <hypothesis — how it was disproven>
FIX:       <change made, or proposed>
VERIFY BY: <exact observation that confirms it, and who must make it>
```

If the cause is not proven, say `CAUSE: not established` and list what is ruled out. That is
a legitimate, useful result. A confident wrong cause is worse than an honest unknown.

## Anti-patterns

- Editing code before the cause is proven → guessing
- Reporting "build clean" as a behavioural fix → the gate does not measure the symptom
- Stacking multiple speculative fixes between observations → results become uninterpretable
- Reading source for a bug whose cause is branch, version, or resolution → check §2 first
- Re-deriving library behaviour from memory after being contradicted → read the artifact
- Asking a scout to "investigate" or "report findings" → it will filter out the answer
- A third hypothesis from the same frame → escalate, refresh, or stop
- Dropping the ruled-out list between turns → the loop restarts
