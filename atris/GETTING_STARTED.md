# Getting Started with ATRIS

Welcome! ATRIS transforms your system (codebase, product, sales process, etc.) into an AI-navigable workspace in under 10 minutes.

## What Just Happened?

You ran `atris init` and got this folder structure:

```
atris/
├── GETTING_STARTED.md (you are here!)
├── atris.md (instructions for your AI agent)
├── MAP.md (placeholder - will be populated)
├── TASK_CONTEXTS.md (placeholder - will be populated)
└── agent_team/
    ├── navigator.md (placeholder - will be populated)
    ├── executor.md (placeholder - will be populated)
    └── validator.md (placeholder - will be populated)
```

## Quick Start (3 Steps)

### Step 1: Open atris.md
Open `atris/atris.md` in your editor. This file contains detailed instructions for your AI agent.

### Step 2: Paste to Your AI Agent
Copy the entire contents of `atris.md` and paste it to Claude Code, Cursor, Windsurf, or your favorite AI coding assistant with this prompt:

```
Read atris.md. Execute Phase 1-4 to scaffold this system.
```

### Step 3: Watch the Magic
Your AI agent will:
- Scan your project and generate `MAP.md` (a navigation guide with file:line references)
- Create 3 specialized agents in `agent_team/`:
  - **navigator.md** - Answers "where is X?" questions
  - **executor.md** - Executes tasks with full context
  - **validator.md** - Validates changes and updates docs
- Generate `TASK_CONTEXTS.md` with actionable tasks extracted from your system

**Total time: ~10 minutes**

## What Each File Does

### MAP.md
Your system's navigation guide. Contains:
- Quick reference index (grep-friendly shortcuts)
- Feature map (where is feature X?)
- Architecture map (where is concern Y?)
- Critical files (high-impact areas)
- Entry points

**Use it:** When you need to find something fast or onboard new people

### agent_team/navigator.md
Your "where is X?" expert. Ask it questions like:
- "Where is the authentication logic?"
- "Show me all API endpoints"
- "Where do we handle file uploads?"

Always cites MAP.md with exact file:line references.

### agent_team/executor.md
Your task runner. Give it work like:
- "Add authentication to the upload endpoint"
- "Fix the bug in user registration"
- "Refactor the payment flow"

Reads MAP.md, plans execution with file:line references, executes step-by-step.

### agent_team/validator.md
Your quality gatekeeper. Runs after changes to:
- Check for breaking changes
- Update MAP.md if structure changed
- Run tests and type checks
- Report risks

### TASK_CONTEXTS.md
Auto-generated task bank with:
- Task complexity (Trivial → Epic)
- Exact file:line references
- Execution plans
- Risk assessments
- Dependencies

**Use it:** Pick tasks, assign to agents, track progress

## Using Your Agents

Once the files are populated, you can interact with your agents:

**Ask the navigator:**
```
@navigator where is the user authentication logic?
```

**Give tasks to the executor:**
```
@executor add rate limiting to the API (see TASK_CONTEXTS.md T-005)
```

**Validate changes:**
```
@validator check if the recent auth changes are safe to merge
```

## Try the autopilot loop (optional)

Need a guided work session? Run:

```bash
atris autopilot
```

Pick a vision (today's Inbox or a fresh idea), set success criteria, and follow the guided plan → do → review cycles. Each iteration gets logged, and you can type `exit` at any prompt to stop.

## Launch a brainstorm (optional)

Need to shape an idea before creating tasks? Run:

```bash
atris brainstorm
```

Answer a couple quick questions, generate a Claude Code-ready conversation starter (context + ASCII cue), and optionally log the brainstorm summary with next steps.

## Keeping ATRIS Updated

When the ATRIS package updates with new features:

```bash
cd /path/to/your/project
atris update
```

This syncs your local `atris.md` to the latest version. Re-run your AI agent to regenerate files with the new spec.

## What's Next?

1. **Let your AI agent populate the files** (Step 2 above if you haven't already)
2. **Explore MAP.md** - Get familiar with your system's structure
3. **Try the agents** - Ask navigator questions, run executor tasks
4. **Pick a task** - Check TASK_CONTEXTS.md for quick wins

## Need Help?

- **Full spec:** Read `atris.md` for technical details
- **Issues:** https://github.com/atrislabs/atris.md/issues
- **Docs:** https://github.com/atrislabs/atris.md

---

**Ready?** Open `atris.md` and paste it to your AI agent. Watch your system become fully instrumented for AI collaboration.
