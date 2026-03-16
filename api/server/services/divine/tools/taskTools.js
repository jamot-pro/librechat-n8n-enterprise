const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const TaskService = require('../../TaskService');
const { User } = require('~/db/models');

function getTaskTools(userId, profileType) {
  const createTask = tool(
    async ({ title, description, assignedToName, priority, dueDate, tags }) => {
      try {
        const task = await TaskService.createTask({
          title,
          description,
          assignedToName,
          priority: priority || 'medium',
          dueDate: dueDate ? new Date(dueDate) : null,
          tags: tags || [],
          createdById: userId,
          source: 'divine_chat',
        });
        const assignMsg = task.assignedToName ? ` and assigned to ${task.assignedToName}` : ' (unassigned)';
        return `Task "${task.title}" created successfully${assignMsg}.`;
      } catch (err) {
        return `Failed to create task: ${err.message}`;
      }
    },
    {
      name: 'create_task',
      description:
        'Create a new task and optionally assign it to a team member by name. ' +
        'Use when user says things like "create a task for Andrea to do X" or "add a task: title, assign to John, due Friday".',
      schema: z.object({
        title: z.string().describe('Short task title (max 200 chars)'),
        description: z.string().optional().describe('Detailed description of what needs to be done'),
        assignedToName: z.string().optional().describe('Full or partial name of the person to assign to'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        dueDate: z.string().optional().describe('Due date as YYYY-MM-DD'),
        tags: z.array(z.string()).optional(),
      }),
    },
  );

  const listTasks = tool(
    async ({ assignedToName, status, priority, overdue, limit }) => {
      try {
        let assignedToId;
        if (assignedToName) {
          const user = await User.findOne({
            $or: [
              { name: new RegExp(assignedToName.trim(), 'i') },
              { username: new RegExp(assignedToName.trim(), 'i') },
            ],
          }).lean();
          if (!user) return `User "${assignedToName}" not found.`;
          assignedToId = user._id;
        } else if (profileType === 'employee') {
          assignedToId = userId;
        }

        const tasks = overdue
          ? await TaskService.getOverdueTasks()
          : (await TaskService.listTasks({ assignedTo: assignedToId, status, priority, limit: limit || 10 })).tasks;

        if (!tasks.length) return 'No tasks found matching those filters.';

        const lines = tasks.map((t) => {
          const due = t.dueDate ? ` | due ${new Date(t.dueDate).toLocaleDateString()}` : '';
          const who = t.assignedToName ? ` → ${t.assignedToName}` : '';
          return `• [${t._id}] "${t.title}" [${t.status}] [${t.priority}]${who}${due}`;
        });
        return `Found ${tasks.length} task(s):\n${lines.join('\n')}`;
      } catch (err) {
        return `Failed to list tasks: ${err.message}`;
      }
    },
    {
      name: 'list_tasks',
      description:
        'List tasks with optional filters. Use to answer "what tasks does Andrea have?", "show urgent tasks", "what is overdue?".',
      schema: z.object({
        assignedToName: z.string().optional().describe('Filter by assignee name'),
        status: z.enum(['todo', 'in_progress', 'review', 'done', 'cancelled']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        overdue: z.boolean().optional().describe('True to only show overdue tasks'),
        limit: z.number().optional(),
      }),
    },
  );

  const updateTaskStatus = tool(
    async ({ taskId, taskTitle, status }) => {
      try {
        const Task = require('../../../../../models/Task');
        let task;
        if (taskId) {
          task = await Task.findById(taskId);
        } else if (taskTitle) {
          task = await Task.findOne({ title: new RegExp(taskTitle.trim(), 'i'), isDeleted: false });
        }
        if (!task) return 'Task not found. Try list_tasks to find the correct task ID or title.';
        task.status = status;
        await task.save();
        return `Task "${task.title}" updated to "${status}".`;
      } catch (err) {
        return `Failed to update task: ${err.message}`;
      }
    },
    {
      name: 'update_task_status',
      description: 'Update the status of an existing task. Use when user says "mark task X as done" or "move task to in progress".',
      schema: z.object({
        taskId: z.string().optional().describe('Task ID if known'),
        taskTitle: z.string().optional().describe('Task title to search for if ID unknown'),
        status: z.enum(['todo', 'in_progress', 'review', 'done', 'cancelled']),
      }),
    },
  );

  const assignTask = tool(
    async ({ taskId, taskTitle, assignToName }) => {
      try {
        const Task = require('../../../../../models/Task');
        let task;
        if (taskId) {
          task = await Task.findById(taskId);
        } else if (taskTitle) {
          task = await Task.findOne({ title: new RegExp(taskTitle.trim(), 'i'), isDeleted: false });
        }
        if (!task) return 'Task not found.';

        const user = await User.findOne({
          $or: [
            { name: new RegExp(assignToName.trim(), 'i') },
            { username: new RegExp(assignToName.trim(), 'i') },
          ],
        }).lean();
        if (!user) return `User "${assignToName}" not found.`;

        task.assignedTo = user._id;
        task.assignedToName = user.name || user.username;
        await task.save();
        return `Task "${task.title}" assigned to ${task.assignedToName}.`;
      } catch (err) {
        return `Failed to assign task: ${err.message}`;
      }
    },
    {
      name: 'assign_task',
      description: 'Assign or reassign a task to a team member by name.',
      schema: z.object({
        taskId: z.string().optional(),
        taskTitle: z.string().optional(),
        assignToName: z.string().describe('Name of the person to assign to'),
      }),
    },
  );

  const getTaskStats = tool(
    async () => {
      try {
        const stats = await TaskService.getStats({ userId, profileType });
        const byStatus = stats.byStatus.map((s) => `${s._id}: ${s.count}`).join(', ');
        return `Task summary — Total: ${stats.total} | ${byStatus} | Overdue: ${stats.overdue}`;
      } catch (err) {
        return `Failed to get stats: ${err.message}`;
      }
    },
    {
      name: 'get_task_stats',
      description: 'Get a summary of task counts by status. Useful for "how many tasks are pending?" or "give me a task overview".',
      schema: z.object({}),
    },
  );

  const tools = [createTask, listTasks, getTaskStats];
  if (profileType === 'ceo' || profileType === 'employee') {
    tools.push(updateTaskStatus);
  }
  if (profileType === 'ceo') {
    tools.push(assignTask);
  }
  return tools;
}

module.exports = { getTaskTools };
