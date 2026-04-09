---
summary: "Proposal: bring Hermes Agent's self-evolution loop into OpenClaw using silent review turns, memory writes, and procedural skill evolution"
read_when:
  - Evaluating how Hermes Agent's self-improving behavior works
  - Designing a self-evolution architecture for OpenClaw agents
  - Deciding whether OpenClaw should use hooks, silent turns, or subagents for reflection
owner: "openclaw"
status: "draft"
last_updated: "2026-04-08"
title: "Hermes-Style Self-Evolution For OpenClaw"
---

# Hermes-Style Self-Evolution For OpenClaw

## Executive Summary

`hermes-agent` does not implement self-evolution as one monolithic subsystem. It implements a
closed learning loop made from five smaller mechanisms:

1. explicit prompt guidance that tells the model to save durable memory and procedural skills
2. periodic nudges that decide when a review should happen
3. a background review agent that re-reads the just-finished conversation and decides what to save
4. writable procedural memory via `skill_manage`
5. cross-session recall via `session_search`, plus optional richer user modeling through Honcho

OpenClaw already has most of the substrate needed to support the same outcome:

- workspace Markdown memory (`MEMORY.md`, `memory/*.md`)
- searchable memory via `memory_search` / `memory_get`
- workspace skills prompt loading
- plugin hooks around `before_prompt_build`, `agent_end`, `after_tool_call`, `session_start`, and `session_end`
- silent housekeeping turns via `NO_REPLY`
- subagent/session infrastructure when background isolation is required

The main gap is not storage or retrieval. The gap is orchestration. OpenClaw lacks a first-class
"review after work" loop that converts experience into updated memory and reusable procedures.

Recommended direction:

- implement self-evolution in OpenClaw as a **silent post-run review pipeline**
- reuse existing workspace memory files as the canonical store
- add a **procedural skill writer/editor tool** rather than relying only on read-only skill prompts
- add a **transcript recall tool** for cross-session experience lookup
- use plugins/hooks for triggering and policy, but keep the actual review execution in core agent
  runtime so behavior is deterministic and cheap to reason about

## What Hermes Agent Actually Does

## 1. Prompt-level learning policy

Hermes hardcodes learning policy into the system prompt builder.

Relevant files:

- `hermes-agent/agent/prompt_builder.py`
- `hermes-agent/run_agent.py`

The key guidance is:

- durable facts go to memory
- cross-session context should be recalled via `session_search`
- non-trivial workflows should become skills
- outdated skills should be patched immediately during use

This matters because Hermes does not depend on the user to say "remember this" every time. The
agent is constantly reminded that learning is part of task completion.

## 2. Periodic nudges

Hermes tracks two counters in `run_agent.py`:

- `_turns_since_memory`
- `_iters_since_skill`

These counters are compared against config-driven thresholds:

- `memory.nudge_interval`
- `skills.creation_nudge_interval`

The result is simple but effective:

- after enough user turns, Hermes schedules memory review
- after enough tool-heavy work, Hermes schedules skill review

This is not training. It is policy-driven review scheduling.

## 3. Background review agent

Hermes's most important implementation detail is `_spawn_background_review()` in `run_agent.py`.

After the main response is already delivered, Hermes forks a short-lived review agent with:

- shared memory store
- shared skill store
- the finished conversation snapshot
- a review prompt that asks whether anything should be saved

The review agent is not user-visible. It writes directly into memory/skills if it finds something
worth keeping. This keeps the main interaction responsive while still closing the learning loop.

This is the core self-evolution behavior.

## 4. Skills as procedural memory

Hermes treats skills as "how-to memory", not just imported prompt packs.

Relevant file:

- `hermes-agent/tools/skill_manager_tool.py`

Capabilities include:

- create skill
- edit skill
- patch skill
- write support files
- remove support files

This is why Hermes can improve its own procedures over time. If a workflow changes, the agent can
update the procedural artifact, not just write a note into `MEMORY.md`.

## 5. Cross-session experience recall

Relevant file:

- `hermes-agent/tools/session_search_tool.py`

Hermes can search prior sessions via SQLite FTS and summarize relevant transcripts with a smaller
model. This gives the agent access to experience, not just curated memory files.

This is important because:

- not every useful lesson has already been distilled into memory
- many implementation details live in transcripts, commands, and tool outputs

## 6. Optional deeper user modeling

Hermes also supports richer user/agent modeling via Honcho. That is a meaningful enhancement, but
it is not the minimum required for self-evolution. The minimum loop is:

- do work
- review the work
- write durable memory
- update reusable procedure
- recall prior experience next time

## OpenClaw Today: What Already Exists

## 1. Durable Markdown memory already exists

OpenClaw already uses workspace Markdown as the source of truth:

- `MEMORY.md`
- `memory/YYYY-MM-DD.md`

Relevant docs/code:

- `docs/concepts/memory.md`
- `src/memory/manager.ts`
- `src/agents/system-prompt.ts`

OpenClaw also already supports:

- semantic lookup with `memory_search`
- targeted reads with `memory_get`
- async indexing and watch-based refresh

This means OpenClaw does not need a new memory storage format for v1.

## 2. Silent housekeeping turns already exist

OpenClaw already has a production-grade pattern for silent agent work:

- pre-compaction memory flush
- `NO_REPLY` suppression

Relevant docs/code:

- `docs/reference/session-management-compaction.md`
- `docs/concepts/memory.md`
- `src/auto-reply/reply/agent-runner-memory.ts`

This is a critical advantage. OpenClaw already knows how to run an internal turn that:

- uses the normal agent runtime
- writes files/tools as needed
- does not leak a user-visible response

That makes it a better fit than introducing a brand-new review execution path.

## 3. Skills are already a first-class prompt surface

OpenClaw already has workspace/bundled/plugin skill discovery and prompt injection.

Relevant files:

- `src/agents/skills/workspace.ts`
- `src/agents/skills.ts`

What is missing is the writable half of the loop. Today OpenClaw is very good at loading skills,
but not at letting the agent evolve them safely as part of normal operation.

## 4. The hook system is already sufficient

Relevant docs/code:

- `docs/concepts/agent-loop.md`
- `src/plugins/hooks.ts`
- `src/plugins/types.ts`

Useful existing hooks:

- `before_prompt_build`
- `agent_end`
- `after_tool_call`
- `tool_result_persist`
- `session_start`
- `session_end`
- `subagent_spawned`
- `subagent_ended`

This means the "when should review happen?" logic can be attached without invasive gateway hacks.

## 5. OpenClaw has session and subagent infrastructure

Relevant docs:

- `docs/concepts/session-tool.md`
- `docs/tools/subagents.md`

This is useful for phase 2 or 3, but should not be the default v1 execution model.

Subagents are heavier than necessary for every review. The existing silent-turn pattern is a
better default for post-task learning.

## Gap Analysis

OpenClaw is missing four concrete things that Hermes relies on:

## 1. No post-run review loop

OpenClaw has pre-compaction memory flush, but no general "after meaningful work, review what should
be learned" pipeline.

## 2. No writable procedural memory tool

OpenClaw can read/use skills, but does not expose a Hermes-style `skill_manage` equivalent that can:

- create a new workspace skill
- patch an existing skill
- store supporting references/templates/scripts

Without this, OpenClaw can remember facts but cannot reliably evolve its own workflows.

## 3. No transcript recall tool equivalent to `session_search`

OpenClaw has:

- `sessions_history` for raw transcript fetch
- memory search for curated Markdown

But it does not have a tool that turns prior transcripts into compact, topic-focused experience
recall. This limits cross-session learning.

## 4. No unified policy connecting memory, experience, and skill evolution

Today these exist as separate capabilities. Hermes connects them into one loop. OpenClaw needs that
orchestration layer.

## Recommended Architecture

## Design principles

1. keep Markdown artifacts as source of truth
2. reuse the existing embedded agent runtime
3. prefer silent review turns over subagents for v1
4. separate durable fact memory from procedural memory
5. make every learning artifact attributable to a source session/run
6. keep review policy configurable and conservative by default

## Proposed components

## A. Evolution trigger policy

Add a small runtime policy module, for example:

- `src/agents/evolution/policy.ts`

Responsibilities:

- decide whether the just-finished run deserves review
- compute `reviewMemory`, `reviewSkills`, `reviewTranscriptSummary`
- use signals such as:
  - tool call count
  - presence of retries/errors/replans
  - explicit user phrasing like "remember", "save", "this workflow"
  - task duration / token usage
  - whether files were modified

Config shape could look like:

```json5
{
  agents: {
    defaults: {
      selfEvolution: {
        enabled: true,
        mode: "silent_turn", // future: "subagent"
        memoryReviewEveryTurns: 8,
        skillReviewMinToolCalls: 5,
        maxReviewsPerSession: 2,
        allowInGroupChats: false
      }
    }
  }
}
```

## B. Silent review executor

Add a reusable internal execution path, for example:

- `src/agents/evolution/review-runner.ts`

Behavior:

- runs after `agent_end`
- reuses the current session transcript snapshot
- injects a review prompt
- executes as a normal internal turn with `deliver: false`
- requires the review output to begin with `NO_REPLY` unless it is producing only tool actions

This should be implemented by reusing the same internal machinery used for silent housekeeping,
because OpenClaw already solves:

- hidden delivery
- streaming suppression
- transcript persistence
- workspace write behavior

Recommendation:

- **v1 should use silent internal turns, not `sessions_spawn`**
- subagents should only be introduced later if review needs strong isolation or long-running
  asynchronous analysis

## C. Procedural memory toolset

Add a skill writer/editor surface for workspace skills, for example:

- `skills_manage` or `skill_edit`

Capabilities should mirror the minimum Hermes set:

- `create`
- `patch`
- `replace`
- `write_file`
- `remove_file`

Safety requirements:

- only operate inside allowed workspace skill roots
- enforce frontmatter and file-size limits
- keep writes atomic
- scan for path traversal / risky file placement
- optionally require a feature flag before destructive skill edits

Suggested storage:

- continue using workspace skills under the existing OpenClaw skill roots
- optionally reserve `skills/generated/` or `skills/learned/` for agent-created artifacts

## D. Experience recall tool

Add a higher-level recall tool, for example:

- `experience_search`

This should not replace `sessions_history`. It should sit above it.

Behavior:

1. search prior session transcripts
2. cluster or rank relevant sessions
3. summarize only the useful parts
4. return:
   - what the user wanted
   - what actions were taken
   - what worked/failed
   - important files/commands/paths
   - unresolved issues

OpenClaw already has enough primitives to build this:

- session transcript storage
- `sessions_history`
- existing model execution path

This tool is critical because many useful lessons are transcript-native before they become curated
memory.

## E. Evolution ledger

Store lightweight provenance for review actions, for example:

- `agentDir/evolution/reviews.jsonl`

Each entry should record:

- source session key / session id / run id
- timestamp
- triggers that fired
- actions taken:
  - memory updated
  - skill created
  - skill patched
  - no-op
- affected files

This gives debuggability without making the workspace itself noisy.

## Prompt and Hook Flow

## Before prompt build

Use `before_prompt_build` to inject a compact policy reminder when self-evolution is enabled.

It should say, in effect:

- save durable facts to memory
- use transcript recall when prior experience matters
- when a workflow is reusable, write or patch a skill

This should be shorter than Hermes's broad guidance because OpenClaw already has a larger prompt
surface.

## After agent end

Use `agent_end` as the primary trigger point.

Flow:

1. inspect the finished run metadata
2. ask policy whether review is warranted
3. if no, stop
4. if yes, launch silent review turn
5. let the review turn call:
   - memory tools
   - skill management tool
   - optionally experience/transcript tools

## Session start

Use `session_start` for cheap prefetch/warmup only.

Examples:

- warm memory index
- warm transcript search index
- load any per-session evolution state

Do not put heavy review logic here.

## Proposed Review Prompt Shape

The review prompt should be much more operational than philosophical.

Suggested structure:

```text
Review the completed run.

Decide whether any of the following should be updated:

1. Durable memory
- stable user preferences
- repeated expectations
- important project facts or decisions

2. Procedural memory (skills)
- a reusable workflow succeeded
- an existing workflow was outdated and needed correction
- a failure taught a safer or more reliable method

3. Experience recall artifacts
- this session contains a lesson likely to be searched later

Rules:
- Only save information that is likely to matter again.
- Prefer patching an existing skill over creating a duplicate.
- If nothing is worth saving, do not produce a user-visible reply. Reply with NO_REPLY.
```

## Recommended Phasing

## Phase 1: minimal viable self-evolution

Ship:

- self-evolution config
- short prompt guidance
- `agent_end` trigger policy
- silent review turn executor
- memory-only review writes
- evolution ledger

Do not ship yet:

- skill creation/editing
- transcript summarization recall
- user modeling

Why:

- this is the smallest version that already creates a real learning loop
- OpenClaw already has memory files and silent turns
- operational risk is low

## Phase 2: procedural skill evolution

Ship:

- writable skill management tool
- generated/learned skills namespace
- review policy that triggers skill updates after tool-heavy or error-heavy runs

This is the point where OpenClaw reaches Hermes's most differentiated capability: evolving its own
procedures, not just writing notes.

## Phase 3: transcript-native experience recall

Ship:

- `experience_search`
- transcript summarization
- review prompts that can cite prior attempts before deciding how to save knowledge

This makes self-evolution more robust across long-lived projects where useful experience has not
yet been curated into memory.

## Phase 4: deeper user/agent modeling

Optional:

- Honcho-like integration
- richer per-user representations
- explicit agent-self identity seeding and reflection

This is valuable, but not required for the first useful version.

## Why Silent Turn Is Better Than Subagent For V1

OpenClaw has two plausible implementations:

1. spawn a background subagent/session
2. run a silent internal review turn

Recommendation: choose option 2 first.

Reasons:

- OpenClaw already has silent-turn semantics and `NO_REPLY`
- no new session routing complexity
- less session noise
- easier to reason about transcript ownership
- lower latency and lower token overhead
- no need to manage announce/cleanup behavior

Use subagents only when review becomes:

- long-running
- parallelized
- multi-stage
- expensive enough that it should be isolated from the main session runtime

## Main Risks

## 1. Over-writing low-value memory

If review is too eager, OpenClaw will fill `MEMORY.md` with task noise.

Mitigation:

- conservative triggers
- explicit prompt rules
- cap writes per review
- write operational detail into daily logs, not long-term memory

## 2. Skill sprawl

If every solved task becomes a skill, the prompt surface becomes noisy and contradictory.

Mitigation:

- prefer patching existing skills
- reserve generated skills in a dedicated namespace
- add dedupe rules and naming constraints

## 3. Review loops that consume too much budget

Background review can silently become expensive.

Mitigation:

- strict per-review token/iteration caps
- per-session review limits
- disable in low-value contexts such as noisy group chats by default

## 4. False confidence from transcript summaries

An experience recall tool can hallucinate if summarization is too lossy.

Mitigation:

- preserve source session ids and transcript paths
- include concrete evidence snippets when useful
- distinguish inferred summary from raw cited facts

## Proposed First Implementation Slice In OpenClaw

If the goal is to move fast without overcommitting, the recommended first slice is:

1. add `agents.defaults.selfEvolution`
2. inject minimal learning guidance into the system prompt
3. on `agent_end`, evaluate a conservative review policy
4. when triggered, run a silent `NO_REPLY` review turn
5. let that turn write only to:
   - `memory/YYYY-MM-DD.md`
   - `MEMORY.md`
6. record provenance in an evolution ledger

Then, only after this is stable:

7. add skill editing/creation
8. add transcript-native `experience_search`

## Conclusion

Hermes Agent's self-evolution is not magic and does not require RL or online fine-tuning. It is a
runtime learning loop built from:

- explicit learning policy
- review triggers
- hidden review execution
- writable memory
- writable procedural knowledge
- transcript recall

OpenClaw already has enough architecture to adopt this pattern cleanly.

The best design is to treat self-evolution as a new core runtime capability built on top of:

- existing memory files
- existing silent housekeeping turns
- existing hook system
- future writable skill management

In short:

- **v1 should be a silent memory-review loop**
- **v2 should add procedural skill evolution**
- **v3 should add transcript-native experience recall**

That sequence gets most of Hermes's value into OpenClaw without forcing a risky rewrite of the
agent runtime.
