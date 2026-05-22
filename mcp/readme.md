# A2H MCP — AI-to-Human Task Coordination

A Model Context Protocol (MCP) server that transforms AI agents into a **central coordination brain** for human teams. Assign tasks, check workload, decompose complex instructions, and ensure every human contributor receives full context — all through a single SSE endpoint.

---

## What It Does

- **Autonomous task decomposition** — AI breaks complex instructions into actionable subtasks automatically
- **Contextual handover** — every task carries chat summary, document references, and goals so humans know exactly what to do
- **Proactive workload analytics** — AI checks team capacity before assigning and warns when someone is overloaded
- **Long-term memory** — agent remembers decisions and preferences across conversations
- **Smart auto-assign** — finds the best available person based on workload and competencies

---

## Quick Start

### Prerequisites
- Docker
- MongoDB instance (Atlas or local)

### Run with Docker

```bash
docker run -d \
  -e MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/yourdb \
  -e WORKLOAD_THRESHOLD=5 \
  -p 3001:3001 \
  yourdockerhubname/a2h-mcp:latest
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | ✅ | — | MongoDB connection string |
| `WORKLOAD_THRESHOLD` | ❌ | `5` | Max active tasks before warning |

---

## Connect to Your AI Platform

Once running, add the SSE endpoint to your AI platform config:

```
http://your-server:3001/sse
```

### LibreChat (`librechat.yaml`)
```yaml
mcpSettings:
  allowedDomains:
    - 'your-server'

mcpServers:
  a2h-coordinator:
    type: sse
    url: http://your-server:3001/sse
    timeout: 60000
```

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "a2h-coordinator": {
      "url": "http://your-server:3001/sse"
    }
  }
}
```

---

## Available Tools

| Tool | Description |
|---|---|
| `get_assignable_users` | Fetch all team members |
| `get_team_workload_report` | Active task count per user |
| `check_workload_before_assign` | Warn if user is overloaded |
| `recommend_best_assignee` | Find best person by workload + competency |
| `suggest_redistribution` | Rebalance overloaded team |
| `get_overdue_tasks` | Find tasks past due date |
| `create_a2h_task` | Create task with full context handover |
| `edit_task` | Update task fields |
| `delete_task` | Delete task (cascades to subtasks) |
| `get_tasks` | List tasks by assignee/status |
| `decompose_task` | Break complex task into parent + subtasks |
| `smart_assign_and_decompose` | Auto-route + decompose in one call |
| `save_memory` | Store context across conversations |
| `get_memory` | Recall past decisions and preferences |
| `delete_memory` | Remove a memory entry |

---

## Recommended Agent Instructions

Add this to your agent's system prompt for best results:

```
You are an A2H coordination agent connected to an internal task management system via MCP tools.

RULES:
1. At the start of EVERY conversation, call get_memory() to recall relevant context.
2. Before assigning ANY task, ALWAYS call check_workload_before_assign(user_id) first.
3. Never answer from general knowledge — always use tools to fetch real data.
4. After important decisions, call save_memory() to remember for future conversations.
5. If someone seems overwhelmed, proactively call suggest_redistribution().
```

---

## Database Schema

The MCP uses two MongoDB collections:

**`tasks`** — stores all tasks and subtasks
**`agent_memory`** — stores agent long-term memory

Your existing `users` collection is read-only — the MCP only queries it, never writes.

---

## Built With

- [FastMCP](https://gofastmcp.com) — MCP server framework
- [Motor](https://motor.readthedocs.io) — async MongoDB driver
- Python 3.11

---

## License
