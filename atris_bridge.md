# atris_bridge — Human + Agent Collaboration System

This document describes the core system that enables humans and AI agents to work together seamlessly through markdown-based intent specification and execution.

---

## Layer 1: HUMAN LAYER

**Purpose:** Messy, conversational space for thinking out loud

**What happens here:**
- Comments, thrown-around ideas, back-and-forth
- Changes over time as understanding evolves
- Casual language, rough notes, uncertainty is fine

**Who writes:** Humans (product managers, engineers, stakeholders)

**Format:** Markdown, unstructured, conversational

**Goal:** Capture intent and direction clearly enough for parsing

**Example:**
```markdown
## Check User Action Limit

- User can only do 100 actions per day
- If they hit the limit, block them
- Maybe show a friendly message?
- Or should we let them queue? No, block for now.
- Also need to track this in analytics
```

---

## The Parser (Bridge) — The Crosshair

**Input:** Human layer (messy intent)

**Process:**
1. Extract key decisions from human layer
2. Organize into structured buckets
3. Generate ASCII visualization (ephemeral, not saved)
4. Show human the crosshair: exact impact, files, flow
5. Ask human to confirm understanding

**Output:** ASCII diagram (shown once, then discarded) + confirmation

**Goal:** "Did I understand what you meant?" — Precision before execution

**The Crosshair Metaphor:**
Like the Half-Life 2 crossbow, the ASCII shows exactly where the shot will land before you pull the trigger. No guessing. No rework. One shot, one kill.

**Example ASCII output:**
```
┌─────────────────────────────┐
│ ACTION LIMIT ENFORCER       │
├─────────────────────────────┤
│ Max actions/day:  100       │
│ When limit hit:   Block     │
│ Notify user:      Yes       │
│ Track analytics:  Yes       │
└─────────────────────────────┘

Blocks users who hit 100 actions/day.
Shows friendly message. Tracked in analytics.
Correct? (y/n)
```

**Human reviews ASCII → confirms or revises → repeat until clear**

**ASCII Visualization Patterns (covers 99% of dev work):**

1. **Frontend (UI components):**
```
┌─────────────────────────────────┐
│ HERO SECTION                    │
├─────────────────────────────────┤
│  [Headline Text]                │
│  Subheadline here               │
│  [ CTA Button ]  [ Link ]       │
│  <--------Image--------->       │
└─────────────────────────────────┘
Components: hero.tsx, button.tsx
```

2. **Backend (logic flow):**
```
Request → Middleware → Handler → Database
   ↓          ↓           ↓          ↓
 Auth    Rate Limit   Validate   Query
         (new)
Files: route.ts:45, middleware.ts (new)
```

3. **Database (schema/tables):**
```
┌────────────────────────────────┐
│ users table                    │
├────────────────────────────────┤
│ rate_limit  | int (NEW) ←      │
└────────────────────────────────┘
Migration: add column rate_limit
```

**Important:** ASCII is ephemeral. Generated on-demand from idea.md. Not stored in any file.

---

## Layer 2: AGENT LAYER

**Purpose:** Clean, technical, token-efficient instructions for execution

**What happens here:**
- Parsed intent with exact technical specifications
- Types, preconditions, steps, error cases
- Single source of truth for what to build

**Who reads:** AI agents (any model, cheap or expensive)

**Format:** Structured markdown with semantic markers

**Goal:** Unambiguous execution — any agent can read and build this perfectly

**Example:**
```markdown
## check_action_limit

input: { user_id: string, action_type: string }
output: { allowed: boolean, remaining: number, message: string }

preconditions:
  - user exists in DB
  - action type is valid

steps:
  1. Query today's action count for user
  2. If count >= 100 → allowed: false, message: "Daily limit reached"
  3. If count < 100 → allowed: true, remaining: 100 - count

side_effects:
  - Writes to analytics table
  - Updates user action counter

error_cases:
  - user_id invalid → return 401
  - action_type invalid → return 400
```

---

## The Execution Loop

```
Human writes (messy)
    ↓
Parser organizes → ASCII visualization
    ↓
Human confirms ("yep, that's it")
    ↓
Parser silently generates agent layer (no human sees this)
    ↓
Agent reads agent layer → executes one step at a time
    ↓
For each step:
    • Show ASCII result
    • Human confirms ("ready for next?")
    ↓
All steps complete
    ↓
Show final ASCII summary
    ↓
Human approves ("ship it")
    ↓
Agent updates (MAP.md, TODO.md, suggests next)
```

**Key:** Human only sees two things:
1. Initial ASCII confirmation of intent (from parser)
2. ASCII of each execution step (one at a time)

Everything else (parsing, agent layer generation) happens silently.

---

## The Separation of Concerns

| Who | What | How | Why |
|-----|------|-----|-----|
| **Human** | Think, ideate, approve | Human layer (conversation) | Direction, taste, judgment |
| **Parser** | Understand intent | Extract + visualize in ASCII | Bridge gap, reduce ambiguity |
| **Agent** | Execute technically | Read agent layer + code | Speed, precision, repeatability |
| **Reviewer** | Confirm execution | ASCII checklist | Verification before approval |

---

## The Magic

**Intent is clear**
- ASCII visualizations remove ambiguity upfront
- Multiple confirmation points before building

**Execution is deterministic**
- Agent layer so clean that any model can execute perfectly
- No guessing, no rework

**No surprises**
- Multi-confirm before do stage prevents costly mistakes
- System moves fast because it moves smart

**Docs stay fresh**
- Agent auto-updates everything after approval
- MAP.md, TODO.md, next steps all in sync

**System evolves**
- Human modifies agent layer (or parser regenerates from human layer)
- Agent regenerates code
- Docs update automatically
- Feedback loop keeps system current

---

## The Critical Transformations

**1. idea.md → ASCII (Understanding)**
- Parser reads messy human text
- Extracts: what, why, how, files, impact
- Generates ASCII crosshair: "Is THIS what you meant?"
- Human confirms or revises

**2. idea.md + confirmation → build.md (Precision)**
- Takes confirmed intent
- Generates exact technical spec
- Files, steps, types, errors, tests
- Deterministic: same input = same output

**The magic:** If we nail these two parsers, everything else is execution.

## Key Principles

1. **The crosshair is everything** — Show exactly what will happen before executing (one shot, one kill)
2. **ASCII is ephemeral** — Generated on-demand, shown for confirmation, then discarded
3. **idea.md can be messy** — Parser's job is to extract intent and clarify through ASCII
4. **build.md is deterministic** — Agent layer is so precise that any model executes perfectly
5. **Free-flow still flows through framework** — Every conversation (structured or exploratory) goes through plan → do → review
6. **One source of truth** — idea.md (human intent) + build.md (execution plan) + code (implementation)

---

**Status:** Architecture finalized. The crosshair is the product. One shot, one kill.
