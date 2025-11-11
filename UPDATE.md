# Updating All Your ATRIS Installations

ATRIS v1.8.0 includes major improvements:
- New crosshair system (idea.md → ASCII → build.md)
- Simplified CLI (11 core commands)
- Auto-maintained features/README.md
- Updated agent specs (navigator, executor, validator)

---

## How to Update All Projects

### Step 1: Update the global package

```bash
npm update -g atris
```

Or reinstall:
```bash
npm install -g atris
```

Verify version:
```bash
atris version
# Should show: 1.8.0
```

---

### Step 2: Update each project

Go to each project where you use ATRIS:

```bash
cd /path/to/your/project
atris update
```

This syncs:
- `atris/atris.md` (latest spec)
- `atris/agent_team/*.md` (updated agent instructions)
- `atris/PERSONA.md` (if changed)
- `atris/GETTING_STARTED.md` (if changed)

---

### Step 3: Create features README (one-time)

In each project:

```bash
mkdir -p docs/features
touch docs/features/README.md
```

Add this content:
```markdown
# Features

This file tracks all features built in this project. Auto-updated by validator after each feature ships.

---

## Features Built

*Features will appear here as you build them.*
```

---

## What Changed in v1.8.0

**CLI:**
- Removed: brainstorm, autopilot, launch, console, mode, activate
- Kept: 11 core commands (init, log, status, analytics, visualize, plan, do, review, agent, chat, login)
- Cleaned up 247 lines of dead code

**Agent Specs:**
- navigator.md → Now generates idea.md + build.md, shows ASCII crosshair
- executor.md → Executes from build.md one step at a time
- validator.md → Auto-updates docs/features/README.md

**File Structure:**
- docs/features/README.md → Feature index (auto-maintained)
- docs/features/[name]/idea.md → Human intent
- docs/features/[name]/build.md → Technical spec

---

## Backward Compatibility

Old projects still work. The update is additive:
- TASK_CONTEXTS.md still works (will be phased out)
- Old commands removed, but core workflow unchanged
- New features/README.md is optional but recommended

---

## Questions?

- GitHub Issues: https://github.com/atrislabs/atris.md/issues
- Run `atris help` to see all commands
