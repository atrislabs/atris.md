# Backend Analytics Task — Journal Parsing & Metrics API

**Drop this into your backend ATRIS journal Inbox section, then run `atris plan`**

---

## Context

The CLI ships `atris analytics` command that parses journal markdown locally to show productivity metrics (completion velocity, inbox trends, productivity hours). This unlocks **$10M ARR enterprise opportunity** by proving AI agent ROI with measurable performance data.

**The Enterprise Play:** CIOs need to justify AI spend. Our journal = their ROI dashboard. "Agent team completed 47 tasks this week, velocity up 3x" = measurable savings they can show executives.

**Current State:**
- CLI parses locally (atris_team/bin/atris.js:1982-2116)
- Journal syncs to backend via `PUT /agents/{id}/journal/{date}`
- Backend stores raw markdown in `journals` table (or similar)
- Dashboard has no analytics view yet

**Goal:** Backend parses journals on sync → stores structured metrics → dashboard queries metrics table → enterprise customers see beautiful performance scoreboard.

---

## The Pareto Approach (20% work, 80% value)

**What Backend Needs to Do:**

1. **Add metrics table** - Store parsed daily metrics (date, agent_id, completion_count, inbox_count, velocity, hourly_activity_json)

2. **Parse on journal sync** - When `PUT /agents/{id}/journal/{date}` receives markdown, extract patterns and write to metrics table

3. **Expose metrics API** - `GET /agents/{id}/analytics?range=7d` returns pre-computed JSON for dashboard

4. **Keep markdown as source of truth** - Metrics are derivative. If user re-syncs old journal, metrics recalculate.

---

## Implementation Steps

### Step 1: Create Metrics Table Schema

```sql
CREATE TABLE agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  date DATE NOT NULL,
  completion_count INTEGER DEFAULT 0,
  inbox_count INTEGER DEFAULT 0,
  velocity DECIMAL(5,2), -- 7-day rolling average
  hourly_activity JSONB, -- {0: 2, 1: 5, 2: 8, ...}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

CREATE INDEX idx_agent_metrics_agent_date ON agent_metrics(agent_id, date);
```

### Step 2: Port Parsing Logic from CLI

**Reference Implementation:** CLI parsing logic at `atris_team/bin/atris.js:2019-2052`

**Patterns to Extract:**
- Completions: `- **C\d+:` in `## Completed ✅` section
- Inbox items: `- **I\d+:` in `## Inbox` section
- Timestamps: `**HH:MM:SS**` in `## Timestamps` section

**Parsing Function (pseudocode):**

```javascript
function parseJournalMetrics(markdownContent) {
  // Count completions
  const completionMatches = markdownContent.match(/- \*\*C\d+:/g);
  const completionCount = completionMatches ? completionMatches.length : 0;

  // Count inbox items
  const inboxMatch = markdownContent.match(/## Inbox\n([\s\S]*?)(?=\n##|---)/);
  let inboxCount = 0;
  if (inboxMatch && inboxMatch[1].trim()) {
    const inboxMatches = inboxMatch[1].match(/- \*\*I\d+:/g);
    inboxCount = inboxMatches ? inboxMatches.length : 0;
  }

  // Parse timestamps for hourly activity
  const timestampMatches = markdownContent.match(/\*\*(\d{2}):(\d{2}):(\d{2})\*\*/g);
  const hourlyActivity = {};
  if (timestampMatches) {
    timestampMatches.forEach(ts => {
      const hour = parseInt(ts.match(/\d{2}/)[0]);
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });
  }

  return {
    completionCount,
    inboxCount,
    hourlyActivity
  };
}
```

### Step 3: Hook Into Journal Sync Endpoint

**Location:** Find your existing `PUT /agents/{agent_id}/journal/{date}` handler

**Add After Saving Markdown:**

```javascript
// Existing code saves markdown to journals table
await saveJournalToDatabase(agentId, date, markdownContent);

// NEW: Parse and store metrics
const metrics = parseJournalMetrics(markdownContent);

// Calculate 7-day velocity (query last 7 days of metrics)
const velocity = await calculate7DayVelocity(agentId, date);

await upsertMetrics({
  agent_id: agentId,
  date: date,
  completion_count: metrics.completionCount,
  inbox_count: metrics.inboxCount,
  velocity: velocity,
  hourly_activity: metrics.hourlyActivity
});
```

### Step 4: Add Analytics API Endpoint

**New Endpoint:** `GET /agents/{agent_id}/analytics`

**Query Parameters:**
- `range` - Number of days (default: 7)
- `start_date` - Optional start date
- `end_date` - Optional end date

**Response Format:**

```json
{
  "agent_id": "uuid",
  "range_days": 7,
  "summary": {
    "total_completions": 47,
    "avg_velocity": 6.7,
    "inbox_trend": "shrinking",
    "most_productive_hour": "14:00-15:00"
  },
  "daily_breakdown": [
    {
      "date": "2025-10-22",
      "completions": 12,
      "inbox": 3,
      "velocity": 6.7,
      "hourly_activity": {"14": 8, "15": 5}
    },
    // ... 6 more days
  ]
}
```

**Implementation:**

```javascript
app.get('/agents/:agent_id/analytics', async (req, res) => {
  const { agent_id } = req.params;
  const range = parseInt(req.query.range) || 7;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - range);

  // Query metrics table
  const metrics = await db.query(`
    SELECT * FROM agent_metrics
    WHERE agent_id = $1
    AND date >= $2
    AND date <= $3
    ORDER BY date DESC
  `, [agent_id, startDate, endDate]);

  // Calculate summary stats
  const summary = calculateSummary(metrics.rows);

  res.json({
    agent_id,
    range_days: range,
    summary,
    daily_breakdown: metrics.rows
  });
});
```

### Step 5: Dashboard Integration

**Frontend Needs:**
- Fetch from `GET /agents/{agent_id}/analytics?range=7`
- Render charts using the JSON response
- Show: velocity trend, completion bars, hourly heatmap, inbox trend

**Suggested Libraries:**
- Chart.js or Recharts for visualizations
- Simple line chart for velocity over time
- Bar chart for daily completions (matching CLI output)
- Heatmap for hourly activity

---

## Success Criteria

✅ **Backend parses journals on sync** - When CLI runs `atris log sync`, backend extracts metrics automatically

✅ **Metrics table populated** - Query `agent_metrics` table shows daily rows with correct counts

✅ **Analytics API works** - `GET /agents/{id}/analytics?range=7` returns valid JSON

✅ **Dashboard shows charts** - Web dashboard displays same insights as CLI `atris analytics` command

✅ **Enterprise demo ready** - Can show "your agent team completed X tasks, velocity Y/day" to potential customers

---

## Testing Plan

1. **Unit test parsing function** - Feed sample markdown, verify correct counts
2. **Integration test sync flow** - POST journal via API, verify metrics table updates
3. **API test** - Call analytics endpoint, verify JSON structure
4. **Manual test** - Sync real journal, check dashboard matches CLI output

---

## Enterprise Value Proposition

**Before:** "Our AI agents help you ship faster" (vague)

**After:** "Your team completed 47 tasks this week at 6.7 completions/day velocity, inbox cleared from 12→3 items = measurable $500K in eng time saved" (concrete ROI)

**Pricing Unlock:**
- Free tier: Basic journal sync
- Pro ($50/mo): Analytics dashboard
- Enterprise ($500-5K/mo): Team analytics, ROI reports, executive summaries

---

## File References (Update Based on Your Backend Structure)

**You'll need to modify:**
- Journal sync handler (wherever `PUT /agents/{id}/journal/{date}` lives)
- Database migrations folder (add metrics table migration)
- API routes file (add analytics endpoint)
- Utils/parsers folder (add journal parsing utility)

**Search patterns for your codebase:**
```bash
rg "PUT.*journal" --type ts  # Find journal sync handler
rg "CREATE TABLE" --type sql  # Find migrations folder
rg "app.get|router.get" --type ts  # Find API routes pattern
```

---

## Estimated Complexity

**Low-Medium** - Mostly CRUD operations with regex parsing. The CLI already proved the parsing logic works. Backend just needs to port it and expose via API.

**Estimated Time:** 4-6 hours for experienced backend dev

**Risk:** Low - No complex algorithms, just parsing and storing. Worst case: metrics are slightly off, but markdown source of truth remains.

---

## The Meta Magic

**This task was generated by ATRIS CLI's analytics feature.** You're using the system to build the system. The journal format that makes this possible is already shipping to users. You're just adding the backend intelligence layer.

Self-evolving software FTW. 🚀

---

**Ready to drop into backend ATRIS journal Inbox?** Navigator will read this, create subtasks, executor will build, validator will verify. The loop completes itself.
