# Getting Started with ATRIS

Welcome! ATRIS transforms your system (codebase, product, sales process, etc.) into an AI-navigable workspace in under 10 minutes.

## What Just Happened?

You ran `atris init` and got this folder structure:

```
atris/
├── GETTING_STARTED.md (you are here!)
├── PERSONA.md (agent communication style)
├── atris.md (instructions for your AI agent)
├── MAP.md (AI generates from your codebase)
├── TASK_CONTEXTS.md (AI generates from MAP)
└── agent_team/
    ├── navigator.md (pre-built template, ready to use)
    ├── executor.md (pre-built template, ready to use)
    └── validator.md (pre-built template, ready to use)
```

## Quick Start (3 Steps)

### Step 1: Open atris.md
Open `atris/atris.md` in your editor. This file contains detailed instructions for your AI agent.

### Step 2: Paste to Your AI Agent
Copy the entire contents of `atris.md` and paste it to Claude Code, Cursor, Windsurf, or your favorite AI coding assistant with this prompt:

```
Read atris.md. Generate MAP.md and TASK_CONTEXTS.md for this project.
```

### Step 3: Watch the Magic
Your AI agent will:
- Scan your project and generate `MAP.md` (a navigation guide with file:line references)
- Generate `TASK_CONTEXTS.md` with actionable tasks extracted from your system
- Optionally inject project-specific context into the pre-built agent templates

**Agent templates ship ready to use:**
- **navigator.md** - Answers "where is X?" questions
- **executor.md** - Executes tasks with full context
- **validator.md** - Validates changes and updates docs

**Total time: ~5 minutes**

## Load the context (no login required)

At any point—before or after your AI agent runs—you can load the local context with:

```bash
atris activate
```

This shows today's journal, MAP.md, and TASK_CONTEXTS.md so you can browse and take notes offline. Authentication and agent selection are only required when you want to use `atris chat` with Atris cloud agents.

## Try the autopilot loop (optional)

Need a guided work session? Run:

```bash
atris autopilot
```

You'll pick a vision (from today's Inbox or a fresh idea), define success criteria, and then step through plan → do → review cycles. The CLI logs each iteration, and you can type `exit` at any prompt to stop.

## Launch a brainstorm (optional)

Need help shaping an idea before it becomes a task? Run:

```bash
atris brainstorm
```

Answer a couple quick questions, get a ready-to-send Claude Code conversation starter (context + ASCII cue), and choose whether to log the session summary and next steps.

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

## Keeping ATRIS Updated

When the ATRIS package updates with new features:

```bash
cd /path/to/your/project
atris update
```

This syncs your local `atris.md` and agent templates to the latest version. Re-run your AI agent to regenerate MAP.md with the new spec.

## What's Next?

1. **Let your AI agent generate MAP.md** (Step 2 above if you haven't already)
2. **Explore MAP.md** - Get familiar with your system's structure
3. **Try the pre-built agents** - Ask navigator questions, run executor tasks
4. **Pick a task** - Check TASK_CONTEXTS.md for quick wins

## Need Help?

- **Full spec:** Read `atris.md` for technical details
- **Issues:** https://github.com/atrislabs/atris.md/issues
- **Docs:** https://github.com/atrislabs/atris.md

---

**Ready?** Open `atris.md` and paste it to your AI agent. Watch your system become fully instrumented for AI collaboration.
