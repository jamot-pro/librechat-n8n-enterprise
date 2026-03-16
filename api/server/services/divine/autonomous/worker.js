const cron = require('node-cron');
const { EventEmitter } = require('events');
const { logger } = require('@librechat/data-schemas');
const rules = require('./rules');

// Shared internal event bus — import this in controllers/routes to emit events
const platformEvents = new EventEmitter();
platformEvents.setMaxListeners(50);

let isInitialized = false;

/**
 * Start the autonomous engine. Idempotent — safe to call multiple times.
 * Guards against running when DIVINE_AUTONOMOUS_ENABLED is not 'true'.
 */
function initAutonomousWorker() {
  if (process.env.DIVINE_AUTONOMOUS_ENABLED !== 'true') {
    logger.info('[DivineWorker] Autonomous engine disabled (set DIVINE_AUTONOMOUS_ENABLED=true to enable)');
    return;
  }

  if (isInitialized) return;
  isInitialized = true;

  logger.info('[DivineWorker] Starting autonomous engine...');

  // ── Scheduled Jobs ────────────────────────────────────────

  // Every 15 min: escalate overdue tasks
  cron.schedule('*/15 * * * *', () => runRule('overdueTaskEscalation'));

  // Every hour: assign unassigned tasks
  cron.schedule('0 * * * *', () => runRule('autoAssignUnassignedTasks'));

  // Daily 9am: CEO morning briefing
  cron.schedule('0 9 * * *', () => runRule('ceoDailyBriefing'));

  // Daily 5pm: end-of-day reminders
  cron.schedule('0 17 * * *', () => runRule('endOfDayReminders'));

  // Every 30 min: alert on aging social drafts
  cron.schedule('*/30 * * * *', () => runRule('agingSocialDrafts'));

  // ── Event-Driven Handlers ─────────────────────────────────
  setupEventHandlers();

  logger.info('[DivineWorker] Autonomous engine initialised. Cron jobs active.');
}

async function runRule(ruleName) {
  const rule = rules[ruleName];
  if (!rule) return;

  try {
    const shouldRun = await rule.condition();
    if (!shouldRun) return;

    const prompt = await rules.resolvePrompt(rule);
    if (!prompt) return;

    logger.info(`[DivineWorker] Running rule: ${ruleName}`);

    const Profile = require('~/server/models/Profile');
    const ceoProfile = await Profile.findOne({ profileType: 'ceo' }).lean();
    const userId = ceoProfile?.userId?.toString();
    if (!userId) {
      logger.warn(`[DivineWorker] Rule ${ruleName}: no CEO user found, skipping`);
      return;
    }

    await runAndLog(`cron:${ruleName}`, prompt, userId, 'ceo');
  } catch (err) {
    logger.error(`[DivineWorker] Rule ${ruleName} failed:`, err);
  }
}

async function runAndLog(trigger, prompt, userId, profileType) {
  const DivinEvent = require('~/models/DivinEvent');
  const { runAutonomousAgent } = require('../runner');
  const start = Date.now();
  try {
    const response = await runAutonomousAgent({ userId, profileType, taskDescription: prompt });
    await DivinEvent.create({ trigger, prompt, response, success: true, duration: Date.now() - start });
    logger.info(`[DivineWorker] ${trigger} completed (${Date.now() - start}ms)`);
  } catch (err) {
    await DivinEvent.create({
      trigger,
      prompt,
      error: err.message,
      success: false,
      duration: Date.now() - start,
    }).catch(() => {});
    logger.error(`[DivineWorker] ${trigger} failed:`, err);
  }
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
