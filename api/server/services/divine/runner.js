const { createReactAgent } = require('@langchain/langgraph/prebuilt');
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
const { getToolsForUser } = require('./tools');
const { getSystemPrompt } = require('./prompts');

/**
 * Run the Divine Intelligence agent for one conversational turn.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.profileType  - 'ceo' | 'employee' | 'customer'
 * @param {string} params.userMessage
 * @param {Array}  params.history      - [{role, content}] from DB
 * @param {Function|null} params.onChunk - called with each streamed text chunk
 * @param {string} [params.model] - OpenAI model to use (defaults to gpt-4o-mini)
 * @returns {Promise<string>} final response text
 */
async function runDivineAgent({ userId, profileType, userMessage, history = [], onChunk, model }) {
  const tools = getToolsForUser(userId, profileType);
  const systemPrompt = getSystemPrompt(profileType);

  const llm = new ChatOpenAI({
    model: model || process.env.DIVINE_MODEL || 'gpt-4o-mini',
    temperature: 0,
    streaming: !!onChunk,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const agent = createReactAgent({ llm, tools });

  // Convert history to LangChain messages
  const historyMessages = history.map((m) =>
    m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
  );

  const inputMessages = [
    new SystemMessage(systemPrompt),
    ...historyMessages,
    new HumanMessage(userMessage),
  ];

  if (onChunk) {
    // Streaming: iterate over events, emit text chunks as they arrive
    let fullResponse = '';

    const stream = await agent.streamEvents(
      { messages: inputMessages },
      { version: 'v2' },
    );

    for await (const event of stream) {
      // on_chat_model_stream fires for each token from the LLM
      if (
        event.event === 'on_chat_model_stream' &&
        event.data?.chunk?.content
      ) {
        const chunk = event.data.chunk.content;
        if (typeof chunk === 'string' && chunk) {
          onChunk(chunk);
          fullResponse += chunk;
        }
      }
    }

    return fullResponse || 'Done.';
  } else {
    // Non-streaming (for autonomous worker)
    const result = await agent.invoke({ messages: inputMessages });
    const last = result.messages[result.messages.length - 1];
    if (!last) return 'Done.';
    const content = last.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
    }
    return String(content);
  }
}

/**
 * Run the Divine Intelligence agent autonomously (no user session, no streaming).
 * Used by the background worker for scheduled and event-driven actions.
 *
 * @param {object} params
 * @param {string} params.userId        - The user ID to act as (usually CEO)
 * @param {string} params.profileType   - 'ceo' | 'employee'
 * @param {string} params.taskDescription - The instruction for the agent
 * @param {string} [params.model]       - OpenAI model override
 * @returns {Promise<string>} agent response
 */
async function runAutonomousAgent({ userId, profileType, taskDescription, model }) {
  return runDivineAgent({
    userId,
    profileType,
    userMessage: taskDescription,
    history: [],
    onChunk: null,
    model,
  });
}

module.exports = { runDivineAgent, runAutonomousAgent };
