const DivineConversation = require('../../../models/DivineConversation');

/**
 * Get last N messages as plain {role, content} objects for LangChain context
 */
async function getRecentHistory(userId, limit = 20) {
  const convo = await DivineConversation.findOne({ userId }).lean();
  if (!convo || !convo.messages?.length) return [];
  return convo.messages
    .slice(-limit)
    .map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Append a user + assistant exchange to the conversation
 */
async function appendHistory(userId, userMessage, assistantResponse) {
  await DivineConversation.findOneAndUpdate(
    { userId },
    {
      $push: {
        messages: {
          $each: [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: assistantResponse },
          ],
        },
      },
    },
    { upsert: true },
  );

  // Keep only the last 100 messages to avoid unbounded growth
  const convo = await DivineConversation.findOne({ userId });
  if (convo && convo.messages.length > 100) {
    convo.messages = convo.messages.slice(-100);
    await convo.save();
  }
}

async function clearHistory(userId) {
  await DivineConversation.findOneAndUpdate({ userId }, { messages: [] });
}

module.exports = { getRecentHistory, appendHistory, clearHistory };
