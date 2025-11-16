# TASK_CONTEXTS.md

> **Last updated:** 2025-11-05

---

## Purpose

This file tracks **active tasks** for parallel agent/human work. Navigator creates tasks in Backlog, agents claim them to In Progress, validator cleans them up after completion.

**Rule:** Target state = 0 tasks. Tasks flow: Backlog → In Progress → Completed (deleted).

---

## Backlog

### T-034: Dashboard Performance Optimization — Lazy Loading & Render Optimization
- **Complexity:** Moderate
- **Scope:**
  - Files touched: 3
  - Lines affected: ~50
  - Dependencies: None
- **Context Files:**
  - `atrisos-web/app/dashboard/page.tsx:11,135-167,354,402,16,466` (CinematicOnboarding import, profile fetch, PersonalizedSessions import)
  - `atrisos-web/app/dashboard/components/TodoDisplay.tsx:69-78` (polling logic)
  - `atrisos-web/app/components/dashboard/MandatoryOnboardingCard.tsx:62-81` (motion animations)
  - `atris_team/atris/logs/2025/2025-11-05.md:165-354` (brainstorm session with full optimization plan)
- **Goal:** Reduce dashboard load time from ~500-800ms to <100ms through lazy loading and render optimization
- **Current Performance:**
  - CinematicOnboarding eagerly loaded (2500+ lines)
  - Profile fetch blocks render (143ms+)
  - TodoDisplay polls every 5s regardless of visibility
  - Framer-motion animations expensive on mount
- **Optimizations:**
  1. Lazy load CinematicOnboarding (only when `selectedConfig !== null`)
  2. Defer profile fetch (non-blocking, show dashboard immediately)
  3. IntersectionObserver for TodoDisplay (only poll when visible)
  4. Remove motion from initial render (`initial={false}`)
  5. Lazy load PersonalizedSessions (on-demand)
- **Execution Plan:**
  1. Replace CinematicOnboarding import with `React.lazy()` + `Suspense` wrapper
  2. Change profile fetch from blocking to non-blocking (set `loadingProfile = false` immediately)
  3. Add IntersectionObserver to TodoDisplay, only poll when `isVisible === true`
  4. Add `initial={false}` to MandatoryOnboardingCard motion.div
  5. Replace PersonalizedSessions import with `React.lazy()` + `Suspense` wrapper
- **Success Criteria:**
  - Dashboard renders <100ms (from ~500-800ms)
  - CinematicOnboarding not in initial bundle (check Network tab)
  - Profile fetch doesn't block render (dashboard visible immediately)
  - TodoDisplay only polls when visible (check Network tab)
  - Motion animations don't run on initial render
  - No functionality broken (test: refresh, scroll, start session)
- **Dependencies:** None
- **Risk Level:** Low
  - Blast radius: Performance optimizations only, no functionality changes
  - Test coverage: Manual QA (refresh dashboard, scroll, start session, check Network tab)
  - Rollback: Easy (revert to eager imports)

---


---

## In Progress

(No tasks in progress)

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
