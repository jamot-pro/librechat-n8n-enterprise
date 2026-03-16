const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { User } = require('~/db/models');
const Profile = require('../../../models/Profile');

function getUserTools(userId, profileType) {
  const searchUsers = tool(
    async ({ query, role }) => {
      try {
        const users = await User.find({
          $or: [
            { name: new RegExp(query.trim(), 'i') },
            { username: new RegExp(query.trim(), 'i') },
          ],
        })
          .select('_id name username email')
          .limit(10)
          .lean();

        if (!users.length) return `No users found matching "${query}".`;

        if (role) {
          const profiles = await Profile.find({
            userId: { $in: users.map((u) => u._id) },
            profileType: role,
          }).lean();
          const allowedIds = new Set(profiles.map((p) => p.userId.toString()));
          const filtered = users.filter((u) => allowedIds.has(u._id.toString()));
          if (!filtered.length) return `No ${role} users found matching "${query}".`;
          return filtered.map((u) => `• ${u.name || u.username} (${u.email})`).join('\n');
        }

        return users.map((u) => `• ${u.name || u.username} (${u.email})`).join('\n');
      } catch (err) {
        return `Search failed: ${err.message}`;
      }
    },
    {
      name: 'search_users',
      description:
        'Search for platform users by name or username. Use before assigning tasks to verify who exists.',
      schema: z.object({
        query: z.string().describe('Name or partial name to search'),
        role: z.enum(['ceo', 'employee', 'customer']).optional().describe('Filter by role'),
      }),
    },
  );

  const getMyProfile = tool(
    async () => {
      try {
        const [profile, user] = await Promise.all([
          Profile.findOne({ userId }).lean(),
          User.findById(userId).select('name username email').lean(),
        ]);
        const TaskService = require('../../TaskService');
        const stats = await TaskService.getStats({ userId, profileType });
        return [
          `You are: ${user?.name || user?.username} (${user?.email})`,
          `Role: ${profile?.profileType || 'unknown'}`,
          `Tasks — Total: ${stats.total} | Overdue: ${stats.overdue}`,
        ].join('\n');
      } catch (err) {
        return `Failed to get profile: ${err.message}`;
      }
    },
    {
      name: 'get_my_profile',
      description: "Get the current user's profile, role, and task summary.",
      schema: z.object({}),
    },
  );

  return [searchUsers, getMyProfile];
}

module.exports = { getUserTools };
