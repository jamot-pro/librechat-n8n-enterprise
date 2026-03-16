# Phase 4 — Autonomous Engine

## Overview

Phase 4 built the background autonomous engine that makes Divine Intelligence act without user input. It consists of a cron scheduler, a real-time event bus, an action log model, and a `runAutonomousAgent` function. The agent runs on schedule or in response to platform events (task created, order delivered, audit completed, etc.) and executes the same LangGraph tooling as in chat mode.

---

## Files Created / Modified

### `api/models/DivinEvent.js` (NEW)

MongoDB model for recording every autonomous action.

```js
const DivinEventSchema = new mongoose.Schema({
  trigger: { type: String, required: true }, // e.g. 'cron:overdueTaskEscalation' | 'event:task:created'
  prompt: { type: String },
  response: { type: String },
  toolsUsed: [String],
  success: { type: Boolean, default: true },
  error: { type: String },
  duration: { type: Number }, // ms
  createdAt: { type: Date, default: Date.now, index: true },
});
```

Indexes: `(trigger, createdAt)` and `(success, createdAt)` for efficient dashboard queries.

---

### `api/server/services/divine/runner.js` (UPDATED)

Added `runAutonomousAgent` — wraps `runDivineAgent` with no history and no streaming for background use.

```js
async function runAutonomousAgent({ userId, profileType, taskDescription, model }) {
  return runDivineAgent({
    userId, profileType,
    userMessage: taskDescription,
    history: [], onChunk: null, model,
  });
}
module.exports = { runDivineAgent, runAutonomousAgent };
```

---

### `api/server/services/divine/autonomous/rules.js` (NEW)

Five automation rules, each with a `condition` (async → boolean) and a `prompt` (string or async → string).

| Rule | Schedule | Condition |
|---|---|---|
| `overdueTaskEscalation` | Every 15 min | `getOverdueTasks().length > 0` |
| `autoAssignUnassignedTasks` | Every hour | `getUnassignedTasks().length > 0` |
| `ceoDailyBriefing` | Daily 9am | Always |
| `endOfDayReminders` | Daily 5pm | At least 1 employee profile exists |
| `agingSocialDrafts` | Every 30 min | Pending drafts older than 24h exist |

`resolvePrompt(rule)` handles both static strings and async functions.

---

### `api/server/services/divine/autonomous/eventHandlers.js` (NEW)

Six event-driven handlers. All call `safeRun(description, prompt)` which resolves CEO userId and calls `runAutonomousAgent`.

| Event | Handler | Action |
|---|---|---|
| `task:created` | `onTaskCreated` | Notify assignee |
| `task:overdue` | `onTaskOverdue` | Send escalation message |
| `order:created` | `onOrderCreated` | Create processing task for printing team |
| `order:statusChanged` | `onOrderStatusChanged` | Mark related tasks done when delivered |
| `audit:completed` | `onAuditCompleted` | Create high-priority review task |
| `social:draftCreated` | `onSocialDraftCreated` | Remind CEO to approve |

Lazy-requires `runner.js` inside `safeRun()` to avoid circular dependency issues.

---

### `api/server/services/divine/autonomous/worker.js` (NEW)

Exports `platformEvents` (shared `EventEmitter`) and `initAutonomousWorker()`.

```
┌─────────────────────────────────────────────────────────┐
│                  AUTONOMOUS ENGINE                       │
│   ┌─────────────┐    ┌──────────────┐                   │
│   │  Cron Jobs  │    │ Event Bus    │                    │
│   └──────┬──────┘    └──────┬───────┘                   │
│          ▼                  ▼                            │
│   ┌─────────────────────────────────┐                   │
│   │       Rule Engine               │                   │
│   │  (evaluate conditions → action) │                   │
│   └──────────────┬──────────────────┘                   │
│          ┌───────▼───────┐                              │
│          │ runAutonomous │  ← LangGraph agent            │
│          └───────┬───────┘                              │
│          Platform Tools execute                          │
│          (create task, assign, notify...)                │
└─────────────────────────────────────────────────────────┘
```

- `initAutonomousWorker()` is idempotent (guarded by `isInitialized` flag).
- Guards with `DIVINE_AUTONOMOUS_ENABLED=true` env var (disabled by default in dev).
- `runAndLog(trigger, prompt, userId, profileType)` wraps agent execution and persists result to `DivinEvent`.

Cron schedules:
```
*/15 * * * *   → overdueTaskEscalation
0 * * * *      → autoAssignUnassignedTasks
0 9 * * *      → ceoDailyBriefing
0 17 * * *     → endOfDayReminders
*/30 * * * *   → agingSocialDrafts
```

---

### `api/server/index.js` (UPDATED)

Worker boot injected after seed steps with error boundary:

```js
try {
  const { initAutonomousWorker } = require('./services/divine/autonomous/worker');
  initAutonomousWorker();
} catch (e) {
  console.warn('[SKIP] Divine autonomous worker (error):', e.message);
}
```

---

### `api/server/controllers/TaskController.js` (UPDATED)

All three task creation branches (customer, employee, CEO) now emit `task:created`:

```js
function emitTaskCreated(task) {
  try {
    const { platformEvents } = require('../services/divine/autonomous/worker');
    platformEvents.emit('task:created', task);
  } catch (_) {}
}
```

---

### `api/server/routes/socialDrafts.js` (UPDATED)

After n8n creates a draft, emits `social:draftCreated`:

```js
try {
  const { platformEvents } = require('../services/divine/autonomous/worker');
  platformEvents.emit('social:draftCreated', draft);
} catch (_) {}
```

---

## Dependencies

- `node-cron` installed in `api/` (`npm install node-cron --save`)

---

## Environment Variables

```bash
DIVINE_AUTONOMOUS_ENABLED=true   # Set to enable the cron engine
```

---

## What's Missing (Phase 5)

- `notify_user` tool is a **stub** — no persistence, no real delivery mechanism.
- `DivinEvent` has no frontend UI — CEO cannot see what the agent has done.
- `GET /api/divine/events` route does not exist yet.
