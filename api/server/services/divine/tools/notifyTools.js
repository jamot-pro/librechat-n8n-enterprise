const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { User } = require('~/db/models');
const Profile = require('../../../models/Profile');

/**
 * notify_user — persists an in-app notification for a target user.
 *
 * The agent calls this to send actionable messages to any platform user.
 * Notifications are stored in DivineNotification and surfaced in the UI.
 */
function getNotifyTools(callerUserId, profileType) {
  const notifyUser = tool(
    async ({ targetName, message, refType, refId }) => {
      try {
        const DivineNotification = require('~/models/DivineNotification');

        // Resolve target user by name/username
        let targetUser = null;

        if (targetName) {
          targetUser = await User.findOne({
            $or: [
              { name: new RegExp(`^${targetName.trim()}$`, 'i') },
              { username: new RegExp(`^${targetName.trim()}$`, 'i') },
              { name: new RegExp(targetName.trim(), 'i') },
            ],
          })
            .select('_id name username')
            .lean();
        }

        // Fallback: if no target name given, send to self (caller)
        const targetId = targetUser?._id ?? callerUserId;
        const resolvedName = targetUser?.name || targetUser?.username || 'user';

        await DivineNotification.create({
          userId: targetId,
          message,
          refType: refType || undefined,
          refId: refId || undefined,
        });

        return `Notification sent to ${targetUser ? resolvedName : 'you'}: "${message}"`;
      } catch (err) {
        return `Failed to send notification: ${err.message}`;
      }
    },
    {
      name: 'notify_user',
      description:
        'Send an in-app notification to a platform user by name. ' +
        'Use this to alert employees about tasks, remind the CEO about pending approvals, or deliver briefings. ' +
        'If targetName is omitted, the notification is sent to the current user (yourself).',
      schema: z.object({
        targetName: z
          .string()
          .optional()
          .describe("Full name or username of the person to notify. Omit to notify yourself."),
        message: z.string().describe('The notification message to send (plain text, 1–3 sentences max)'),
        refType: z
          .enum(['task', 'order', 'audit', 'social_draft', 'briefing'])
          .optional()
          .describe('Optional: type of related entity'),
        refId: z.string().optional().describe('Optional: ID of the related entity'),
      }),
    },
  );

  const getNotifications = tool(
    async ({ unreadOnly }) => {
      try {
        const DivineNotification = require('~/models/DivineNotification');
        const filter = { userId: callerUserId };
        if (unreadOnly) filter.read = false;

        const notifications = await DivineNotification.find(filter)
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();

        if (!notifications.length) return 'No notifications found.';

        return notifications
          .map(
            (n) =>
              `[${n.read ? 'read' : 'unread'}] ${new Date(n.createdAt).toLocaleString()} — ${n.message}`,
          )
          .join('\n');
      } catch (err) {
        return `Failed to get notifications: ${err.message}`;
      }
    },
    {
      name: 'get_notifications',
      description: "Get the current user's in-app notifications from the Divine agent.",
      schema: z.object({
        unreadOnly: z.boolean().optional().describe('Only return unread notifications'),
      }),
    },
  );

  return [notifyUser, getNotifications];
}

module.exports = { getNotifyTools };
