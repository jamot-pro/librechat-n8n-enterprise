# jamot-mcp — AI-to-Human Task Coordination MCP Server

> A remote MCP server that lets AI agents assign tasks, check team workload, decompose complex instructions, and hand over full context to human contributors — all through a single SSE endpoint.

**MCP Server Name:** `jamot-mcp`  
**Transport:** SSE  
**Endpoint:** `https://your-server:3001/sse`

---

## What This MCP Server Does

`jamot-mcp` is a **task coordination MCP server** that exposes 15 tools for AI agents to:

- Create and assign tasks to human team members
- Check workload before assigning (warns if someone is overloaded)
- Decompose complex instructions into subtasks automatically
- Attach full context (chat summary, goals, documents) to every task
- Remember decisions and preferences across conversations
- Suggest workload redistribution when the team is unbalanced

---

## Quick Start

### Run with Docker

```bash
docker run -d \
  -e MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/yourdb \
  -e WORKLOAD_THRESHOLD=5 \
  -p 3001:3001 \
  jamot/jamot-mcp:latest
```

### Add to Your AI Platform

**LibreChat (`librechat.yaml`):**
```yaml
mcpSettings:
  allowedDomains:
    - 'your-server'

mcpServers:
  jamot-mcp:
    type: sse
    url: http://your-server:3001/sse
    timeout: 60000
```

**Claude Desktop (`claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "jamot-mcp": {
      "url": "http://your-server:3001/sse"
    }
  }
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | ✅ | — | MongoDB connection string |
| `WORKLOAD_THRESHOLD` | ❌ | `5` | Max active tasks per user before warning |

---

## MCP Tools

### Task Management
| Tool | Description |
|---|---|
| `create_a2h_task` | Create a task with full contextual handover (summary, goals, docs) |
| `edit_task` | Update task fields (title, status, assignee, due date) |
| `delete_task` | Delete task and cascade to subtasks |
| `get_tasks` | List tasks filtered by assignee or status |

### Task Decomposition
| Tool | Description |
|---|---|
| `decompose_task` | Break a complex instruction into parent + subtasks |
| `smart_assign_and_decompose` | Auto-find best assignee + decompose in one call |

### Workload & Analytics
| Tool | Description |
|---|---|
| `get_team_workload_report` | Active task count per user |
| `check_workload_before_assign` | Warn if user is overloaded, suggest alternatives |
| `suggest_redistribution` | Identify overloaded/underloaded members |
| `get_overdue_tasks` | Find tasks past their due date |

### Users
| Tool | Description |
|---|---|
| `get_assignable_users` | Fetch all team members from database |
| `get_human_profiles` | Filter users by minimum impact score |
| `recommend_best_assignee` | Find best person by workload + competency match |

### Memory
| Tool | Description |
|---|---|
| `save_memory` | Store context and decisions across conversations |
| `get_memory` | Recall past decisions and team preferences |
| `delete_memory` | Remove a memory entry |

---

## Recommended Agent Instructions

```
You are a task coordination agent connected to jamot-mcp.

RULES:
1. At the start of every conversation, call get_memory() to recall context.
2. Before assigning any task, always call check_workload_before_assign first.
3. Always use tools — never answer from general knowledge.
4. After important decisions, call save_memory() to persist them.
5. If someone seems overwhelmed, proactively call suggest_redistribution().
```

---

## Database Requirements

Requires MongoDB with these collections:

- `users` — team members (read-only, queried for assignments)
- `tasks` — created and managed by this MCP server
- `agent_memory` — auto-created for agent long-term memory

---

## Built With

- [FastMCP](https://gofastmcp.com) 3.x — MCP server framework
- [Motor](https://motor.readthedocs.io) — async MongoDB driver
- Python 3.11

---

## License

MIT — built by [Jamot](https://jamot.pro)