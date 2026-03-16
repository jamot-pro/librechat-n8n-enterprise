const { User } = require('~/db/models');
const TaskService = require('../services/TaskService');
const Profile = require('../models/Profile');

// Lazy-load platformEvents to avoid circular deps at startup
function emitTaskCreated(task) {
  try {
    const { platformEvents } = require('../services/divine/autonomous/worker');
    platformEvents.emit('task:created', task);
  } catch (_) { /* worker not initialised yet — safe to ignore */ }
}

const TaskController = {
  /**
   * GET /api/tasks/board
   * Returns tasks grouped by status for kanban view
   */
  getBoard: async (req, res) => {
    try {
      const profile = req.userProfile;
      const userId = req.user._id.toString();

      let filter = {};
      if (profile.profileType === 'employee') {
        // Employees see tasks assigned to them
        filter.assignedTo = userId;
      } else if (profile.profileType === 'customer') {
        // Customers see tasks they created
        filter.createdBy = userId;
      }
      // CEO sees all tasks

      const board = await TaskService.getKanbanBoard(filter);
      res.json(board);
    } catch (err) {
      console.error('[TaskController.getBoard]', err);
      res.status(500).json({ error: 'Failed to load task board' });
    }
  },

  /**
   * GET /api/tasks
   * List tasks with optional filters
   */
  listTasks: async (req, res) => {
    try {
      const profile = req.userProfile;
      const userId = req.user._id.toString();
      const { status, priority, search, page = 1, limit = 50 } = req.query;

      let assignedTo;
      let createdBy;

      if (profile.profileType === 'employee') {
        assignedTo = userId;
      } else if (profile.profileType === 'customer') {
        createdBy = userId;
      }

      const result = await TaskService.listTasks({
        assignedTo,
        createdBy,
        status,
        priority,
        search,
        limit,
        skip: (page - 1) * limit,
      });

      res.json({ ...result, page: Number(page), limit: Number(limit) });
    } catch (err) {
      console.error('[TaskController.listTasks]', err);
      res.status(500).json({ error: 'Failed to list tasks' });
    }
  },

  /**
   * GET /api/tasks/stats
   */
  getStats: async (req, res) => {
    try {
      const profile = req.userProfile;
      const userId = req.user._id.toString();
      const stats = await TaskService.getStats({ userId, profileType: profile.profileType });
      res.json(stats);
    } catch (err) {
      console.error('[TaskController.getStats]', err);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  },

  /**
   * GET /api/tasks/:taskId
   */
  getTask: async (req, res) => {
    try {
      const task = await TaskService.getTaskById(req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (err) {
      console.error('[TaskController.getTask]', err);
      res.status(500).json({ error: 'Failed to get task' });
    }
  },

  /**
   * POST /api/tasks
   */
  createTask: async (req, res) => {
    try {
      const profile = req.userProfile;
      const userId = req.user._id.toString();
      const { title, description, assignedToName, assignedToId, priority, dueDate, tags, sourceRef } = req.body;

      if (!title?.trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }

      // Role restrictions
      if (profile.profileType === 'customer') {
        // Customers create unassigned support requests
        const task = await TaskService.createTask({
          title, description, priority: 'medium',
          source: 'manual', tags, createdById: userId,
          createdByName: req.user.name || req.user.username,
        });
        emitTaskCreated(task);
        return res.status(201).json(task);
      }

      if (profile.profileType === 'employee') {
        // Employees can only self-assign
        const task = await TaskService.createTask({
          title, description, priority,
          assignedToId: userId,
          assignedToName: req.user.name || req.user.username,
          dueDate, tags, source: 'manual', sourceRef,
          createdById: userId,
          createdByName: req.user.name || req.user.username,
        });
        emitTaskCreated(task);
        return res.status(201).json(task);
      }

      // CEO: full control
      const task = await TaskService.createTask({
        title, description, priority, dueDate, tags, source: 'manual', sourceRef,
        assignedToId, assignedToName,
        createdById: userId,
        createdByName: req.user.name || req.user.username,
      });
      emitTaskCreated(task);
      res.status(201).json(task);
    } catch (err) {
      console.error('[TaskController.createTask]', err);
      if (err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      res.status(500).json({ error: 'Failed to create task' });
    }
  },

  /**
   * PUT /api/tasks/:taskId
   */
  updateTask: async (req, res) => {
    try {
      const profile = req.userProfile;
      const userId = req.user._id.toString();

      const task = await TaskService.getTaskById(req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      // Employees can only update their own assigned tasks
      if (
        profile.profileType === 'employee' &&
        task.assignedTo?.toString() !== userId
      ) {
        return res.status(403).json({ error: 'You can only update tasks assigned to you' });
      }

      const updated = await TaskService.updateTask(req.params.taskId, req.body);
      res.json(updated);
    } catch (err) {
      console.error('[TaskController.updateTask]', err);
      res.status(500).json({ error: 'Failed to update task' });
    }
  },

  /**
   * PATCH /api/tasks/:taskId/status
   * Lightweight status-only update (used by kanban drag-and-drop)
   */
  updateStatus: async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const profile = req.userProfile;
      const userId = req.user._id.toString();
      const task = await TaskService.getTaskById(req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      if (
        profile.profileType === 'employee' &&
        task.assignedTo?.toString() !== userId
      ) {
        return res.status(403).json({ error: 'You can only update tasks assigned to you' });
      }

      const updated = await TaskService.updateStatus(req.params.taskId, status);
      res.json(updated);
    } catch (err) {
      console.error('[TaskController.updateStatus]', err);
      res.status(500).json({ error: 'Failed to update status' });
    }
  },

  /**
   * PATCH /api/tasks/:taskId/assign
   * CEO only
   */
  assignTask: async (req, res) => {
    try {
      const profile = req.userProfile;
      if (profile.profileType !== 'ceo') {
        return res.status(403).json({ error: 'Only CEO can assign tasks to others' });
      }

      const { assignedToId, assignedToName } = req.body;
      if (!assignedToId) return res.status(400).json({ error: 'assignedToId required' });

      const user = await User.findById(assignedToId).select('name username').lean();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const updated = await TaskService.assignTask(
        req.params.taskId,
        assignedToId,
        assignedToName || user.name || user.username,
      );
      res.json(updated);
    } catch (err) {
      console.error('[TaskController.assignTask]', err);
      res.status(500).json({ error: 'Failed to assign task' });
    }
  },

  /**
   * POST /api/tasks/:taskId/comments
   */
  addComment: async (req, res) => {
    try {
      const { text } = req.body;
      if (!text?.trim()) return res.status(400).json({ error: 'Comment text required' });

      const task = await TaskService.addComment(req.params.taskId, {
        userId: req.user._id,
        userName: req.user.name || req.user.username,
        text: text.trim(),
      });
      res.json(task);
    } catch (err) {
      console.error('[TaskController.addComment]', err);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  },

  /**
   * DELETE /api/tasks/:taskId
   * CEO or task creator only
   */
  deleteTask: async (req, res) => {
    try {
      const profile = req.userProfile;
      const userId = req.user._id.toString();

      const task = await TaskService.getTaskById(req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      if (profile.profileType !== 'ceo' && task.createdBy?.toString() !== userId) {
        return res.status(403).json({ error: 'Only CEO or task creator can delete tasks' });
      }

      await TaskService.deleteTask(req.params.taskId);
      res.json({ success: true });
    } catch (err) {
      console.error('[TaskController.deleteTask]', err);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  },

  /**
   * GET /api/tasks/users
   * Search users for assignment dropdown (CEO only)
   */
  searchUsers: async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || q.trim().length < 1) return res.json([]);

      const users = await User.find({
        $or: [{ name: new RegExp(q.trim(), 'i') }, { username: new RegExp(q.trim(), 'i') }],
      })
        .select('_id name username avatar')
        .limit(10)
        .lean();

      res.json(users);
    } catch (err) {
      console.error('[TaskController.searchUsers]', err);
      res.status(500).json({ error: 'Search failed' });
    }
  },
};

module.exports = TaskController;
