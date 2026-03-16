# Task Management — Model, API & Controller

## Overview

Tasks are the universal unit of work across the platform. They can be created manually via UI, via natural language through Divine Intelligence, or automatically by the autonomous engine. Every entity in the system (audits, orders, social drafts) can generate a task.

---

## 1. MongoDB Model

**File:** `api/models/Task.js`

```javascript
const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },

    // Assignment
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedToName: { type: String }, // denormalized for display without population

    // Status flow: todo → in_progress → review → done | cancelled
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'review', 'done', 'cancelled'],
      default: 'todo',
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },

    dueDate: { type: Date, default: null },

    // Source tracking — how was this task created?
    source: {
      type: String,
      enum: ['manual', 'divine_chat', 'divine_autonomous', 'audit', 'signage', 'social'],
      default: 'manual',
    },

    // Reference to the entity that generated this task (optional)
    sourceRef: {
      type: String, // e.g., auditSessionId, orderId, socialDraftId
      default: null,
    },

    // Tags for grouping/filtering
    tags: [{ type: String, trim: true }],

    // Comments/activity feed
    comments: [CommentSchema],

    // Soft delete
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ createdBy: 1 });
TaskSchema.index({ status: 1, dueDate: 1 });
TaskSchema.index({ source: 1, sourceRef: 1 });

module.exports = mongoose.model('Task', TaskSchema);
```

---

## 2. Controller

**File:** `api/server/controllers/TaskController.js`

### Methods to implement:

```javascript
// LIST — with filters: status, assignedTo, priority, source, dueDate range, search
async function listTasks(req, res)
// Supports: ?status=todo&assignedTo=userId&priority=high&search=text&page=1&limit=20

// GET single task with comments
async function getTask(req, res)

// CREATE — enforces role rules:
//   CEO: can assign to anyone
//   Employee: can create for self or assign to peers (same department)
//   Customer: can only create for themselves (support requests)
async function createTask(req, res)

// UPDATE — status, priority, description, dueDate, tags
async function updateTask(req, res)

// ASSIGN — change assignedTo (CEO: anyone, Employee: only self-assign)
async function assignTask(req, res)

// ADD COMMENT
async function addComment(req, res)

// DELETE (soft delete, CEO only or task creator)
async function deleteTask(req, res)

// BULK ASSIGN — CEO assigns multiple tasks at once
async function bulkAssign(req, res)

// GET STATS — for dashboard widget
// Returns: counts by status, overdue count, by assignee breakdown
async function getTaskStats(req, res)
```

### Permission logic in createTask:

```javascript
const profile = await Profile.findOne({ userId: req.user._id });

if (profile.profileType === 'customer') {
  // Customers can only create tasks for themselves (support requests)
  body.assignedTo = null; // goes to unassigned queue for CEO to assign
  body.source = body.source || 'manual';
}

if (profile.profileType === 'employee') {
  // Employees can self-assign or leave unassigned
  // Cannot assign to other users unless CEO approves
  if (body.assignedTo && body.assignedTo !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Employees can only self-assign tasks' });
  }
}
// CEO: no restrictions
```

---

## 3. Routes

**File:** `api/server/routes/tasks.js`

```javascript
const router = require('express').Router();
const { requireJwtAuth } = require('../middleware/');
const { profileAuth } = require('../middleware/profileAuth');
const TaskController = require('../controllers/TaskController');

router.use(requireJwtAuth);

router.get('/', TaskController.listTasks);
router.get('/stats', TaskController.getTaskStats);
router.get('/:taskId', TaskController.getTask);
router.post('/', TaskController.createTask);
router.put('/:taskId', TaskController.updateTask);
router.patch('/:taskId/assign', TaskController.assignTask);
router.post('/:taskId/comments', TaskController.addComment);
router.delete('/:taskId', TaskController.deleteTask);
router.post('/bulk-assign', profileAuth(['ceo']), TaskController.bulkAssign);

module.exports = router;
```

**Register in:** `api/server/routes/index.js`
```javascript
app.use('/api/tasks', require('./tasks'));
```

---

## 4. Helper Service (used by Divine tools)

**File:** `api/server/services/TaskService.js`

The LangGraph tools will call this service internally (not via HTTP) to avoid network overhead.

```javascript
const Task = require('../../models/Task');
const User = require('../../models/User');

class TaskService {
  // Used by divine tool: create task from natural language parsed params
  static async createTask({ title, description, assignedToName, assignedToId, priority, dueDate, source, sourceRef, createdById }) {
    // Resolve user by name if only name given (divine chat scenario)
    let resolvedAssignee = assignedToId;
    if (!assignedToId && assignedToName) {
      const user = await User.findOne({
        $or: [
          { name: new RegExp(assignedToName, 'i') },
          { username: new RegExp(assignedToName, 'i') },
        ],
      });
      if (!user) throw new Error(`User "${assignedToName}" not found`);
      resolvedAssignee = user._id;
      assignedToName = user.name;
    }

    const task = await Task.create({
      title,
      description,
      assignedTo: resolvedAssignee,
      assignedToName,
      priority: priority || 'medium',
      dueDate: dueDate || null,
      createdBy: createdById,
      source: source || 'divine_chat',
      sourceRef: sourceRef || null,
    });

    return task;
  }

  static async listTasks({ assignedTo, status, priority, limit = 20, skip = 0 }) {
    const query = { isDeleted: false };
    if (assignedTo) query.assignedTo = assignedTo;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    return Task.find(query)
      .populate('assignedTo', 'name username avatar')
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
  }

  static async updateStatus(taskId, status) {
    return Task.findByIdAndUpdate(taskId, { status }, { new: true });
  }

  static async getOverdueTasks() {
    return Task.find({
      status: { $in: ['todo', 'in_progress'] },
      dueDate: { $lt: new Date() },
      isDeleted: false,
    }).populate('assignedTo', 'name email');
  }

  static async getUnassignedTasks() {
    return Task.find({ assignedTo: null, status: 'todo', isDeleted: false }).lean();
  }

  static async getStats(userId, profileType) {
    const baseQuery = profileType === 'ceo' ? {} : { assignedTo: userId };
    const [total, byStatus, overdue] = await Promise.all([
      Task.countDocuments({ ...baseQuery, isDeleted: false }),
      Task.aggregate([
        { $match: { ...baseQuery, isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.countDocuments({
        ...baseQuery,
        isDeleted: false,
        status: { $in: ['todo', 'in_progress'] },
        dueDate: { $lt: new Date() },
      }),
    ]);
    return { total, byStatus, overdue };
  }
}

module.exports = TaskService;
```

---

## 5. API Contract

### GET /api/tasks
Query params: `status`, `assignedTo`, `priority`, `source`, `search`, `page`, `limit`

Response:
```json
{
  "tasks": [
    {
      "_id": "...",
      "title": "Review audit report for Q1",
      "description": "...",
      "assignedTo": { "_id": "...", "name": "Andrea", "avatar": "..." },
      "createdBy": { "_id": "...", "name": "CEO" },
      "status": "todo",
      "priority": "high",
      "dueDate": "2026-03-20T00:00:00.000Z",
      "source": "divine_chat",
      "tags": ["audit", "q1"],
      "comments": [],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### POST /api/tasks
Body:
```json
{
  "title": "Review signage order #142",
  "description": "Check dimensions and approve before printing",
  "assignedTo": "userId",
  "priority": "high",
  "dueDate": "2026-03-20",
  "tags": ["signage"],
  "sourceRef": "order-142"
}
```

### PATCH /api/tasks/:id/assign
```json
{ "assignedTo": "userId" }
```

### GET /api/tasks/stats
Response:
```json
{
  "total": 45,
  "byStatus": [
    { "_id": "todo", "count": 12 },
    { "_id": "in_progress", "count": 8 },
    { "_id": "done", "count": 25 }
  ],
  "overdue": 3
}
```
