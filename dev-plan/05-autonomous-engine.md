# Autonomous Engine — Background Worker & Event-Driven Actions

## Overview

The autonomous engine runs independently of user sessions. It observes platform state on a schedule, identifies actions that need to be taken, and uses the LangGraph agent to decide and execute them. It also responds to real-time events (task created, order status changed, etc.) via an internal event emitter.

This is what makes the feature "divine" — the system acts without being asked.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  AUTONOMOUS ENGINE                       │
│                                                          │
│   ┌─────────────┐    ┌──────────────┐                   │
│   │  Cron Jobs  │    │ Event Bus    │                    │
│   │  (scheduled)│    │ (real-time)  │                    │
│   └──────┬──────┘    └──────┬───────┘                   │
│          │                  │                            │
│          ▼                  ▼                            │
│   ┌─────────────────────────────────┐                   │
│   │       Rule Engine               │                   │
│   │  (evaluate conditions → action) │                   │
│   └──────────────┬──────────────────┘                   │
│                  │                                       │
│          ┌───────▼───────┐                              │
│          │ runAutonomous │                              │
│          │ Agent(...)    │  ← LangGraph agent           │
│          └───────┬───────┘                              │
│                  │                                       │
│          Platform Tools execute                          │
│          (create task, assign, notify...)                │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Worker Bootstrap

**File:** `api/server/services/divine/autonomous/worker.js`

```javascript
const cron = require('node-cron');
const { EventEmitter } = require('events');
const { runAutonomousAgent } = require('../runner');
const rules = require('./rules');
const logger = require('../../../../../config/winston');

// Shared internal event bus
const platformEvents = new EventEmitter();
platformEvents.setMaxListeners(50);

let isInitialized = false;

function initAutonomousWorker() {
  if (isInitialized) return;
  isInitialized = true;

  logger.info('[DivineWorker] Starting autonomous engine...');

  // ── Scheduled Jobs ──────────────────────────────────────

  // Every 15 minutes: check for overdue tasks and escalate
  cron.schedule('*/15 * * * *', async () => {
    await runRule('overdueTaskEscalation');
  });

  // Every hour: check unassigned tasks and auto-assign
  cron.schedule('0 * * * *', async () => {
    await runRule('autoAssignUnassignedTasks');
  });

  // Every day at 9am: generate CEO daily briefing
  cron.schedule('0 9 * * *', async () => {
    await runRule('ceoDailyBriefing');
  });

  // Every day at 5pm: remind employees of pending tasks
  cron.schedule('0 17 * * *', async () => {
    await runRule('endOfDayReminders');
  });

  // Every 30 minutes: check aging social drafts
  cron.schedule('*/30 * * * *', async () => {
    await runRule('agingSocialDrafts');
  });

  // ── Event-Driven Handlers ────────────────────────────────
  setupEventHandlers();

  logger.info('[DivineWorker] Autonomous engine initialized');
}

async function runRule(ruleName) {
  const rule = rules[ruleName];
  if (!rule) return;

  try {
    const shouldRun = await rule.condition();
    if (!shouldRun) return;

    logger.info(`[DivineWorker] Running rule: ${ruleName}`);
    const result = await runAutonomousAgent({
      userId: await getCEOUserId(), // System actions run as CEO
      profileType: 'ceo',
      taskDescription: rule.prompt,
    });
    logger.info(`[DivineWorker] Rule ${ruleName} completed: ${result.substring(0, 100)}`);
  } catch (err) {
    logger.error(`[DivineWorker] Rule ${ruleName} failed:`, err);
  }
}

// Get the primary CEO user ID for system-initiated actions
async function getCEOUserId() {
  const Profile = require('../../models/Profile');
  const profile = await Profile.findOne({ profileType: 'ceo' }).lean();
  return profile?.userId?.toString();
}

function setupEventHandlers() {
  const handlers = require('./eventHandlers');

  platformEvents.on('task:created', handlers.onTaskCreated);
  platformEvents.on('task:overdue', handlers.onTaskOverdue);
  platformEvents.on('order:created', handlers.onOrderCreated);
  platformEvents.on('order:statusChanged', handlers.onOrderStatusChanged);
  platformEvents.on('audit:completed', handlers.onAuditCompleted);
  platformEvents.on('social:draftCreated', handlers.onSocialDraftCreated);
}

module.exports = { initAutonomousWorker, platformEvents };
```

---

## 3. Automation Rules

**File:** `api/server/services/divine/autonomous/rules.js`

```javascript
const TaskService = require('../../../TaskService');
const Profile = require('../../models/Profile');
const User = require('../../../../models/User');

const rules = {
  /**
   * Find overdue tasks and escalate them
   */
  overdueTaskEscalation: {
    condition: async () => {
      const overdue = await TaskService.getOverdueTasks();
      return overdue.length > 0;
    },
    prompt: async () => {
      const overdue = await TaskService.getOverdueTasks();
      const summary = overdue
        .map((t) => `- "${t.title}" assigned to ${t.assignedTo?.name || 'unassigned'}, due ${t.dueDate?.toDateString()}`)
        .join('\n');
      return `The following tasks are overdue. For each one, notify the assigned person with a friendly reminder. If unassigned, flag it in a comment:\n${summary}`;
    },
  },

  /**
   * Auto-assign unassigned tasks to available employees
   */
  autoAssignUnassignedTasks: {
    condition: async () => {
      const unassigned = await TaskService.getUnassignedTasks();
      return unassigned.length > 0;
    },
    prompt: async () => {
      const unassigned = await TaskService.getUnassignedTasks();
      if (!unassigned.length) return null;

      // Find employees
      const profiles = await Profile.find({ profileType: 'employee' }).lean();
      const userIds = profiles.map((p) => p.userId);
      const employees = await User.find({ _id: { $in: userIds } }).select('name').lean();

      return `There are ${unassigned.length} unassigned tasks: ${unassigned.map((t) => `"${t.title}"`).join(', ')}. Available employees: ${employees.map((e) => e.name).join(', ')}. Please distribute these tasks evenly among the employees based on their names. Assign each task using the assign_task tool.`;
    },
  },

  /**
   * Daily briefing for CEO
   */
  ceoDailyBriefing: {
    condition: async () => true, // Always run
    prompt: `Generate a morning briefing for the CEO. Use get_task_stats to get task overview, list_audits for any pending audits, and list_signage_orders for pending orders. Summarize key items that need attention today. Send a notification with the briefing.`,
  },

  /**
   * End of day reminders for employees
   */
  endOfDayReminders: {
    condition: async () => {
      const profiles = await Profile.find({ profileType: 'employee' }).lean();
      return profiles.length > 0;
    },
    prompt: `It's end of day. Check for any in-progress tasks. For each employee with pending tasks due today or tomorrow, send them a notification reminding them about their pending work.`,
  },

  /**
   * Remind CEO about aging social drafts (pending > 24 hours)
   */
  agingSocialDrafts: {
    condition: async () => {
      const SocialDraft = require('../../../../models/SocialDraft');
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const count = await SocialDraft.countDocuments({ status: 'pending', createdAt: { $lt: cutoff } });
      return count > 0;
    },
    prompt: `There are social media drafts that have been pending approval for more than 24 hours. List them using list_social_drafts and send a notification to the CEO asking them to review and approve pending drafts.`,
  },
};

// Allow prompts to be functions (async) or strings
async function resolvePrompt(rule) {
  if (typeof rule.prompt === 'function') return rule.prompt();
  return rule.prompt;
}

module.exports = rules;
module.exports.resolvePrompt = resolvePrompt;
```

---

## 4. Event Handlers

**File:** `api/server/services/divine/autonomous/eventHandlers.js`

```javascript
const { runAutonomousAgent } = require('../runner');
const logger = require('../../../../../config/winston');

async function getCEOUserId() {
  const Profile = require('../../models/Profile');
  const p = await Profile.findOne({ profileType: 'ceo' }).lean();
  return p?.userId?.toString();
}

async function safeRun(description, prompt) {
  try {
    const userId = await getCEOUserId();
    if (!userId) return;
    await runAutonomousAgent({ userId, profileType: 'ceo', taskDescription: prompt });
  } catch (err) {
    logger.error(`[EventHandler] ${description} failed:`, err);
  }
}

const eventHandlers = {
  // New task created — notify assignee
  onTaskCreated: async (task) => {
    if (!task.assignedTo) return;
    await safeRun(
      'onTaskCreated',
      `A new task has been created: "${task.title}" assigned to ${task.assignedToName}. Please send them a notification about their new task.`,
    );
  },

  // Task overdue event (emitted by scheduler or webhook)
  onTaskOverdue: async (task) => {
    await safeRun(
      'onTaskOverdue',
      `Task "${task.title}" assigned to ${task.assignedToName} is now overdue (was due ${task.dueDate?.toDateString()}). Please notify them with a friendly escalation message.`,
    );
  },

  // New signage order — create task and notify team
  onOrderCreated: async (order) => {
    await safeRun(
      'onOrderCreated',
      `A new signage order was created (ID: ${order._id}, description: ${order.title || 'New order'}). Create a task for the printing team to process it and assign it to the first available employee.`,
    );
  },

  // Order status changed
  onOrderStatusChanged: async ({ order, oldStatus, newStatus }) => {
    if (newStatus === 'delivered') {
      await safeRun(
        'onOrderDelivered',
        `Signage order ${order._id} has been marked as delivered. Notify the customer (if applicable) and mark any related tasks as done.`,
      );
    }
  },

  // Audit completed externally — create review task
  onAuditCompleted: async (audit) => {
    await safeRun(
      'onAuditCompleted',
      `A new audit report has been completed (session: ${audit.sessionId}). Create a high-priority task to review this audit and assign it to an available employee. Tag the task with "audit".`,
    );
  },

  // Social draft created (by employee) — remind CEO to approve
  onSocialDraftCreated: async (draft) => {
    await safeRun(
      'onSocialDraftCreated',
      `A new social media draft for ${draft.platform} is pending approval (ID: ${draft._id}). Notify the CEO that there's a new draft ready for their review.`,
    );
  },
};

module.exports = eventHandlers;
```

---

## 5. How to Emit Events from Existing Routes

Import `platformEvents` and emit when key actions happen. This is **non-invasive** — just add a single line to existing controllers.

**Example: Task creation emits event**
```javascript
// In TaskController.js, after creating task:
const { platformEvents } = require('../services/divine/autonomous/worker');
// ...
const task = await Task.create(taskData);
platformEvents.emit('task:created', task);
```

**Example: Signage order creation emits event**
```javascript
// In signageOrders route, after creating order:
platformEvents.emit('order:created', order);
```

**Example: Social draft creation emits event**
```javascript
// In socialDrafts route, after creating draft:
platformEvents.emit('social:draftCreated', draft);
```

---

## 6. Worker Initialization

Start the worker when the Express server boots.

**In `api/server/index.js`:**
```javascript
const { initAutonomousWorker } = require('./services/divine/autonomous/worker');

// After DB connection is established
mongoose.connection.once('open', () => {
  logger.info('MongoDB connected');
  initAutonomousWorker(); // Start Divine autonomous engine
});
```

---

## 7. Disabling in Development

Add an env flag to disable the autonomous worker during development:

```bash
# .env
DIVINE_AUTONOMOUS_ENABLED=true
```

```javascript
if (process.env.DIVINE_AUTONOMOUS_ENABLED === 'true') {
  initAutonomousWorker();
}
```

---

## 8. Action Log

Track all autonomous actions for audit trail and debugging.

**Add to DivinEvent model** (`api/models/DivinEvent.js`):
```javascript
const DivinEventSchema = new mongoose.Schema({
  trigger: String,           // 'cron:overdueTaskEscalation' | 'event:task:created'
  prompt: String,            // What was sent to the agent
  response: String,          // What the agent did
  toolsUsed: [String],       // Which tools were called
  success: Boolean,
  error: String,
  duration: Number,          // ms
  createdAt: { type: Date, default: Date.now },
});
```

Wrap `runAutonomousAgent` to log:
```javascript
async function runAndLog(trigger, prompt, userId, profileType) {
  const start = Date.now();
  try {
    const response = await runAutonomousAgent({ userId, profileType, taskDescription: prompt });
    await DivinEvent.create({ trigger, prompt, response, success: true, duration: Date.now() - start });
  } catch (err) {
    await DivinEvent.create({ trigger, prompt, error: err.message, success: false, duration: Date.now() - start });
  }
}
```
