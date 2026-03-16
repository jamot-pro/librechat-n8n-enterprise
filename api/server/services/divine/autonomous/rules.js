const TaskService = require('~/server/services/TaskService');

const rules = {
  /**
   * Find overdue tasks and notify assignees
   */
  overdueTaskEscalation: {
    condition: async () => {
      const overdue = await TaskService.getOverdueTasks();
      return overdue.length > 0;
    },
    prompt: async () => {
      const overdue = await TaskService.getOverdueTasks();
      if (!overdue.length) return null;
      const summary = overdue
        .map(
          (t) =>
            `- "${t.title}" assigned to ${t.assignedToName || 'unassigned'}, due ${t.dueDate?.toDateString()}`,
        )
        .join('\n');
      return (
        `The following tasks are overdue. For each one, use notify_user to send a friendly reminder ` +
        `to the assigned person. If unassigned, skip the notification:\n${summary}`
      );
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

      const Profile = require('~/server/models/Profile');
      const { User } = require('~/db/models');
      const profiles = await Profile.find({ profileType: 'employee' }).lean();
      const userIds = profiles.map((p) => p.userId);
      const employees = await User.find({ _id: { $in: userIds } }).select('name').lean();
      if (!employees.length) return null;

      return (
        `There are ${unassigned.length} unassigned task(s): ` +
        `${unassigned.map((t) => `"${t.title}"`).join(', ')}. ` +
        `Available employees: ${employees.map((e) => e.name).join(', ')}. ` +
        `Distribute these tasks evenly among the employees using the assign_task tool.`
      );
    },
  },

  /**
   * Daily morning briefing for CEO (runs at 9am)
   */
  ceoDailyBriefing: {
    condition: async () => true,
    prompt:
      'Generate a morning briefing for the CEO. Use get_task_stats for the task overview, ' +
      'list_audits for any pending audits, and list_signage_orders for pending orders. ' +
      'Summarise the key items that need attention today and use notify_user to send the briefing to the CEO.',
  },

  /**
   * End-of-day reminders for employees (runs at 5pm)
   */
  endOfDayReminders: {
    condition: async () => {
      const Profile = require('~/server/models/Profile');
      const count = await Profile.countDocuments({ profileType: 'employee' });
      return count > 0;
    },
    prompt:
      "It's end of day. Use list_tasks to find any in_progress or todo tasks due today or tomorrow. " +
      'For each employee who has such tasks, use notify_user to send a friendly reminder about their pending work.',
  },

  /**
   * Alert CEO about social drafts pending > 24 hours
   */
  agingSocialDrafts: {
    condition: async () => {
      const SocialDraft = require('~/server/models/SocialDraft');
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const count = await SocialDraft.countDocuments({
        status: 'pending',
        createdAt: { $lt: cutoff },
      });
      return count > 0;
    },
    prompt:
      'There are social media drafts that have been pending approval for more than 24 hours. ' +
      'Use list_social_drafts with status=pending to list them and use notify_user to remind the CEO to review and approve them.',
  },
};

/**
 * Resolve a rule's prompt — it may be a static string or an async function.
 * @param {object} rule
 * @returns {Promise<string|null>}
 */
async function resolvePrompt(rule) {
  if (typeof rule.prompt === 'function') return rule.prompt();
  return rule.prompt;
}

module.exports = rules;
module.exports.resolvePrompt = resolvePrompt;
