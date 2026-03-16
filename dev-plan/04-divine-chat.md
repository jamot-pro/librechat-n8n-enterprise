# Divine Chat — HTTP Route & SSE Streaming

## Overview

The divine chat endpoint receives a user message, invokes the LangGraph agent with SSE streaming, persists the conversation, and returns the full response. It integrates with the existing Express auth middleware.

---

## 1. Route

**File:** `api/server/routes/divine.js`

```javascript
const express = require('express');
const router = express.Router();
const { requireJwtAuth } = require('../middleware');
const DivineController = require('../controllers/DivineController');

// POST — send a message to Divine Intelligence (SSE stream response)
router.post('/chat', requireJwtAuth, DivineController.chat);

// GET — load conversation history for the current user
router.get('/history', requireJwtAuth, DivineController.getHistory);

// DELETE — clear divine conversation history
router.delete('/history', requireJwtAuth, DivineController.clearHistory);

module.exports = router;
```

**Register in Express index:**
```javascript
app.use('/api/divine', require('./divine'));
```

---

## 2. Controller

**File:** `api/server/controllers/DivineController.js`

```javascript
const Profile = require('../models/Profile');
const DivineConversation = require('../../models/DivineConversation');
const { runDivineAgent } = require('../services/divine/runner');
const { getRecentHistory, appendHistory } = require('../services/divine/history');

const DivineController = {
  /**
   * POST /api/divine/chat
   * Body: { message: string }
   * Response: SSE stream of text chunks, ends with [DONE]
   */
  chat: async (req, res) => {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
    }

    // Get user's profile type
    const profile = await Profile.findOne({ userId: req.user._id }).lean();
    if (!profile) {
      return res.status(403).json({ error: 'Profile not set up. Contact your administrator.' });
    }

    // Load conversation history for context
    const history = await getRecentHistory(req.user._id.toString(), 20);

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullResponse = '';

    try {
      fullResponse = await runDivineAgent({
        userId: req.user._id.toString(),
        profileType: profile.profileType,
        userMessage: message.trim(),
        history,
        onChunk: (chunk) => {
          // Stream each token chunk to client
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        },
      });

      // Signal completion
      res.write(`data: ${JSON.stringify({ type: 'done', content: fullResponse })}\n\n`);
      res.end();

      // Persist conversation asynchronously (don't block response)
      appendHistory(req.user._id.toString(), message.trim(), fullResponse).catch(console.error);
    } catch (err) {
      console.error('[DivineController] Agent error:', err);
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Something went wrong. Please try again.' })}\n\n`);
      res.end();
    }
  },

  /**
   * GET /api/divine/history
   * Returns last 50 messages for the user
   */
  getHistory: async (req, res) => {
    try {
      const history = await getRecentHistory(req.user._id.toString(), 50);
      res.json({ history });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load history' });
    }
  },

  /**
   * DELETE /api/divine/history
   */
  clearHistory: async (req, res) => {
    try {
      await DivineConversation.findOneAndUpdate(
        { userId: req.user._id },
        { messages: [] },
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to clear history' });
    }
  },
};

module.exports = DivineController;
```

---

## 3. History Helpers

**File:** `api/server/services/divine/history.js`

```javascript
const DivineConversation = require('../../../models/DivineConversation');

async function getRecentHistory(userId, limit = 20) {
  const convo = await DivineConversation.findOne({ userId }).lean();
  if (!convo || !convo.messages.length) return [];
  return convo.messages
    .slice(-limit)
    .map((m) => ({ role: m.role, content: m.content }));
}

async function appendHistory(userId, userMessage, assistantResponse) {
  await DivineConversation.findOneAndUpdate(
    { userId },
    {
      $push: {
        messages: {
          $each: [
            { role: 'user', content: userMessage, timestamp: new Date() },
            { role: 'assistant', content: assistantResponse, timestamp: new Date() },
          ],
        },
      },
    },
    { upsert: true },
  );

  // Keep only last 100 messages to prevent unbounded growth
  const convo = await DivineConversation.findOne({ userId });
  if (convo && convo.messages.length > 100) {
    convo.messages = convo.messages.slice(-100);
    await convo.save();
  }
}

module.exports = { getRecentHistory, appendHistory };
```

---

## 4. Client API

**File:** `client/src/data-provider/divine.ts`

```typescript
const API_BASE = '/api/divine';

export interface DivineMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Send a message to Divine Intelligence and stream the response
 * @param message - User input
 * @param onChunk - Called for each streamed token
 * @param onDone - Called when streaming is complete
 * @param onError - Called on error
 */
export function sendDivineMessage(
  message: string,
  onChunk: (chunk: string) => void,
  onDone: (fullResponse: string) => void,
  onError: (error: string) => void,
): AbortController {
  const controller = new AbortController();

  fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'chunk') onChunk(event.content);
            if (event.type === 'done') onDone(event.content);
            if (event.type === 'error') onError(event.content);
          } catch {}
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onError(err.message);
    });

  return controller;
}

export async function getDivineHistory(): Promise<DivineMessage[]> {
  const res = await fetch(`${API_BASE}/history`);
  const data = await res.json();
  return data.history || [];
}

export async function clearDivineHistory(): Promise<void> {
  await fetch(`${API_BASE}/history`, { method: 'DELETE' });
}
```

---

## 5. React Query Hooks

**File:** `client/src/data-provider/divine-queries.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDivineHistory, clearDivineHistory } from './divine';

export const divineKeys = {
  history: () => ['divine', 'history'] as const,
};

export function useDivineHistory() {
  return useQuery({
    queryKey: divineKeys.history(),
    queryFn: getDivineHistory,
    staleTime: 0, // Always fresh
  });
}

export function useClearDivineHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearDivineHistory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: divineKeys.history() }),
  });
}
```

---

## 6. SSE Event Format

```
data: {"type": "chunk", "content": "Task "}
data: {"type": "chunk", "content": "created "}
data: {"type": "chunk", "content": "successfully"}
data: {"type": "done", "content": "Task created successfully and assigned to Andrea."}
```

Client accumulates `chunk` events to show typing effect, `done` confirms the full final text.

---

## 7. Rate Limiting

Add to the divine route to prevent abuse:

```javascript
const rateLimit = require('express-rate-limit');

const divineLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per user
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { error: 'Too many requests. Please slow down.' },
});

router.post('/chat', requireJwtAuth, divineLimiter, DivineController.chat);
```
