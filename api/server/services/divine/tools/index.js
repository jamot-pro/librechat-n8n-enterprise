const { getTaskTools } = require('./taskTools');
const { getUserTools } = require('./userTools');
const { getAuditTools } = require('./auditTools');
const { getOrderTools } = require('./orderTools');
const { getSocialTools } = require('./socialTools');
const { getNotifyTools } = require('./notifyTools');

/**
 * Returns the set of tools available to the user based on their role.
 *
 * CEO      — all tools (tasks, users, audits, orders, social, notify)
 * Employee — task + user tools (self-scoped) + orders (own) + social (own drafts) + notify
 * Customer — minimal (get_my_profile only, via userTools)
 */
function getToolsForUser(userId, profileType) {
  const tools = [
    ...getTaskTools(userId, profileType),
    ...getUserTools(userId, profileType),
  ];

  if (profileType === 'ceo' || profileType === 'employee') {
    tools.push(...getOrderTools(userId, profileType));
    tools.push(...getSocialTools(userId, profileType));
    tools.push(...getNotifyTools(userId, profileType));
  }

  if (profileType === 'ceo') {
    tools.push(...getAuditTools(userId));
  }

  return tools;
}

module.exports = { getToolsForUser };
