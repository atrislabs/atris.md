# TASK_CONTEXTS.md

> **Last updated:** 2025-10-22

---

## Purpose

This file tracks **active tasks** for parallel agent/human work. Navigator creates tasks in Backlog, agents claim them to In Progress, validator cleans them up after completion.

**Rule:** Target state = 0 tasks. Tasks flow: Backlog → In Progress → Completed (deleted).

---

## Backlog

(Unclaimed tasks ready for execution)

(No active tasks)

---

## In Progress

(Tasks currently being worked on - claim by moving from Backlog + add your name/timestamp)

Format: `**Claimed by:** [Agent/Name] at [Time]`

---

## Instructions

**Navigator:** Extract ideas from `logs/YYYY/YYYY-MM-DD.md` Inbox section → create task in Backlog with context (file:line refs from MAP.md)

**Executor (claiming):**
1. Pick task from Backlog
2. Move to "In Progress" section
3. Add: `**Claimed by:** [Your Name/Agent] at [Timestamp]`
4. Build the task
5. When done, leave in "In Progress" for validator

**Validator:** After completion → update MAP.md → add journal timestamp → **delete task entirely from this file**

**Parallel work:** Multiple agents can work simultaneously. Each claims different tasks. First to move task to "In Progress" owns it.

---

**Target state:** Empty. Tasks flow: Backlog → In Progress (claimed) → Completed (deleted). File should return to 0.
