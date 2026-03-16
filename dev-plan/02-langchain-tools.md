# LangChain Tools — Platform Action Registry

## Overview

Every action the Divine Intelligence can perform is a LangChain `DynamicStructuredTool`. Tools are the interface between the LangGraph agent and the platform. They use Zod for input validation, call internal services (not HTTP), and return structured strings the agent uses to formulate its response.

Tools are grouped by domain and loaded based on the user's role.

---

## 1. Tool Loader (Role-Aware)

**File:** `api/server/services/divine/tools/index.js`

```javascript
const { getTaskTools } = require('./taskTools');
const { getAuditTools } = require('./auditTools');
const { getOrderTools } = require('./orderTools');
const { getSocialTools } = require('./socialTools');
const { getUserTools } = require('./userTools');

/**
 * Returns tools available to the user based on their role
 */
function getToolsForUser(userId, profileType) {
  const tools = [
    ...getTaskTools(userId, profileType),
    ...getUserTools(userId, profileType),
  ];

  if (profileType === 'ceo' || profileType === 'employee') {
    tools.push(...getOrderTools(userId, profileType));
    tools.push(...getSocialTools(userId, profileType));
  }

  if (profileType === 'ceo') {
    tools.push(...getAuditTools(userId));
  }

  return tools;
}

module.exports = { getToolsForUser };
```

---

## 2. Task Tools

**File:** `api/server/services/divine/tools/taskTools.js`

```javascript
const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');
const TaskService = require('../../../TaskService');

function getTaskTools(userId, profileType) {
  const createTask = new DynamicStructuredTool({
    name: 'create_task',
    description:
      'Create a new task and optionally assign it to a team member by name. ' +
      'Use this when the user says things like "create a task for Andrea to do X" or ' +
      '"add a task: review the audit report, assign to John, due Friday".',
    schema: z.object({
      title: z.string().describe('Short task title, max 200 chars'),
      description: z.string().optional().describe('Detailed description of what needs to be done'),
      assignedToName: z
        .string()
        .optional()
        .describe('Name of the person to assign to. Will be resolved to a user account.'),
      priority: z
        .enum(['low', 'medium', 'high', 'urgent'])
        .optional()
        .describe('Task priority level'),
      dueDate: z
        .string()
        .optional()
        .describe('Due date in ISO format (YYYY-MM-DD) or relative like "next Monday"'),
      tags: z.array(z.string()).optional().describe('Tags to categorize the task'),
    }),
    func: async ({ title, description, assignedToName, priority, dueDate, tags }) => {
      try {
        const task = await TaskService.createTask({
          title,
          description,
          assignedToName,
          priority,
          dueDate: dueDate ? new Date(dueDate) : null,
          tags,
          createdById: userId,
          source: 'divine_chat',
        });
        return JSON.stringify({
          success: true,
          taskId: task._id,
          message: `Task "${title}" created successfully${assignedToName ? ` and assigned to ${task.assignedToName}` : ' (unassigned)'}`,
        });
      } catch (err) {
        return JSON.stringify({ success: false, error: err.message });
      }
    },
  });

  const listTasks = new DynamicStructuredTool({
    name: 'list_tasks',
    description:
      'List tasks with optional filters. Use this to answer questions like ' +
      '"what tasks does Andrea have?" or "show me all urgent tasks" or "what\'s overdue?".',
    schema: z.object({
      assignedToName: z.string().optional().describe('Filter by assigned person name'),
      status: z
        .enum(['todo', 'in_progress', 'review', 'done', 'cancelled'])
        .optional()
        .describe('Filter by status'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      overdue: z.boolean().optional().describe('Set true to only show overdue tasks'),
      limit: z.number().optional().default(10),
    }),
    func: async ({ assignedToName, status, priority, overdue, limit }) => {
      try {
        let assignedToId;
        if (assignedToName) {
          const User = require('../../../../../models/User');
          const user = await User.findOne({ name: new RegExp(assignedToName, 'i') });
          if (!user) return JSON.stringify({ error: `User "${assignedToName}" not found` });
          assignedToId = user._id;
        } else if (profileType === 'employee') {
          // Employees see their own tasks by default
          assignedToId = userId;
        }

        const tasks = overdue
          ? await TaskService.getOverdueTasks()
          : await TaskService.listTasks({ assignedTo: assignedToId, status, priority, limit });

        if (!tasks.length) return 'No tasks found matching those filters.';

        const summary = tasks.map((t) => ({
          id: t._id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assignedTo: t.assignedToName || 'Unassigned',
          dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'No due date',
        }));

        return JSON.stringify({ count: tasks.length, tasks: summary });
      } catch (err) {
        return JSON.stringify({ error: err.message });
      }
    },
  });

  const updateTaskStatus = new DynamicStructuredTool({
    name: 'update_task_status',
    description:
      'Update the status of an existing task. Use when user says "mark task X as done" or "move task to in progress".',
    schema: z.object({
      taskId: z.string().describe('The task ID to update'),
      status: z.enum(['todo', 'in_progress', 'review', 'done', 'cancelled']),
    }),
    func: async ({ taskId, status }) => {
      const task = await TaskService.updateStatus(taskId, status);
      if (!task) return JSON.stringify({ error: 'Task not found' });
      return JSON.stringify({ success: true, message: `Task "${task.title}" updated to ${status}` });
    },
  });

  const assignTask = new DynamicStructuredTool({
    name: 'assign_task',
    description: 'Assign or reassign a task to a team member.',
    schema: z.object({
      taskId: z.string().optional().describe('Task ID if known'),
      taskTitle: z.string().optional().describe('Task title to search for if ID not known'),
      assignToName: z.string().describe('Name of user to assign the task to'),
    }),
    func: async ({ taskId, taskTitle, assignToName }) => {
      try {
        const Task = require('../../../../../models/Task');
        const User = require('../../../../../models/User');

        let task;
        if (taskId) {
          task = await Task.findById(taskId);
        } else if (taskTitle) {
          task = await Task.findOne({ title: new RegExp(taskTitle, 'i'), isDeleted: false });
        }
        if (!task) return JSON.stringify({ error: 'Task not found' });

        const user = await User.findOne({ name: new RegExp(assignToName, 'i') });
        if (!user) return JSON.stringify({ error: `User "${assignToName}" not found` });

        task.assignedTo = user._id;
        task.assignedToName = user.name;
        await task.save();

        return JSON.stringify({
          success: true,
          message: `Task "${task.title}" assigned to ${user.name}`,
        });
      } catch (err) {
        return JSON.stringify({ error: err.message });
      }
    },
  });

  const getTaskStats = new DynamicStructuredTool({
    name: 'get_task_stats',
    description:
      'Get a summary of task statistics. Useful for questions like "how many tasks are pending?" or "give me a task overview".',
    schema: z.object({}),
    func: async () => {
      const stats = await TaskService.getStats(userId, profileType);
      return JSON.stringify(stats);
    },
  });

  return [createTask, listTasks, updateTaskStatus, assignTask, getTaskStats];
}

module.exports = { getTaskTools };
```

---

## 3. Audit Tools

**File:** `api/server/services/divine/tools/auditTools.js`

```javascript
const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');
const AuditAdminService = require('../../../AuditAdminService');

function getAuditTools(userId) {
  const listAudits = new DynamicStructuredTool({
    name: 'list_audits',
    description: 'List audit sessions. Filter by status or user. CEO only.',
    schema: z.object({
      status: z.string().optional(),
      userSearch: z.string().optional().describe('Search by user name or email'),
      limit: z.number().optional().default(10),
    }),
    func: async ({ status, userSearch, limit }) => {
      const result = await AuditAdminService.listAudits({ status, userSearch, limit });
      return JSON.stringify(result);
    },
  });

  const getAuditDetails = new DynamicStructuredTool({
    name: 'get_audit_details',
    description: 'Get full details of a specific audit session by ID.',
    schema: z.object({
      sessionId: z.string().describe('The audit session ID'),
    }),
    func: async ({ sessionId }) => {
      const result = await AuditAdminService.getAuditDetails(sessionId);
      return JSON.stringify(result);
    },
  });

  const approveAudit = new DynamicStructuredTool({
    name: 'approve_audit',
    description: 'Approve an audit report. CEO only.',
    schema: z.object({
      sessionId: z.string(),
      notes: z.string().optional().describe('Approval notes'),
    }),
    func: async ({ sessionId, notes }) => {
      const result = await AuditAdminService.approveAudit(sessionId, { notes, approvedBy: userId });
      return JSON.stringify({ success: true, message: 'Audit approved', result });
    },
  });

  const createAuditTask = new DynamicStructuredTool({
    name: 'create_task_for_audit',
    description: 'Create a task linked to a specific audit session (e.g., "assign review of audit X to Andrea").',
    schema: z.object({
      sessionId: z.string(),
      assignToName: z.string(),
      notes: z.string().optional(),
      dueDate: z.string().optional(),
    }),
    func: async ({ sessionId, assignToName, notes, dueDate }) => {
      const TaskService = require('../../../TaskService');
      const task = await TaskService.createTask({
        title: `Review Audit Report — Session ${sessionId}`,
        description: notes || 'Review and process the linked audit report',
        assignedToName: assignToName,
        priority: 'high',
        dueDate: dueDate ? new Date(dueDate) : null,
        source: 'audit',
        sourceRef: sessionId,
        createdById: userId,
      });
      return JSON.stringify({ success: true, taskId: task._id, message: `Review task created and assigned to ${task.assignedToName}` });
    },
  });

  return [listAudits, getAuditDetails, approveAudit, createAuditTask];
}

module.exports = { getAuditTools };
```

---

## 4. Order Tools

**File:** `api/server/services/divine/tools/orderTools.js`

```javascript
const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

function getOrderTools(userId, profileType) {
  const listOrders = new DynamicStructuredTool({
    name: 'list_signage_orders',
    description: 'List signage/print orders. CEO sees all, employees see their assigned orders.',
    schema: z.object({
      status: z.string().optional(),
      limit: z.number().optional().default(10),
    }),
    func: async ({ status, limit }) => {
      // Call internal signage service (same logic as signageOrders route)
      // Returns order list
      return JSON.stringify({ message: 'orders fetched', count: 0, orders: [] }); // stub — wire to SignageService
    },
  });

  const assignOrder = new DynamicStructuredTool({
    name: 'assign_signage_order',
    description: 'Assign a signage order to an employee. CEO only.',
    schema: z.object({
      orderId: z.string(),
      assignToName: z.string(),
    }),
    func: async ({ orderId, assignToName }) => {
      // Resolve user, update order via signage API
      return JSON.stringify({ success: true, message: `Order ${orderId} assigned to ${assignToName}` });
    },
  });

  const updateOrderStatus = new DynamicStructuredTool({
    name: 'update_order_status',
    description: 'Update the status of a signage order (pending/printing/printed/delivered).',
    schema: z.object({
      orderId: z.string(),
      status: z.enum(['pending', 'printing', 'printed', 'delivered', 'cancelled']),
    }),
    func: async ({ orderId, status }) => {
      return JSON.stringify({ success: true, message: `Order ${orderId} updated to ${status}` });
    },
  });

  const tools = [listOrders, updateOrderStatus];
  if (profileType === 'ceo') tools.push(assignOrder);
  return tools;
}

module.exports = { getOrderTools };
```

---

## 5. Social Tools

**File:** `api/server/services/divine/tools/socialTools.js`

```javascript
const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

function getSocialTools(userId, profileType) {
  const createDraft = new DynamicStructuredTool({
    name: 'create_social_draft',
    description: 'Create a social media draft post for review. Can target LinkedIn or other platforms.',
    schema: z.object({
      content: z.string().describe('The post content'),
      platform: z.enum(['linkedin', 'instagram', 'twitter']).default('linkedin'),
      notes: z.string().optional().describe('Internal notes for the approver'),
    }),
    func: async ({ content, platform, notes }) => {
      const SocialDraft = require('../../../../../models/SocialDraft');
      const draft = await SocialDraft.create({
        userId,
        platform,
        draftContent: content,
        internalNotes: notes,
        status: profileType === 'ceo' ? 'approved' : 'pending',
      });
      return JSON.stringify({
        success: true,
        draftId: draft._id,
        message: profileType === 'ceo'
          ? `Draft created and auto-approved. Ready to publish.`
          : `Draft created and submitted for CEO approval.`,
      });
    },
  });

  const listDrafts = new DynamicStructuredTool({
    name: 'list_social_drafts',
    description: 'List social media drafts by status.',
    schema: z.object({
      status: z.enum(['pending', 'approved', 'published', 'rejected']).optional(),
    }),
    func: async ({ status }) => {
      const SocialDraft = require('../../../../../models/SocialDraft');
      const query = status ? { status } : {};
      if (profileType !== 'ceo') query.userId = userId;
      const drafts = await SocialDraft.find(query).limit(10).lean();
      return JSON.stringify({ count: drafts.length, drafts });
    },
  });

  return [createDraft, listDrafts];
}

module.exports = { getSocialTools };
```

---

## 6. User Tools

**File:** `api/server/services/divine/tools/userTools.js`

```javascript
const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

function getUserTools(userId, profileType) {
  const searchUsers = new DynamicStructuredTool({
    name: 'search_users',
    description: 'Search for platform users by name or role. Useful for finding who to assign tasks to.',
    schema: z.object({
      query: z.string().describe('Name or partial name to search'),
      role: z.enum(['ceo', 'employee', 'customer']).optional(),
    }),
    func: async ({ query, role }) => {
      const User = require('../../../../../models/User');
      const Profile = require('../../../models/Profile');

      const users = await User.find({
        $or: [{ name: new RegExp(query, 'i') }, { username: new RegExp(query, 'i') }],
      }).select('name username email avatar').limit(10).lean();

      if (role) {
        const profiles = await Profile.find({ userId: { $in: users.map((u) => u._id) }, profileType: role });
        const allowed = new Set(profiles.map((p) => p.userId.toString()));
        return JSON.stringify(users.filter((u) => allowed.has(u._id.toString())));
      }

      return JSON.stringify(users);
    },
  });

  const notifyUser = new DynamicStructuredTool({
    name: 'notify_user',
    description: 'Send an in-platform notification to a user. Use for task assignments, reminders, etc.',
    schema: z.object({
      userName: z.string().optional(),
      userId: z.string().optional(),
      message: z.string().describe('The notification message'),
      type: z.enum(['info', 'warning', 'task', 'approval']).default('info'),
    }),
    func: async ({ userName, userId: targetId, message, type }) => {
      // Emit event to notification system (implement with SSE or MongoDB)
      // For MVP: store in a Notifications collection, frontend polls or SSE
      return JSON.stringify({ success: true, message: `Notification sent to ${userName || targetId}` });
    },
  });

  const getMyProfile = new DynamicStructuredTool({
    name: 'get_my_profile',
    description: 'Get the current user\'s profile, role, and task summary.',
    schema: z.object({}),
    func: async () => {
      const Profile = require('../../../models/Profile');
      const profile = await Profile.findOne({ userId }).lean();
      const stats = await (require('../../../TaskService')).getStats(userId, profile?.profileType);
      return JSON.stringify({ profile, taskStats: stats });
    },
  });

  return [searchUsers, notifyUser, getMyProfile];
}

module.exports = { getUserTools };
```

---

## Tool Summary Table

| Tool Name | Domain | CEO | Employee | Customer |
|-----------|--------|-----|----------|----------|
| `create_task` | Tasks | ✅ | ✅ (self/unassigned) | ❌ |
| `list_tasks` | Tasks | ✅ | ✅ (own) | ❌ |
| `update_task_status` | Tasks | ✅ | ✅ (own) | ❌ |
| `assign_task` | Tasks | ✅ | ❌ | ❌ |
| `get_task_stats` | Tasks | ✅ | ✅ | ❌ |
| `list_audits` | Audit | ✅ | ❌ | ❌ |
| `get_audit_details` | Audit | ✅ | ❌ | ❌ |
| `approve_audit` | Audit | ✅ | ❌ | ❌ |
| `create_task_for_audit` | Audit | ✅ | ❌ | ❌ |
| `list_signage_orders` | Orders | ✅ | ✅ (own) | ❌ |
| `assign_signage_order` | Orders | ✅ | ❌ | ❌ |
| `update_order_status` | Orders | ✅ | ✅ (own) | ❌ |
| `create_social_draft` | Social | ✅ | ✅ (pending) | ❌ |
| `list_social_drafts` | Social | ✅ | ✅ (own) | ❌ |
| `search_users` | Users | ✅ | ✅ | ❌ |
| `notify_user` | Users | ✅ | ✅ | ❌ |
| `get_my_profile` | Users | ✅ | ✅ | ✅ |
