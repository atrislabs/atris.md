# atris.md — Universal Codebase Instrumentation Blueprint

> **One markdown file. Drop it anywhere. Agents scaffold a fully-instrumented codebase in <10 minutes.**

This spec defines how to transform any codebase into a self-documenting, AI-navigable system. Five artifacts (CODE_MAP.md, 3 agent specs, TASK_CONTEXTS.md) + autonomous agents = 10x faster collaboration.

**See [`ATRIS_NOTES.md`](./ATRIS_NOTES.md) for vision, roadmap, and future phases (sync, sessions, agent crews).**

---

## Phase 1: Generate CODE_MAP.md (Exact File Context)

**Goal:** Create a single-source-of-truth navigation guide that agents reference for all architecture questions.

**Why This Matters:**
- Agents waste time re-learning codebase structure on each task
- CODE_MAP.md eliminates friction—one grep-friendly index that's always accurate
- All agents reference the same truth, preventing contradictory guidance

**Agent Instructions:**

1. **Scan the project root** (ignore: `node_modules/`, `.git/`, `dist/`, `build/`, `.DS_Store`, `*.log`)

2. **For each major directory** (depth 1-2 levels), extract:
   - Purpose (1 sentence: why does this directory exist?)
   - Key files with line-count ranges (e.g., `auth.ts: 200 lines`)
   - Search accelerators (ripgrep patterns for fast navigation)

3. **Create `/CODE_MAP.md`** with these sections:
   - **Quick Reference Index** (top) — Grep-friendly shortcuts (e.g., `CHAT:BACKEND -> rg -n "def quick_chat" backend/`)
   - **By-Feature** — Chat, files, auth, billing, etc. (answer: "where is feature X?")
   - **By-Concern** — State management, API layer, UI system, etc. (answer: "where is concern Y?")
   - **Critical Files** — Files >10KB or >100 lines of logic = high-impact (mark as ⭐)
   - **Entry Points** — 3-5 entry points clearly marked (landing page, dashboard, API routes, etc.)

4. **Quality Checklist Before Outputting:**
   - [ ] Can I run `rg -l "TODO|FIXME"` and navigate to each via line numbers in CODE_MAP?
   - [ ] Does every major file have a one-liner explaining its purpose?
   - [ ] Are there 10+ ripgrep patterns I can use to navigate quickly?
   - [ ] Can a new developer answer "where is X?" in <30 seconds using this map?

5. **Output:** `/CODE_MAP.md` (target: 500-800 lines for large codebases; scale to project size)

---

## Phase 2: Spawn 3 Foundation Agents

After CODE_MAP.md exists, generate agent specs from CODE_MAP insights. Each agent has explicit guardrails.

### Agent 1: **@codebase_AGENT.md**

- **Role:** Codebase Navigator & Architecture Expert
- **Activation Prompt:**
  ```
  You are the codebase expert. Your sole job is answering "where is X?" with precision.

  Rules:
  1. ALWAYS start with: "According to CODE_MAP.md, [item] is located in..."
  2. ALWAYS cite file:line references (e.g., `app/auth/middleware.ts:15-45`)
  3. Explain data flows end-to-end (frontend → backend → database)
  4. Identify coupling points and architecture violations
  5. Guide developers to the right file in <5 clicks

  DO NOT:
  - Execute code changes or file modifications
  - Make architecture decisions without explicit approval
  - Assume file locations; always reference CODE_MAP.md
  ```

- **Knowledge Base:** CODE_MAP.md, architecture docs, API specs, system design docs
- **Success Metric:** Every question answered with exact file:line references, zero guesses

### Agent 2: **@task_AGENT.md**

- **Role:** Context-Aware Task Executor
- **Activation Prompt:**
  ```
  You are the task executor. When given a task, extract exact context and execute step-by-step.

  Rules:
  1. Read CODE_MAP.md first; extract file:line references for all related files
  2. Identify ALL files that will be touched (use ripgrep patterns from CODE_MAP)
  3. Map dependencies and risk zones
  4. Create a concise 4-5 sentence execution plan with:
     - File paths
     - Line numbers for modifications
     - Exact description of changes
  5. Execute step-by-step, validating at each stage

  Format: "Task: [name] | Files: [path:line] | Changes: [exact description]"

  DO NOT:
  - Skip validation steps
  - Modify files outside the planned scope
  - Ignore type errors or test failures
  ```

- **Knowledge Base:** CODE_MAP.md, TASK_CONTEXTS.md (generated), test suite, type definitions
- **Success Metric:** Tasks completed 95% first-try with zero regressions

### Agent 3: **@validator_AGENT.md**

- **Role:** Quality Gatekeeper & Architecture Guardian
- **Activation Prompt:**
  ```
  You are the validator. After ANY change, verify safety and accuracy.

  Rules:
  1. Run type-check, lint, tests automatically
  2. Verify all file references in CODE_MAP.md still exist and are accurate
  3. Update CODE_MAP.md if architecture changed
  4. Check for breaking changes or coupling violations
  5. Report: "✓ Safe to merge" or "⚠ Risks: [list]"

  ALWAYS cite CODE_MAP.md and explain why changes are safe/risky.

  DO NOT:
  - Approve changes without running tests
  - Allow breaking changes silently
  - Update CODE_MAP.md without explaining what changed
  ```

- **Knowledge Base:** CODE_MAP.md, test suite, type definitions, architecture principles
- **Success Metric:** Zero undetected breaking changes reach production

---

## Phase 3: Task Context System (TASK_CONTEXTS.md)

**Goal:** Automatic task extraction with exact file context, so agents never guess.

**Generated File Format:**

```markdown
# Task Contexts — Auto-extracted from CODE_MAP.md

## Task Template
- **Task ID:** T-[AUTO]
- **Name:** [Feature/Fix Name]
- **Context Files:** [file:line_start-line_end] (from CODE_MAP critical files)
- **Execution Plan:**
  1. [Step 1 with file:line reference]
  2. [Step 2 with file:line reference]
  3. [Step 3 with file:line reference]
- **Success Criteria:** [Measurable, testable]
- **Dependencies:** [Task IDs or external dependencies]
- **Risk Level:** [Low/Medium/High + reasoning]

## Example Task (Auto-Generated)
- **Task ID:** T-001
- **Name:** Add authentication to file upload
- **Context Files:**
  - `app/api/files/upload/route.ts:1-50` (handler)
  - `app/auth/middleware.ts:15-45` (auth check)
  - `types/auth.ts:8-20` (auth types)
- **Execution Plan:**
  1. Add `verifySession()` call to upload handler (line 20)
  2. Return 401 if no session (add lines 21-23)
  3. Add auth test to `__tests__/upload.test.ts:112-125`
  4. Run `npm run test` and verify all pass
- **Success Criteria:** Upload rejects unauthenticated requests; all tests pass; CODE_MAP.md updated
- **Dependencies:** None
- **Risk Level:** Low (isolated auth check, no cross-module impact)
```

**Agent Instructions:**

1. After CODE_MAP.md is generated, scan for:
   - Incomplete features (TODOs, FIXMEs, marked with line numbers)
   - High-risk files (>500 lines, multiple imports, touching shared state)
   - Cross-module dependencies that could break easily

2. Auto-generate 5-10 canonical tasks with exact file:line references
   - Include both quick wins (low-risk) and strategic work (high-impact)
   - Map all dependencies explicitly

3. Output: `/TASK_CONTEXTS.md` (maintains and evolves as project changes)

4. On each CODE_MAP.md update, regenerate TASK_CONTEXTS.md to reflect new state

---

## Phase 4: Activation & Handoff

**When All Five Required Artifacts Exist:**

- ✅ `CODE_MAP.md` (navigation guide)
- ✅ `@codebase_AGENT.md` (question answerer)
- ✅ `@task_AGENT.md` (executor)
- ✅ `@validator_AGENT.md` (gatekeeper)
- ✅ `TASK_CONTEXTS.md` (task bank)

**Agent Behavior Activates Automatically:**

| Trigger | Agent | Action |
|---------|-------|--------|
| "Where is X?" | @codebase_AGENT | Answers with CODE_MAP.md:line reference |
| "Do task Y" | @task_AGENT | Extracts context, plans execution, cites file:line |
| After change | @validator_AGENT | Checks validity, updates docs, blocks unsafe changes |
| New agent joins | @codebase_AGENT | Reads CODE_MAP.md, immediately productive (no ramp-up) |

**Validation Checklist:**

- [ ] All three agents can read and cite CODE_MAP.md
- [ ] @codebase_AGENT answers 5 test questions with file:line accuracy
- [ ] @task_AGENT completes a sample task without regressions
- [ ] @validator_AGENT successfully detects and blocks a breaking change
- [ ] CODE_MAP.md is accurate and stays in sync with code

---

## Phase 5: Future Roadmap (Vision)

**See [`ATRIS_NOTES.md`](./ATRIS_NOTES.md) for full roadmap. Preview:**

- **Phase 5a: Sync** — Local + cloud markdown sync, enabling offline editing and asynchronous agent work
- **Phase 5b: Sessions** — Step-by-step markdown workflows with `!status`, `!result` tags for interactive collaboration
- **Phase 5c: Crew Orchestration** — Multi-agent coordination (codebase expert → executor → validator) from markdown config

---

## Why This Works

1. **CODE_MAP = Single Source of Truth** — All agents reference one navigation guide; no contradictions
2. **Exact File:Line Context** — No guessing; every answer is pinpoint accurate
3. **Self-Validating** — @validator_AGENT keeps CODE_MAP and artifacts fresh automatically
4. **Scalable to Any Codebase** — Works for monorepos, microservices, solo projects, legacy systems
5. **Agent Handoff** — New agent joins, reads CODE_MAP, immediately productive (no ramp-up time)
6. **Offline + Async Ready** — Markdown files work offline; sync on schedule (future Phase 5a)

---

## Implementation Checklist

- [ ] **Phase 1:** Generate CODE_MAP.md on fresh codebase (10 min)
- [ ] **Phase 1 Validation:** Run ripgrep shortcuts from CODE_MAP; all work (5 min)
- [ ] **Phase 2:** Spawn 3 agent specs with activation prompts (5 min)
- [ ] **Phase 3:** Auto-generate TASK_CONTEXTS.md from CODE_MAP insights (10 min)
- [ ] **Phase 4:** Test system (ask @codebase_AGENT a question, watch it cite CODE_MAP:line) (10 min)
- [ ] **Ongoing:** Each CODE_MAP update triggers TASK_CONTEXTS refresh

**Total time to full instrumentation: ~40 minutes**

---

## Quick Start

```bash
# 1. Copy atris.md to your project root
cp atris.md /path/to/your/project/

# 2. Hand atris.md to any agent with this prompt:
# "Read atris.md. Execute Phase 1-4 to scaffold this codebase."

# 3. Agent generates 5 artifacts
# 4. Your codebase is now fully instrumented for AI collaboration

# Future: atris-cli automates this
# atris init
```

---

**Status:** Spec finalized. When deployed to a fresh project, agents will:
1. Map the codebase in <10 minutes
2. Answer questions with file:line precision
3. Execute tasks with full context
4. Maintain docs as code evolves

*Drop atris.md anywhere. Agents follow the blueprint. Codebase becomes fully instrumented for AI collaboration.*
