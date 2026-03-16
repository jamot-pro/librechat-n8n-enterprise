# Build Order — Phased Implementation

## Philosophy

Build the minimum useful thing in each phase. Every phase ships working value, not just infrastructure. The later phases build on top of earlier ones.

---

## Phase 1 — Task Management (standalone, no AI)

**Goal:** Working task system. CEO creates tasks, assigns to employees, employees manage them. No AI yet.

**Estimate:** 2–3 days

### Backend
- [ ] `api/models/Task.js` — Task mongoose model
- [ ] `api/server/services/TaskService.js` — CRUD service methods
- [ ] `api/server/controllers/TaskController.js` — listTasks, createTask, updateTask, assignTask, addComment, deleteTask, getTaskStats
- [ ] `api/server/routes/tasks.js` — All task routes
- [ ] Register `/api/tasks` in Express index
- [ ] Test all endpoints with Postman/curl

### Frontend
- [ ] `client/src/data-provider/task-queries.ts` — React Query hooks
- [ ] `client/src/components/Tasks/TaskBoard.tsx` — Kanban board (4 columns)
- [ ] `client/src/components/Tasks/TaskCard.tsx` — Card with quick status change
- [ ] `client/src/components/Tasks/TaskCreateModal.tsx` — Create form
- [ ] `client/src/components/Tasks/TaskFilters.tsx` — Filter bar
- [ ] `client/src/components/Tasks/TaskDashboardWidget.tsx` — Dashboard widget
- [ ] Add `/tasks` route in App.jsx
- [ ] Add Tasks link in sidebar nav

**Done when:** CEO can create a task manually, assign to Andrea, Andrea sees it on her board and marks it done.

---

## Phase 2 — LangChain Tools + Conversational Chat (AI creates tasks)

**Goal:** User types "create a task for Andrea to review the audit" and it happens.

**Estimate:** 2–3 days

### Install dependencies
```bash
cd api && npm install @langchain/core @langchain/langgraph @langchain/anthropic zod
```

### Backend
- [ ] `api/server/services/divine/tools/taskTools.js` — create_task, list_tasks, update_task_status, assign_task, get_task_stats
- [ ] `api/server/services/divine/tools/userTools.js` — search_users, notify_user, get_my_profile
- [ ] `api/server/services/divine/tools/index.js` — Role-based tool loader
- [ ] `api/server/services/divine/prompts.js` — System prompts per role
- [ ] `api/server/services/divine/graph.js` — LangGraph StateGraph assembly
- [ ] `api/models/DivineConversation.js` — Conversation history model
- [ ] `api/server/services/divine/history.js` — getRecentHistory, appendHistory
- [ ] `api/server/services/divine/runner.js` — runDivineAgent (streaming + non-streaming)
- [ ] `api/server/controllers/DivineController.js` — chat, getHistory, clearHistory
- [ ] `api/server/routes/divine.js` — Routes
- [ ] Register `/api/divine` in Express index

### Frontend
- [ ] `client/src/data-provider/divine.ts` — sendDivineMessage (SSE), getDivineHistory, clearHistory
- [ ] `client/src/data-provider/divine-queries.ts` — React Query hooks
- [ ] `client/src/components/Divine/DivineChat.tsx` — Chat UI with streaming
- [ ] `client/src/components/Divine/DivineSidebar.tsx` — Floating button + slide panel
- [ ] Add `<DivineSidebar />` to Root layout

**Done when:** User says "Create a task for Andrea to call the client" and the task appears on the board assigned to Andrea.

---

## Phase 3 — Extend Tools to Audit + Orders + Social

**Goal:** Full tool coverage across all platform features.

**Estimate:** 2 days

### Backend
- [ ] `api/server/services/divine/tools/auditTools.js` — list_audits, get_audit_details, approve_audit, create_task_for_audit
- [ ] `api/server/services/divine/tools/orderTools.js` — list_signage_orders, assign_signage_order, update_order_status
- [ ] `api/server/services/divine/tools/socialTools.js` — create_social_draft, list_social_drafts
- [ ] Wire auditTools and orderTools into tool loader for CEO
- [ ] Wire socialTools for CEO + employee

**Done when:** CEO asks "show me all pending audits and create a review task for each one" and the agent does it.

---

## Phase 4 — Autonomous Engine

**Goal:** System acts without being asked. Tasks get assigned, users get notified, CEO gets briefed.

**Estimate:** 2–3 days

### Install
```bash
cd api && npm install node-cron
```

### Backend
- [ ] `api/models/DivinEvent.js` — Action log model
- [ ] `api/server/services/divine/autonomous/rules.js` — All automation rules
- [ ] `api/server/services/divine/autonomous/eventHandlers.js` — Event → agent dispatch
- [ ] `api/server/services/divine/autonomous/worker.js` — Cron jobs + event listener setup
- [ ] Add `DIVINE_AUTONOMOUS_ENABLED` env flag
- [ ] Add `initAutonomousWorker()` call in `api/server/index.js` after DB connect
- [ ] Emit `task:created` event in TaskController.createTask
- [ ] Emit `order:created` event in signageOrders route
- [ ] Emit `social:draftCreated` event in socialDrafts route

**Done when:** A task with a past due date gets an automatic escalation notification to the assignee without anyone asking.

---

## Phase 5 — Polish & CEO Config UI

**Goal:** CEO can view autonomous action logs and configure simple rules.

**Estimate:** 1–2 days

### Backend
- [ ] `GET /api/divine/events` — List action logs (CEO only)
- [ ] `GET /api/divine/events/stats` — Stats on autonomous actions taken

### Frontend
- [ ] `client/src/components/Divine/DivineActivityLog.tsx` — Show what the system did autonomously
- [ ] Add activity log tab to CEO dashboard
- [ ] Add "Divine Intelligence" section in settings showing enabled rules

---

## Summary

| Phase | Feature | Value Delivered |
|-------|---------|----------------|
| 1 | Task Management | Manual task creation/assignment/tracking |
| 2 | Divine Chat + Task Tools | Natural language task creation |
| 3 | Full Tool Coverage | AI can manage audits, orders, social |
| 4 | Autonomous Engine | Proactive actions, notifications, briefings |
| 5 | CEO Config UI | Visibility and control over autonomous behavior |

---

## Environment Variables Needed

```bash
# .env additions
DIVINE_AUTONOMOUS_ENABLED=true

# If not already set (for LangChain)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: LangSmith tracing (highly recommended during dev)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__...
LANGCHAIN_PROJECT=jamot-divine
```

---

## Key Risk: Tool Name Resolution

The trickiest part is resolving "Andrea" to a real user. The `search_users` tool handles this, but the LLM must call it first if uncertain. The system prompt instructs it to do this. Test this flow explicitly:

1. "Create a task for Andrea" → Agent calls `search_users("Andrea")` → finds user → calls `create_task` with resolved ID ✓
2. "Create a task for a person named Andrea Smith" → same flow ✓
3. "Create a task for someone who doesn't exist" → `search_users` returns empty → agent reports error ✓
