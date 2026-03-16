# LangGraph Agent — Graph Architecture

## Overview

The Divine Intelligence agent is a LangGraph `StateGraph`. It's a two-node loop: an LLM reasoning node and a tool execution node. The graph runs until the LLM decides it has enough information to respond (no more tool calls needed).

This same graph handles both conversational (user-triggered) and autonomous (event-triggered) invocations — the difference is just the input message and whether there's a human waiting for a response.

---

## 1. State Definition

**File:** `api/server/services/divine/graph.js`

```javascript
const { StateGraph, Annotation, START, END, messagesStateReducer } = require('@langchain/langgraph');
const { ChatAnthropic } = require('@langchain/anthropic');
const { ToolNode } = require('@langchain/langgraph/prebuilt');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { getToolsForUser } = require('./tools');

// State: messages array (LangGraph's built-in messages reducer handles append/update)
const GraphState = Annotation.Root({
  messages: Annotation({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  // Metadata passed through for tool context
  userId: Annotation({ reducer: (_, b) => b, default: () => null }),
  profileType: Annotation({ reducer: (_, b) => b, default: () => 'employee' }),
});
```

---

## 2. Graph Nodes

### Node 1: Agent (LLM reasoning)

```javascript
function buildAgentNode(model) {
  return async function agentNode(state) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  };
}
```

### Node 2: Tools (execution)

```javascript
// Built by LangGraph's ToolNode — automatically dispatches tool calls
// to the correct tool based on the LLM's tool_call.name
function buildToolNode(tools) {
  return new ToolNode(tools);
}
```

### Routing Logic

```javascript
function shouldContinue(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  // If the LLM made tool calls, go to tools node
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'tools';
  }
  // Otherwise we're done
  return END;
}
```

---

## 3. Graph Assembly

```javascript
function buildDivineGraph(tools) {
  const model = new ChatAnthropic({
    model: 'claude-opus-4-6',
    temperature: 0,
    streaming: true,
  }).bindTools(tools);

  const agentNode = buildAgentNode(model);
  const toolNode = buildToolNode(tools);

  const graph = new StateGraph(GraphState)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      [END]: END,
    })
    .addEdge('tools', 'agent'); // After tools, always go back to agent to reason about result

  return graph.compile();
}

module.exports = { buildDivineGraph, GraphState };
```

---

## 4. System Prompts (Role-Aware)

**File:** `api/server/services/divine/prompts.js`

```javascript
const CURRENT_DATE = () => new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const BASE_PROMPT = `You are the Divine Intelligence — an AI assistant embedded in the Jamot platform.
You help users manage tasks, coordinate work, and get things done efficiently.
Today is ${CURRENT_DATE()}.

Guidelines:
- Be concise and action-oriented. Do things, don't just talk about doing them.
- When a user says "create a task for X to do Y", immediately use the create_task tool.
- When resolving user names, use search_users first if the name is ambiguous.
- Always confirm what you did after taking an action.
- If an action fails, explain why clearly and suggest alternatives.
- Don't ask for confirmation on straightforward actions — just do them and report back.`;

const CEO_PROMPT = `${BASE_PROMPT}

You are assisting a CEO. You have full platform access:
- Create and assign tasks to anyone
- View and manage all audits, signage orders, and social drafts
- Configure automation rules
- Get company-wide summaries and insights
- Approve or reject pending items

Be executive-level: provide summaries, flag critical items, and be proactive.`;

const EMPLOYEE_PROMPT = `${BASE_PROMPT}

You are assisting an employee. You can:
- Create tasks and self-assign them
- View and update your own assigned tasks and orders
- Create social media drafts (pending CEO approval)
- Ask about your workload and priorities

Focus on operational efficiency and task completion.`;

const CUSTOMER_PROMPT = `${BASE_PROMPT}

You are assisting a customer. You can:
- Check the status of your orders and requests
- Get information about your account
- Reach out for support

Be friendly and helpful. Escalate complex issues to the team.`;

function getSystemPrompt(profileType) {
  switch (profileType) {
    case 'ceo': return CEO_PROMPT;
    case 'employee': return EMPLOYEE_PROMPT;
    case 'customer': return CUSTOMER_PROMPT;
    default: return BASE_PROMPT;
  }
}

module.exports = { getSystemPrompt };
```

---

## 5. Graph Runner (Main Entry Point)

**File:** `api/server/services/divine/runner.js`

```javascript
const { buildDivineGraph } = require('./graph');
const { getToolsForUser } = require('./tools');
const { getSystemPrompt } = require('./prompts');
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');

// Cache compiled graphs per role (tools don't change per session, only per role)
const graphCache = new Map();

function getOrBuildGraph(profileType, userId) {
  // For conversational mode, tools need userId so we can't fully cache
  // Build fresh per invocation for now (fast enough, <5ms)
  const tools = getToolsForUser(userId, profileType);
  return buildDivineGraph(tools);
}

/**
 * Run the agent for a single conversational turn
 * @param {Object} params
 * @param {string} params.userId - The user making the request
 * @param {string} params.profileType - CEO/employee/customer
 * @param {string} params.userMessage - The user's input
 * @param {Array}  params.history - Previous messages [{role, content}]
 * @param {Function} params.onChunk - Callback for streaming tokens (optional)
 * @returns {Promise<string>} Final response text
 */
async function runDivineAgent({ userId, profileType, userMessage, history = [], onChunk }) {
  const graph = getOrBuildGraph(profileType, userId);
  const systemPrompt = getSystemPrompt(profileType);

  // Convert history to LangChain message format
  const historyMessages = history.map((m) => {
    if (m.role === 'user') return new HumanMessage(m.content);
    return new AIMessage(m.content);
  });

  const inputMessages = [
    new SystemMessage(systemPrompt),
    ...historyMessages,
    new HumanMessage(userMessage),
  ];

  if (onChunk) {
    // Streaming mode
    let fullResponse = '';
    const stream = await graph.stream(
      { messages: inputMessages, userId, profileType },
      { streamMode: 'messages' },
    );

    for await (const [message, _metadata] of stream) {
      if (message.content && typeof message.content === 'string') {
        onChunk(message.content);
        fullResponse += message.content;
      }
    }
    return fullResponse;
  } else {
    // Non-streaming (for autonomous worker)
    const result = await graph.invoke({
      messages: inputMessages,
      userId,
      profileType,
    });

    const lastMessage = result.messages[result.messages.length - 1];
    return typeof lastMessage.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);
  }
}

/**
 * Run the agent autonomously (no user waiting for response)
 * Used by the background worker for proactive actions
 */
async function runAutonomousAgent({ userId, profileType, taskDescription, context = {} }) {
  return runDivineAgent({
    userId,
    profileType,
    userMessage: taskDescription,
    history: [],
    onChunk: null, // no streaming needed
  });
}

module.exports = { runDivineAgent, runAutonomousAgent };
```

---

## 6. Conversation History Persistence

Divine chat history is stored in MongoDB, separate from regular LibreChat conversations so they don't clutter the chat history.

**File:** `api/models/DivineConversation.js`

```javascript
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  toolCalls: [{ type: mongoose.Schema.Types.Mixed }], // store tool calls for audit trail
  timestamp: { type: Date, default: Date.now },
});

const DivineConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messages: [MessageSchema],
    // Keep last 50 messages per user for context
  },
  { timestamps: true },
);

DivineConversationSchema.index({ userId: 1 });

module.exports = mongoose.model('DivineConversation', DivineConversationSchema);
```

**History management in runner:**
```javascript
// Load last N messages for context window
async function getRecentHistory(userId, limit = 20) {
  const convo = await DivineConversation.findOne({ userId }).lean();
  if (!convo) return [];
  return convo.messages.slice(-limit);
}

// Append messages after agent responds
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
    { upsert: true, new: true },
  );
  // Trim to last 100 messages
  await DivineConversation.updateOne(
    { userId },
    { $push: { messages: { $slice: -100 } } },
  );
}
```

---

## 7. Graph Flow Diagram

```
User Message
     │
     ▼
[System Prompt + History + User Message]
     │
     ▼
┌────────────┐
│   AGENT    │  ← LLM (Claude) with bound tools
│   NODE     │
└─────┬──────┘
      │
      ├── Has tool calls? ──YES──▶ ┌──────────────┐
      │                            │  TOOLS NODE  │
      │                            │  (execute    │
      │                            │   tool calls │
      │                            │   in parallel│
      │                            └──────┬───────┘
      │                                   │
      │◀─────── Tool results appended ────┘
      │
      └── No tool calls → END → Return final response
```

---

## 8. Error Handling

```javascript
// Wrap graph invocation with timeout and error handling
async function runWithTimeout(fn, timeoutMs = 30000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Agent timeout after 30s')), timeoutMs),
    ),
  ]);
}
```

Tools should never throw uncaught exceptions — they return `{ error: "..." }` JSON strings so the LLM can understand and communicate the failure gracefully to the user.
