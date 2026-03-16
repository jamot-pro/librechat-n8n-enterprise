# Phase 2 — Divine Chat + Task Tools (Complete)

## Goal
User types natural language ("create a task for Andrea to review the audit") and it happens via an AI agent embedded in the LibreChat interface.

## Status: ✅ DONE

---

## Architecture Decision
The Divine Intelligence agent is implemented as a **LibreChat Agent** (via the existing `agents` endpoint), not a custom standalone route. This means:
- It uses LibreChat's full streaming, message history, and chat UI out of the box
- Tools are injected at request-time via `initialize.js` hook rather than stored in the agent document
- System prompt is injected dynamically via `toolContextMap` (prepended to agent instructions at runtime)

---

## Backend

### Agent Seeding
**`api/server/services/divine/seedAgent.js`**
- Exports: `seedDivineAgent()`, `DIVINE_AGENT_ID = 'agent_divine_intelligence'`
- Called on server startup (in `api/server/index.js`) after DB connect
- Creates the agent in MongoDB with `provider: 'openAI'`, `model: 'gpt-4o-mini'`, empty `tools: []`
- Adds the agent to the Global project so all users can access it
- Updates instructions daily (current date in prompt)

### Tool Injection
**`api/server/services/Endpoints/agents/initialize.js`** (modified)
- When `agentId === DIVINE_AGENT_ID`, injects:
  1. `divineTools` from `getToolsForUser(userId, profileType)` into `mergedResult.tools`
  2. `getSystemPrompt(profileType)` into `mergedResult.toolContextMap['divine_system']` (prepended to system instructions at runtime)
- Also loads user's Profile to determine `profileType` (ceo/employee/customer)
- Fixed early-return bug where n8n tool loading could skip divine injection

### Task Tools
**`api/server/services/divine/tools/taskTools.js`**
- `create_task` — creates a task via TaskService, resolves `assignedToName` to a user
- `list_tasks` — filters by assignee, status, priority, overdue; employees see own tasks by default
- `update_task_status` — find by ID or title, update status
- `assign_task` — CEO only; reassign a task to a user by name
- `get_task_stats` — total + breakdown by status + overdue count

### User Tools
**`api/server/services/divine/tools/userTools.js`**
- `search_users` — fuzzy name/username search, optional role filter
- `notify_user` — sends an in-platform notification (stub for MVP)
- `get_my_profile` — returns current user's profile + task stats

### Tool Loader
**`api/server/services/divine/tools/index.js`**
- `getToolsForUser(userId, profileType)` — returns the combined tool list for the user's role

### System Prompts
**`api/server/services/divine/prompts.js`**
- `getSystemPrompt(profileType)` — returns role-specific system prompt
- Base prompt lists all available tools and forbids "I don't have access" responses
- CEO variant: full platform access, decisive tone
- Employee variant: self-scoped tasks, focus on today

### Runner (standalone, not used by LibreChat path)
**`api/server/services/divine/runner.js`**
- `runDivineAgent({ userId, profileType, userMessage, history, onChunk, model })`
- Uses `ChatOpenAI` + LangGraph `createReactAgent`
- Supports streaming (via `onChunk`) and non-streaming modes
- Used by autonomous worker (Phase 4); not called by the LibreChat chat flow

### Conversation History
**`api/server/services/divine/history.js`**
- `getRecentHistory(userId, limit)` — fetches recent messages from `DivineConversation`
- `appendHistory(userId, role, content)` — saves a message

**`api/models/DivineConversation.js`**
- Fields: `userId`, `role` (user/assistant), `content`, `createdAt`

---

## Frontend

### UI Model Picker (librechat.yaml)
**`librechat.yaml`** — at project root
```yaml
interface:
  modelSelect: false   # hides raw endpoint sections
  endpointsMenu: false
  parameters: false
  presets: false

modelSpecs:
  prioritize: true
  list:
    - name: jamot-fast   label: "Jamot Fast"   default: true  # gpt-4o-mini
    - name: jamot-pro    label: "Jamot Pro"                   # gpt-4o
    - name: jamot-agent  label: "Jamot Agent"                 # agent_divine_intelligence
```
Three flat options in the model picker, no nested endpoint sections.

### Data Layer
- **`client/src/data-provider/divine.ts`** — API client for divine chat and history
- **`client/src/data-provider/divine-queries.ts`** — React Query hooks

---

## Environment Variables Required
```bash
ENDPOINTS=openAI,agents      # agents endpoint must be enabled
OPENAI_API_KEY=sk-...        # used by divine agent
```

---

## Key Fixes Applied
1. **`ENDPOINTS=openAI,agents`** — agents endpoint was missing, hiding the entire agents UI
2. **n8n early-return bug** — `initialize.js` was returning early before divine injection ran; fixed by normalizing to `mergedResult`
3. **`enforce: true` conflict** — removed from yaml; `interface.modelSelect: false` set explicitly instead
4. **Stale DB instructions** — `seedAgent` now calls `updateAgent` on every startup so instructions stay current

---

## Done Criteria
User says "Create a task for Andrea to call the client" and the task appears on the board assigned to Andrea. ✅
