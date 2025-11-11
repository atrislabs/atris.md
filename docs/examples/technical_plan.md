# Agent Layer Plan — Technical Execution Specifications

This document contains technical agent layer specifications extracted from human intent. These are token-efficient, unambiguous execution plans that any AI agent (cheap or expensive) can read and execute perfectly.

---

## Example 1: Bidirectional Journal Sync (Feature)

### Agent Layer Specification

```markdown
## bidirectional_journal_sync

files_touched:
  - commands/log-sync.js (new file)
  - lib/sync-engine.js (new file)
  - ~/.atris/.sync_state.json (metadata)
  - bin/atris.js (add sync trigger to log command)

input: user action (edit on web OR edit in CLI)
output: synchronized journal state (both sides match)

preconditions:
  - user authenticated (valid token in ~/.atris/credentials.json)
  - journal files exist locally
  - network available (or queue locally)

architecture:
  1. Detect sync trigger (web save OR cli exit)
  2. Check .sync_state.json for last sync timestamp
  3. Fetch latest from server
  4. Compare timestamps (local vs remote)
  5. If conflict → show ASCII prompt, human picks
  6. Merge selected version
  7. Update .sync_state.json with new timestamp
  8. If offline → queue in memory, sync on reconnect

steps:
  1. Create sync-engine.js with conflict detection logic
  2. Create log-sync.js command for manual/auto sync
  3. Add token refresh logic to handle expired auth
  4. Add sync trigger to log command exit
  5. Create .sync_state.json metadata file
  6. Add error handling for network failures
  7. Add offline queue persistence
  8. Test with simultaneous edits

error_cases:
  - token expired → refresh or prompt re-login
  - network down → queue locally, retry on reconnect
  - simultaneous edits → show conflict, human chooses
  - corrupted state file → reset and resync
  - permission denied → 401, guide to login

side_effects:
  - Creates new files (log-sync.js, sync-engine.js)
  - Modifies bin/atris.js (add sync hook)
  - Creates/updates .sync_state.json
  - Network calls to sync server

test_cases:
  - Edit on web, verify CLI updates
  - Edit on CLI, verify web updates
  - Simultaneous edits, verify conflict resolution
  - Offline mode, verify queue persistence
  - Token expiry, verify refresh flow
  - Network failure, verify retry logic
  - Corrupted state file, verify reset
  - Empty journal, verify initialization

performance_targets:
  - Sync latency: < 2 seconds
  - Conflict detection: < 100ms
  - Offline queue: unlimited entries
  - Token refresh: automatic, non-blocking

security_requirements:
  - Token validation on every sync request
  - HTTPS only for network calls
  - State file permissions: 0600 (owner read/write only)
  - No credentials in sync state file
```

---

## Example 2: Fix Timezone Bug (Bug Fix)

### Agent Layer Specification

```markdown
## fix_timezone_bug

problem: Analytics command uses UTC, journal uses local timezone
impact: Date mismatch causes confusion (log today, shows tomorrow in analytics)
severity: Medium (affects reporting accuracy)
type: bug_fix

files_to_check:
  - commands/analytics.js (date calculations)
  - lib/file-ops.js (getLogPath function)
  - bin/atris.js (any date handling)

root_cause:
  - commands/analytics.js:67 uses new Date().toISOString() (returns UTC)
  - journal uses local timezone throughout
  - mismatch at timezone boundaries (11pm local = next day UTC)

steps:
  1. Identify all Date objects using UTC
  2. Replace with local timezone equivalents
  3. Add comments explaining timezone strategy
  4. Test with edge case (11pm local = next day UTC)
  5. Verify analytics matches journal dates
  6. Update MAP.md if any functions changed

specific_changes:
  - commands/analytics.js:67
    before: new Date().toISOString().split('T')[0]
    after: new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
    reason: match journal's local timezone
  - commands/analytics.js:10-15 (add comment block)
    content: |
      // Timezone Strategy: Use local timezone everywhere
      // Journal files are organized by local date (YYYY-MM-DD.md)
      // Analytics must match journal dates to avoid confusion
      // Use toLocaleDateString('en-CA') for consistent YYYY-MM-DD format
  - lib/file-ops.js: verify getLogPath uses local (no change needed)

tests:
  - Run analytics at 11:55pm local (before UTC boundary)
  - Verify date matches today's journal, not tomorrow
  - Run analytics at 12:05am local (after UTC boundary)
  - Verify date matches today's journal, not yesterday
  - Check all commands for timezone consistency

error_cases:
  - Different timezones on CI → use user's local timezone, not system
  - Daylight saving transitions → JavaScript handles automatically
  - Invalid date format → graceful fallback to ISO format

validation:
  - All existing tests pass
  - New timezone tests added
  - No breaking changes
  - Analytics output matches journal dates exactly

performance:
  - No performance impact (both methods O(1))
  - toLocaleDateString() is native, highly optimized

documentation:
  - Add timezone strategy comment in analytics.js
  - Update MAP.md with timezone note if relevant
  - No user-facing docs needed (transparent fix)
```

---

## Example 3: Add ASCII-First Output to Status Command (Enhancement)

### Agent Layer Specification

```markdown
## enhance_status_output_ascii

input: today's journal state (inbox, backlog, in progress, completed counts)
output: ASCII box + 3-4 sentence explanation
type: enhancement

preconditions:
  - journal file exists (or handle empty state gracefully)
  - sections parseable (## Inbox, ## Backlog, ## In Progress, ## Completed)

files_to_modify:
  - commands/status.js (entire output format)

steps:
  1. Read today's journal file (use getLogPath from file-ops)
  2. Parse markdown sections (## Inbox, ## Backlog, etc)
  3. Count items in each section (regex: /^- \*\*[ICT]\d+:/)
  4. Build ASCII box with counts
  5. Add conditional warnings/celebrations
  6. Generate 3-4 sentence summary
  7. Display and exit

ascii_box_format:
  ┌─────────────────┐
  │ TODAY'S STATE   │
  ├─────────────────┤
  │ Inbox: N        │
  │ Backlog: N      │
  │ In Progress: N  │
  │ Completed: N    │
  └─────────────────┘

logic_rules:
  - if inbox >= 7 → add 📌 warning emoji
  - if completed > 0 → add ✓ celebration
  - if in_progress > 0 → add 🔄 indicator
  - if all counts == 0 → show "No activity yet"

summary_tone:
  - Matter-of-fact (state what's happening)
  - Encouraging (celebrate progress)
  - Actionable (suggest next step if needed)

example_outputs:
  - High inbox:
    "📌 7 ideas waiting in Inbox. 2 tasks ready to build. Run 'atris plan' to process."
  - Completions today:
    "✓ 3 tasks completed today. 5 still in backlog. Keep the momentum going!"
  - Empty state:
    "No activity yet. Run 'atris log' to start logging your thoughts."
  - Normal state:
    "2 ideas in Inbox. 1 task in progress. Run 'atris do' to claim another task."

implementation:
  - Use existing parseJournalSections() helper (if exists, or create)
  - Reuse ASCII box drawing patterns from other commands
  - Keep function under 50 lines (simple, focused)

error_cases:
  - no journal file → show "No activity yet. Run 'atris log' to start"
  - parse error → show counts as 0, add note "(unable to parse journal)"
  - permission error → show error, suggest checking file permissions

tests:
  - Empty journal → shows "No activity yet"
  - Inbox >= 7 → shows warning emoji
  - Completed > 0 → shows celebration
  - All sections populated → shows correct counts
  - Parse error → graceful fallback

validation:
  - Output matches ASCII-first philosophy
  - 3-4 sentences max after box
  - Tone is encouraging, not overwhelming
  - All edge cases handled gracefully

performance:
  - File read: synchronous (journal files are small, < 100KB)
  - Parse time: < 50ms for typical journal
  - Output rendering: instant (terminal I/O)
```

---

## Agent Layer Patterns & Best Practices

### Structure Template

Every agent layer spec should include:

1. **Function/Feature Name** — Clear identifier (snake_case)
2. **Type** — feature | bug_fix | enhancement | refactor
3. **Files Touched** — Exact paths, mark new vs modified
4. **Input/Output** — What goes in, what comes out
5. **Preconditions** — What must be true before execution
6. **Steps** — Numbered, sequential, actionable
7. **Error Cases** — Explicit handling for failures
8. **Side Effects** — File system, network, state changes
9. **Tests** — Coverage requirements
10. **Validation** — Success criteria

### Token Efficiency Guidelines

**Do:**
- Use structured sections with clear headers
- Keep steps numbered and concise
- Use code snippets for exact changes
- Cite line numbers and file paths
- List error cases explicitly

**Don't:**
- Write verbose explanations (save for human layer)
- Repeat information across sections
- Include unnecessary background/context
- Use ambiguous language ("maybe", "should", "could")
- Leave implicit assumptions unstated

### Execution Guarantees

Agent layer specs must be:
- **Deterministic** — Same input → same output
- **Complete** — No missing information
- **Unambiguous** — One clear interpretation
- **Testable** — Success/failure is measurable
- **Reversible** — Changes can be rolled back

### Multi-Step Execution

For complex features with 5+ steps:
- Break into phases (e.g., Step 1/8, Step 2/8)
- Each step has its own validation
- Show ASCII progress after each step
- Allow human confirmation between steps
- Provide rollback instructions if step fails

### Error Handling Requirements

Every agent layer must specify:
- All expected error cases
- Graceful degradation strategy
- User-facing error messages
- Logging/debugging output
- Recovery steps

---

## How to Use This Document

**For Agents Executing Tasks:**
1. Read the agent layer spec (this document)
2. Parse the structure (files, steps, error cases)
3. Execute one step at a time
4. Show ASCII progress after each step
5. Handle errors per the error_cases section
6. Validate output matches success criteria
7. Report completion with final ASCII summary

**For Agents Generating Agent Layers:**
1. Read human layer input
2. Extract intent, files, constraints
3. Structure as agent layer spec (follow template)
4. Include all required sections
5. Be explicit, unambiguous, complete
6. Output in markdown format
7. Show ASCII confirmation to human before proceeding

**For Humans Reviewing Agent Layers:**
- Check that steps match intent from human layer
- Verify error cases cover edge cases
- Ensure tests validate the feature
- Confirm side effects are acceptable
- Approve or request revisions

---

**Status:** Agent layer specifications ready for execution. Any agent can now read these specs and build the features deterministically.
