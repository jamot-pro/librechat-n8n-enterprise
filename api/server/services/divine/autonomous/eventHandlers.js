const { logger } = require('@librechat/data-schemas');

async function getCEOUserId() {
  const Profile = require('~/server/models/Profile');
  const p = await Profile.findOne({ profileType: 'ceo' }).lean();
  return p?.userId?.toString() ?? null;
}

async function safeRun(description, prompt) {
  try {
    const userId = await getCEOUserId();
    if (!userId) {
      logger.warn(`[EventHandler] ${description}: no CEO user found, skipping`);
      return;
    }
    const { runAutonomousAgent } = require('../runner');
    await runAutonomousAgent({ userId, profileType: 'ceo', taskDescription: prompt });
  } catch (err) {
    logger.error(`[EventHandler] ${description} failed:`, err);
  }
}

const eventHandlers = {
  // New task created — notify assignee
  onTaskCreated: async (task) => {
    if (!task.assignedTo && !task.assignedToName) return;
    await safeRun(
      'onTaskCreated',
      `A new task has just been created: "${task.title}" assigned to ${task.assignedToName || 'someone'}. ` +
        `Use notify_user to send them a brief notification about their new assignment.`,
    );
  },

  // Task overdue (emitted by scheduler or explicitly)
  onTaskOverdue: async (task) => {
    await safeRun(
      'onTaskOverdue',
      `Task "${task.title}" assigned to ${task.assignedToName || 'an employee'} is now overdue ` +
        `(was due ${task.dueDate?.toDateString()}). ` +
        `Use notify_user to send them a friendly escalation message.`,
    );
  },

  // New signage order — create a processing task
  onOrderCreated: async (order) => {
    await safeRun(
      'onOrderCreated',
      `A new signage order was created (ID: ${order._id || order.id}, ` +
        `description: "${order.title || order.description || 'New order'}"). ` +
        `Create a task for the printing team to process it and assign it to the first available employee using assign_task.`,
    );
  },

  // Order delivered — notify and close related tasks
  onOrderStatusChanged: async ({ order, newStatus }) => {
    if (newStatus !== 'delivered') return;
    await safeRun(
      'onOrderDelivered',
      `Signage order ${order._id || order.id} has been marked as delivered. ` +
        `Use update_task_status to mark any related processing tasks as done.`,
    );
  },

  // Audit completed externally — create a review task
  onAuditCompleted: async (audit) => {
    await safeRun(
      'onAuditCompleted',
      `A new audit report has been completed (session: ${audit.sessionId || audit._id}). ` +
        `Create a high-priority task to review this audit, assign it to an available employee, and tag it "audit".`,
    );
  },

  // Social draft created — remind CEO to approve
  onSocialDraftCreated: async (draft) => {
    await safeRun(
      'onSocialDraftCreated',
      `A new social media draft is pending CEO approval (ID: ${draft._id}). ` +
        `Use notify_user to tell the CEO there is a new draft ready for review.`,
    );
  },
};

module.exports = eventHandlers;
