# Atris Engineering Acceleration Cycle

**The complete workflow from idea to launch**

---

## 🎯 The Cycle

```
atris init → atris brainstorm → atris plan → atris do → atris review → atris launch
```

---

## 1. `atris init` - Setup & Architecture Atlas

**Goal:** Perfect instructions + MAP.md as ongoing codebase atlas

**Requirements:**
- **Super clear setup instructions** - guide users through architecture decisions
- **MAP.md generation** - spot-on, ongoing process
- **Gets right context** for important codebase elements
- **Acts as atlas** for any coding agent (ongoing reference)

**Implementation Notes:**
- Init should walk through architecture questions
- Generate initial MAP.md template that gets populated
- MAP.md should be updated over time as codebase evolves
- Must capture: structure, patterns, key files, relationships

---

## 2. `atris agent` - Premium Feature

**Goal:** For paying users - agent selection and management

**Status:** ✅ Working (legacy, can modularize later)

---

## 3. `atris brainstorm` - Vision First

**Goal:** Generate editor prompt, start with story/vision, then uncover what to build

**Current Flow:**
- ✅ Loads journal context
- ✅ Starts with story ("what should world experience?")
- ✅ Then constraints, possibilities
- ✅ Generates prompt

**Needs:**
- **Generate prompt FOR coding editor** (not just copy-paste)
- Should open in editor or provide editor-ready format
- Story-first approach already implemented ✅
- Journal loading already implemented ✅

**Format:**
```
Step 1: Story
- What should users experience?
- What are constraints/possibilities?

Step 2: Brainstorm
- Uncover what needs to be built
- Load journal context automatically
```

---

## 4. `atris plan` - Systems Player Task List

**Goal:** Break brainstorm output into perfect, manageable task list

**Requirements:**
- **So good a "systems player" follows it perfectly**
- **It will be done** - tasks are actionable and complete
- **Take time here** - quality over speed
- **Generate instruction prompt** for the system
- **Load journal context**
- **Visualizations for user approval:**
  - Logic flows
  - DB table structures
  - Architecture diagrams
  - UI flows

**Output:**
- Perfect task list in TASK_CONTEXTS.md
- Visual diagrams (ASCII or generate images)
- User approves before execution

---

## 5. `atris do` - Precision Execution

**Goal:** Get it done, precisely, follows instructions perfectly

**Requirements:**
- **Single-shot mode** - go to completion automatically
- **Step-by-step mode** - user controls pace
- **Precise execution** - follows plan perfectly
- **User comfort level** - choose mode based on confidence

**Implementation:**
- Read TASK_CONTEXTS.md
- Execute tasks in order
- Report progress
- Option to pause/resume

---

## 6. `atris review` - Auto-Validate & Iterate

**Goal:** Auto-activate after `do`, iterate until perfect, then human testing

**Requirements:**
- **Auto-activates** after `atris do` completes
- **Iterates** - `atris review → atris do → atris review` loop
- **Continues until:** `atris review` says "✅ All good. Ready for human testing."
- **Runs tests automatically:**
  - Unit tests
  - Integration tests
  - Linting
  - Type checking
  - Unless user specifies not to

**Flow:**
```
do → review → [issues found] → do → review → [issues found] → do → review → ✅ Ready
```

**Output:**
- Test results
- Lint results
- Issues found
- Recommendations
- Final approval: "Ready for human testing"

---

## 7. `atris launch` - Ship It

**Goal:** Document, clean, push, celebrate

**Requirements:**
- **Documents updates** in journal
- **Updates relevant docs** (README, API docs, etc.)
- **Cleans up BS** - remove temp files, unused code, etc.
- **Pushes to GitHub** automatically
- **Optional:**
  - Update changelog
  - Update blog section (if present)
  - Write **7 sentences max** essay on what was shipped

**Output:**
- Clean codebase
- Updated docs
- Git commit + push
- Optional: Changelog/blog update
- Celebration message

---

## 🎯 The Full Vision

This is **the acceleration for engineering**.

**From idea to shipped feature** in one clean cycle:

1. **Init** - Perfect setup with ongoing codebase atlas
2. **Brainstorm** - Vision-first, uncover what to build
3. **Plan** - Systems-player perfect task breakdown
4. **Do** - Precision execution
5. **Review** - Auto-validate and iterate until perfect
6. **Launch** - Ship it clean

**Result:** Engineering velocity × 10

---

## 📋 Implementation Priorities

### For Demo:
- ✅ `atris init` - Works, needs better instructions
- ✅ `atris brainstorm` - Works, needs editor prompt output
- ⚠️ `atris plan` - Exists, needs visualization + approval gates
- ⚠️ `atris do` - Exists, needs single-shot/step modes
- ⚠️ `atris review` - Exists, needs auto-activation + iteration loop
- ⚠️ `atris launch` - Exists, needs automation + cleanup

### Post-Demo:
- MAP.md ongoing generation
- Editor prompt integration
- Visual diagram generation
- Test automation in review
- GitHub automation in launch
- Changelog/blog updates

---

**This is the full cycle. This is the acceleration.**

