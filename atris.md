# atris.md — A new system for an AI agent team

> **Drop this markdown file anywhere. Scaffold and operate an AI agent team.**

This spec defines how to transform any system (codebase, product, sales process, research) into a self-documenting, AI-navigable workspace. Standard structure: `atris/` folder with MAP.md, agent_team/, and TASK_CONTEXTS.md.

**Workflow:** Daily logs → Navigator plans → Executor builds → Validator reviews.

---

## Phase 1: Generate MAP.md (Universal Navigation)

**Goal:** Create a single-source-of-truth navigation guide that agents reference for all system/architecture questions.

**Why This Matters:**
- Agents waste time re-learning system structure on each task
- MAP.md eliminates friction—one grep-friendly index that's always accurate
- All agents reference the same truth, preventing contradictory guidance
- Works for ANY domain: code, product, sales, research, operations

**Agent Instructions:**

1. **Scan the project root** (ignore: `node_modules/`, `.git/`, `dist/`, `build/`, `.DS_Store`, `*.log`)

2. **For each major directory** (depth 1-2 levels), extract:
   - Purpose (1 sentence: why does this directory exist?)
   - Key files with line-count ranges (e.g., `auth.ts: 200 lines`)
   - Search accelerators (ripgrep patterns for fast navigation)

3. **Create `/atris/MAP.md`** with ONLY these sections (no extras):
   - **Quick Reference Index** (top) — Grep-friendly shortcuts (e.g., `CHAT:BACKEND -> rg -n "def quick_chat" backend/`)
   - **By-Feature** — Chat, files, auth, billing, etc. (answer: "where is feature X?")
   - **By-Concern** — State management, API layer, UI system, etc. (answer: "where is concern Y?")
   - **Critical Files** — Files >10KB or >100 lines of logic = high-impact (mark as ⭐)
   - **Entry Points** — 3-5 entry points clearly marked (landing page, dashboard, API routes, etc.)

4. **DO NOT include this:**
   - COMPLEX Architecture Flows unless specified (keep it simple to understand)
   - TODOs/Improvements (those go in TASK_CONTEXTS.md)
   - Project stats (unnecessary metadata)

5. **Quality Checklist Before Outputting:**
   - [ ] Does every major file/component have a one-liner explaining its purpose?
   - [ ] Can a new person answer "where is X?" in <30 seconds using this map?

6. **Output:** `/atris/MAP.md` (target: 300-500 lines for large systems; scale to project size)

7. **After MAP.md generation:** Append lightweight project context to agent templates
   - Add `## Project Context` section to each agent (navigator, executor, validator)
   - Include: framework, 3-5 key directories, 3-5 search accelerators
   - Keep it minimal (5-10 lines max per agent) - avoid bloat
   - Format:
     ```markdown
     ---
     ## Project Context (Auto-generated from MAP.md)
     - **Framework:** Next.js 14
     - **Key dirs:** app/, components/, lib/
     - **Search patterns:**
       - Components: `rg "export default" components/`
       - API routes: `rg "export async function" app/api/`
     ```

---

## Phase 2: Foundational Agent Templates

ATRIS ships with pre-built agent templates in `/atris/agent_team/` (copied during `atris init`). These templates provide battle-tested specs that work out of the box. Each agent has explicit guardrails.

**Templates included:**

### Agent 1: **navigator.md** (in `/atris/agent_team/`)

- **Role:** System Navigator & Architecture Expert
- **Activation Prompt:**
  ```
  You are the system navigator. Your sole job is answering "where is X?" with precision.

  Rules:
  1. ALWAYS start with: "According to MAP.md, [item] is located in..."
  2. ALWAYS cite file:line or component references (e.g., `app/auth/middleware.ts:15-45`)
  3. Explain flows end-to-end (frontend → backend → database, or research → analysis → writeup)
  4. Identify coupling points and structure violations
  5. Guide people to the right location in <5 clicks

  DO NOT:
  - Execute changes or modifications without explicit approval
  - Make architecture/structure decisions without approval
  - Assume locations; always reference MAP.md
  ```

- **Knowledge Base:** MAP.md, architecture docs, specs, design docs
- **Success Metric:** Every question answered with exact references, zero guesses

### Agent 2: **executor.md** (in `/atris/agent_team/`)

- **Role:** Context-Aware Task Executor
- **Activation Prompt:**
  ```
  You are the task executor. When given a task, extract exact context and execute step-by-step.

  Rules:
  1. Read MAP.md first; extract file:line references for all related files
  2. Identify ALL files that will be touched (use ripgrep patterns from MAP)
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

- **Knowledge Base:** MAP.md, TASK_CONTEXTS.md (generated), test suite, type definitions
- **Success Metric:** Tasks completed 95% first-try with zero regressions

### Agent 3: **validator.md** (in `/atris/agent_team/`)

- **Role:** Quality Gatekeeper
- **Activation Prompt:**
  ```
  You are the validator. After ANY change, verify safety and accuracy.

  Rules:
  1. Run type-check, lint, tests automatically
  2. Verify all file references in MAP.md still exist and are accurate
  3. Update MAP.md if architecture changed
  4. Check for breaking changes or coupling violations
  5. Report: "✓ Safe to merge" or "⚠ Risks: [list]"

  ALWAYS cite MAP.md and explain why changes are safe/risky.

  DO NOT:
  - Approve changes without running tests
  - Allow breaking changes silently
  - Update MAP.md without explaining what changed
  ```

- **Knowledge Base:** MAP.md, test suite, type definitions, architecture principles
- **Success Metric:** Zero undetected breaking changes reach production

---

## Phase 3: Task Context System (TASK_CONTEXTS.md in `/atris/`)

**Goal:** Automatic task extraction with exact file/component context, so agents never guess.

**Generated File Format:**

```markdown
# Task Contexts — Auto-extracted from MAP.md

## Task Template
- **Task ID:** T-[AUTO]
- **Name:** [Feature/Fix Name]
- **Complexity:** [Trivial|Simple|Moderate|Complex|Epic]
  - Trivial: Single-line fix, typo, comment
  - Simple: 1-2 files, <50 lines, no cross-module deps
  - Moderate: 3-5 files, <200 lines, some deps
  - Complex: 5+ files, >200 lines, multiple systems
  - Epic: Architectural change, multi-system refactor
- **Scope:**
  - Files touched: [count]
  - Lines affected: ~[estimate]
  - Dependencies: [count of related files/modules]
- **Context Files:** [file:line_start-line_end] (from MAP critical files)
- **Execution Plan:**
  1. [Step 1 with file:line reference]
  2. [Step 2 with file:line reference]
  3. [Step 3 with file:line reference]
- **Success Criteria:** [Measurable, testable]
- **Dependencies:** [Task IDs or external dependencies]
- **Risk Level:** [Low/Medium/High]
  - Blast radius: [how many systems/endpoints affected]
  - Test coverage: [existing tests? new tests needed?]
  - Rollback: [Easy|Moderate|Difficult]

## Example Task (Auto-Generated)
- **Task ID:** T-001
- **Name:** Add authentication to file upload
- **Complexity:** Simple
- **Scope:**
  - Files touched: 3
  - Lines affected: ~20
  - Dependencies: 1 (auth middleware)
- **Context Files:**
  - `app/api/files/upload/route.ts:1-50` (handler)
  - `app/auth/middleware.ts:15-45` (auth check)
  - `types/auth.ts:8-20` (auth types)
- **Execution Plan:**
  1. Add `verifySession()` call to upload handler (line 20)
  2. Return 401 if no session (add lines 21-23)
  3. Add auth test to `__tests__/upload.test.ts:112-125`
  4. Run `npm run test` and verify all pass
- **Success Criteria:** Upload rejects unauthenticated requests; all tests pass; MAP.md updated
- **Dependencies:** None
- **Risk Level:** Low
  - Blast radius: Single endpoint (upload only)
  - Test coverage: Existing auth tests; new upload auth test needed
  - Rollback: Easy (single handler change, no DB migration)
```

**Agent Instructions:**

1. After MAP.md is generated, scan for:
   - Incomplete work (TODOs, FIXMEs, gaps marked with line numbers)
   - High-risk areas (>500 lines, multiple dependencies, touching shared state)
   - Cross-component dependencies that could break easily

2. Auto-generate 5-10 canonical tasks with exact file:line or component references
   - Include both quick wins (low-risk) and strategic work (high-impact)
   - Map all dependencies explicitly

3. Output: `/atris/TASK_CONTEXTS.md` (maintains and evolves as system changes)

4. On each MAP.md update, regenerate TASK_CONTEXTS.md to reflect new state

---

## Phase 4: Activation & Handoff

**After `atris init`, your workspace contains:**

- ✅ `atris.md` (this spec)
- ✅ `PERSONA.md` (agent communication style)
- ✅ `GETTING_STARTED.md` (user guide)
- ✅ `agent_team/navigator.md` (pre-built template)
- ✅ `agent_team/executor.md` (pre-built template)
- ✅ `agent_team/validator.md` (pre-built template)
- ⏳ `MAP.md` (AI agent generates from codebase)
- ⏳ `TASK_CONTEXTS.md` (AI agent generates from MAP)

**Agent Enhancement:**
After MAP.md generation, agents receive project context injection (framework, key dirs, search patterns). This keeps base templates clean while adding project-specific accelerators.

**Agent Behavior Activates Automatically:**

| Trigger | Agent | Action |
|---------|-------|--------|
| "Where is X?" | navigator | Answers with MAP.md:line reference + project patterns |
| "Do task Y" | executor | Extracts context, plans execution, cites file:line |
| After change | validator | Checks validity, updates docs, blocks unsafe changes |
| New agent joins | navigator | Reads MAP.md, immediately productive (no ramp-up) |

**Validation Checklist:**

- [ ] All three agents can read and cite MAP.md
- [ ] navigator answers 5 test questions with exact references
- [ ] executor completes a sample task without regressions
- [ ] validator successfully detects and blocks a breaking change
- [ ] MAP.md is accurate and stays in sync with the system, especially after changes. agents will change.

---

## Phase 5: Daily Workflow

**How the System Operates Day-to-Day:**

1. **Brain Dump** — Run `atris log`, type thoughts into `## Inbox` section (unfiltered, no structure required)

2. **Navigator Reviews** — Processes inbox entries, identifies patterns, creates tasks in TASK_CONTEXTS.md with MAP.md context

3. **Executor Builds** — Takes task → ASCII visualization → get approval → build step-by-step → validate alignment

4. **Validator Reviews** — Ultrathinks (3x) → tests → auto-fixes bugs → cleans up (deletes completed tasks, target: 0) → updates MAP.md → moves log to Completed ✅ → extracts lessons

**Daily Goal:** Inbox zero. All thoughts processed, tasks executed, docs updated.

---

## Phase 6: Future Roadmap (Vision)

**See [`ATRIS_NOTES.md`](./ATRIS_NOTES.md) for full roadmap. Preview:**

- **Phase 5a: Sync** — Local + cloud markdown sync, enabling offline editing and asynchronous agent work
- **Phase 5b: Sessions** — Step-by-step markdown workflows with `!status`, `!result` tags for interactive collaboration
- **Phase 5c: Crew Orchestration** — Multi-agent coordination (codebase expert → executor → validator) from markdown config

---

## Why This Works

1. **MAP = Single Source of Truth** — All agents reference one navigation guide; no contradictions
2. **Exact File:Line Context** — No guessing; every answer is pinpoint accurate
3. **Self-Validating** — @validator_AGENT keeps MAP and artifacts fresh automatically
4. **Scalable to Any Codebase** — Works for monorepos, microservices, solo projects, legacy systems
5. **Agent Handoff** — New agent joins, reads MAP, immediately productive (no ramp-up time)
6. **Offline + Async Ready** — Markdown files work offline; sync on schedule (future Phase 5a)

---

## Implementation Checklist

- [ ] **Install:** `npm install -g atris` (instant)
- [ ] **Init:** `atris init` - creates atris/ with templates (instant)
- [ ] **Phase 1:** AI agent generates MAP.md from codebase (5 min)
- [ ] **Phase 3:** AI agent generates TASK_CONTEXTS.md from MAP (2 min)
- [ ] **Validate:** Test navigator/executor/validator workflows (1 min)
- [ ] **Ongoing:** Run `atris sync` to get template updates

**Total time to full instrumentation: ~8 minutes**

---

## Quick Start

```bash
# Install globally
npm install -g atris

# Initialize in your project
cd /path/to/your/project
atris init

# Hand atris/atris.md to your AI agent with this prompt:
# "Read atris/atris.md. Execute Phase 1-4 to scaffold this system."

# Agent generates MAP.md, agent_team/, and TASK_CONTEXTS.md in atris/
# Your system is now fully instrumented for AI collaboration

# Keep atris.md updated
atris sync
```

---

**Status:** Production ready. Run `atris init` in any project to get:
1. Pre-built agent templates (navigator, executor, validator)
2. AI generates MAP.md from your codebase in <5 minutes
3. AI generates TASK_CONTEXTS.md with exact file:line context
4. Full workflow: activate → plan → build → validate

*Install once. Init anywhere. AI agents have instant context. Codebase becomes fully instrumented for AI collaboration.*
