# Phase 1 — Task Management (Complete)

## Goal
Working task system without AI. CEO creates tasks, assigns to employees, employees manage them.

## Status: ✅ DONE

---

## Backend

### Model
**`api/models/Task.js`**
- Fields: `title`, `description`, `status` (todo/in_progress/review/done/cancelled), `priority` (low/medium/high/urgent), `assignedTo` (User ref), `assignedToName` (string cache), `createdBy`, `dueDate`, `tags`, `source`, `sourceRef`, `isDeleted`
- Indexes on: `assignedTo`, `status`, `priority`, `dueDate`, `isDeleted`

### Service
**`api/server/services/TaskService.js`**
- `createTask({ title, description, assignedToName, priority, dueDate, tags, createdById, source, sourceRef })` — resolves `assignedToName` to a User record if provided
- `listTasks({ assignedTo, status, priority, limit })` — returns `{ tasks, total }`
- `getOverdueTasks()` — tasks with `dueDate < now` and status not done/cancelled
- `updateStatus(taskId, status)` — updates a task's status
- `getStats(userId, profileType)` — CEO gets all counts, employee gets own; returns `{ total, byStatus: [{_id, count}], overdue }`

### Routes
**`api/server/routes/tasks.js`** — registered at `/api/tasks`
- `GET /` — list tasks (CEO: all, employee: own)
- `POST /` — create task
- `PATCH /:id/status` — update status
- `PATCH /:id/assign` — assign to user (CEO only)
- `DELETE /:id` — soft delete
- `GET /stats` — task summary stats

---

## Frontend

### Components (`client/src/components/Tasks/`)
- **`TaskBoard.tsx`** — Kanban board with 4 columns (To Do, In Progress, Review, Done); drag-and-drop status update
- **`TaskCard.tsx`** — Individual task card with priority badge, due date, assignee, quick status change
- **`TaskCreateModal.tsx`** — Form to create a task: title, description, assignee (search), priority, due date, tags
- **`TaskDetailDrawer.tsx`** — Side drawer showing full task detail, comments, status history

### Data Layer (`client/src/data-provider/`)
- **`tasks.ts`** — API client: `listTasks`, `createTask`, `updateTaskStatus`, `assignTask`, `deleteTask`, `getTaskStats`
- **`task-queries.ts`** — React Query hooks: `useTasksQuery`, `useCreateTaskMutation`, `useUpdateTaskStatusMutation`, `useTaskStatsQuery`

---

## Done Criteria
CEO can create a task manually, assign to a team member, and the assignee sees it on their board and marks it done. ✅
