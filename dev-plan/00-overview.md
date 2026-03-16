# Divine Intelligence — System Overview

## Vision

Divine Intelligence is an autonomous AI orchestration layer embedded into the Jamot platform. It serves two modes:

1. **Conversational** — Any user can instruct it in plain language. "Create a task for Andrea to review the audit report." "What's the status of my orders?" "Assign all pending signage to John."
2. **Autonomous** — The system proactively acts without prompting. Overdue tasks get escalated. New audit reports get assigned. Idle employees get work queued.

The intelligence is role-aware. A CEO gets executive-level actions. An employee gets operational actions. A customer gets support-level responses. The same natural language interface, different capabilities underneath.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT (React)                          │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ Divine Chat  │  │  Task Board UI  │  │  Dashboard       │   │
│  │ (sidebar or  │  │  (kanban/list)  │  │  Widgets         │   │
│  │  modal)      │  │                 │  │  (auto-insights) │   │
│  └──────┬───────┘  └────────┬────────┘  └────────┬─────────┘   │
└─────────│──────────────────-│────────────────────-│─────────────┘
          │ SSE/REST          │ REST                │ REST
┌─────────▼──────────────────-▼────────────────────-▼─────────────┐
│                       EXPRESS API (Node.js)                       │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ /api/divine  │  │  /api/tasks     │  │  /api/events     │   │
│  │ (chat entry) │  │  (CRUD)         │  │  (SSE stream)    │   │
│  └──────┬───────┘  └────────┬────────┘  └────────┬─────────┘   │
│         │                   │                     │              │
│  ┌──────▼──────────────────-▼────────────────────-▼──────────┐  │
│  │              LANGGRAPH AGENT ENGINE                        │  │
│  │                                                            │  │
│  │   ┌──────────┐    ┌──────────┐    ┌───────────────────┐   │  │
│  │   │Supervisor│───▶│ Router   │───▶│ Specialized Nodes │   │  │
│  │   │  Node    │    │  Node    │    │ ┌───────────────┐  │   │  │
│  │   └──────────┘    └──────────┘    │ │  task_agent   │  │   │  │
│  │                                   │ │  audit_agent  │  │   │  │
│  │   ┌──────────────────────────┐    │ │  order_agent  │  │   │  │
│  │   │   Autonomous Worker      │    │ │  social_agent │  │   │  │
│  │   │   (event-driven loop)    │    │ │  user_agent   │  │   │  │
│  │   └──────────────────────────┘    │ └───────────────┘  │   │  │
│  │                                   └───────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    PLATFORM TOOLS (LangChain)                │ │
│  │  createTask  assignTask  updateTaskStatus  listTasks          │ │
│  │  getAudits   approveAudit  getOrders  updateOrderStatus       │ │
│  │  notifyUser  searchUsers  generateReport  createSocialDraft   │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────────────────┐
│                         MONGODB                                      │
│   Tasks | Events | Conversations | Audits | Orders | Profiles       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Decisions

| Concern | Choice | Reason |
|---------|--------|--------|
| Agent framework | `@langchain/langgraph` (JS) | No separate Python service, same runtime as Express, mature JS SDK |
| LLM | Claude (Anthropic) via `@langchain/anthropic` | Already in use, best tool-calling |
| Tool protocol | LangChain `DynamicStructuredTool` | Type-safe, Zod validation, works with LangGraph |
| Graph state persistence | MongoDB checkpointer | Existing DB, no new infra |
| Autonomous scheduling | Node.js `node-cron` | Lightweight, already Node runtime |
| Event bus | MongoDB change streams + in-process EventEmitter | No Redis required for MVP |
| Streaming to client | Server-Sent Events (SSE) | Already used for chat |

---

## Key Packages to Install

```bash
# In api/
npm install @langchain/core @langchain/langgraph @langchain/anthropic @langchain/openai zod node-cron

# Optional: LangSmith tracing (highly recommended for debugging agent flows)
npm install langsmith
```

---

## Role Capability Matrix

| Capability | CEO | Employee | Customer |
|-----------|-----|----------|----------|
| Create task for anyone | ✅ | Self/peers only | ❌ |
| View all tasks | ✅ | Own + team | Own only |
| Approve audit | ✅ | ❌ | ❌ |
| Manage signage orders | ✅ | Own assigned | View own |
| Publish social drafts | ✅ | Propose only | ❌ |
| Trigger autonomous rules | ✅ | ❌ | ❌ |
| Ask divine intelligence | ✅ | ✅ | ✅ (limited) |

---

## Files to Create (summary)

```
api/
├── models/Task.js                          # Task mongoose model
├── models/DivinEvent.js                    # Platform event log
├── server/routes/tasks.js                  # Task CRUD routes
├── server/routes/divine.js                 # Divine intelligence chat route
├── server/controllers/TaskController.js    # Task business logic
├── server/controllers/DivineController.js  # Agent invocation
├── server/services/divine/
│   ├── graph.js                            # LangGraph graph definition
│   ├── nodes.js                            # Graph node functions
│   ├── tools/
│   │   ├── taskTools.js                    # Task management tools
│   │   ├── auditTools.js                   # Audit tools
│   │   ├── orderTools.js                   # Signage order tools
│   │   ├── socialTools.js                  # Social media tools
│   │   └── userTools.js                    # User/notification tools
│   ├── autonomous/
│   │   ├── worker.js                       # Background cron worker
│   │   ├── eventHandlers.js                # Event → agent triggers
│   │   └── rules.js                        # Built-in automation rules
│   └── checkpointer.js                     # MongoDB graph state persistence
│
client/src/
├── components/Tasks/
│   ├── TaskBoard.tsx                       # Kanban board view
│   ├── TaskList.tsx                        # List view
│   ├── TaskCard.tsx                        # Single task card
│   ├── TaskCreateModal.tsx                 # Manual create form
│   └── TaskDetailDrawer.tsx               # Task detail + comments
├── components/Divine/
│   ├── DivineChat.tsx                      # Chat interface
│   ├── DivineSidebar.tsx                   # Sidebar wrapper
│   └── DivineInsightWidget.tsx             # Dashboard proactive insights
├── data-provider/
│   ├── tasks.ts                            # Task API client
│   ├── task-queries.ts                     # React Query hooks
│   ├── divine.ts                           # Divine API client
│   └── divine-queries.ts                   # Divine hooks
```

---

## Dev Plan Files Index

| File | Topic |
|------|-------|
| `01-task-management.md` | Task model, API routes, controller logic |
| `02-langchain-tools.md` | All tool definitions with schemas |
| `03-langgraph-graph.md` | Graph nodes, edges, state definition |
| `04-divine-chat.md` | Chat route, SSE streaming, history |
| `05-autonomous-engine.md` | Background worker, cron schedule, rule engine |
| `06-event-system.md` | Event model, emitters, change streams |
| `07-frontend.md` | All UI components and data hooks |
| `08-build-order.md` | Phased implementation with milestones |
