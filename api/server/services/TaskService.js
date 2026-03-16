const { User } = require('~/db/models');
const Task = require('../../models/Task');

class TaskService {
  /**
   * Resolve a user by name (for divine chat / natural language)
   */
  static async resolveUserByName(name) {
    const user = await User.findOne({
      $or: [{ name: new RegExp(name.trim(), 'i') }, { username: new RegExp(name.trim(), 'i') }],
    })
      .select('_id name username')
      .lean();
    return user || null;
  }

  /**
   * Create a task. Supports name-based assignee resolution for divine tools.
   */
  static async createTask({
    title,
    description,
    assignedToId,
    assignedToName,
    priority,
    dueDate,
    source,
    sourceRef,
    tags,
    createdById,
    createdByName,
  }) {
    let resolvedId = assignedToId;
    let resolvedName = assignedToName;

    if (!assignedToId && assignedToName) {
      const user = await TaskService.resolveUserByName(assignedToName);
      if (!user) {
        throw new Error(`User "${assignedToName}" not found on the platform`);
      }
      resolvedId = user._id;
      resolvedName = user.name || user.username;
    }

    const task = await Task.create({
      title: title.trim(),
      description: description?.trim() || '',
      assignedTo: resolvedId || null,
      assignedToName: resolvedName || null,
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      source: source || 'manual',
      sourceRef: sourceRef || null,
      tags: tags || [],
      createdBy: createdById,
      createdByName: createdByName || null,
    });

    return task;
  }

  /**
   * List tasks with filters
   */
  static async listTasks({
    assignedTo,
    createdBy,
    status,
    priority,
    search,
    limit = 50,
    skip = 0,
  } = {}) {
    const query = { isDeleted: false };

    if (assignedTo) query.assignedTo = assignedTo;
    if (createdBy) query.createdBy = createdBy;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) query.title = new RegExp(search.trim(), 'i');

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .populate('assignedTo', 'name username avatar')
        .populate('createdBy', 'name username')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(Number(skip))
        .lean(),
      Task.countDocuments(query),
    ]);

    return { tasks, total };
  }

  /**
   * Get all tasks grouped by status (for kanban board)
   */
  static async getKanbanBoard({ assignedTo, createdBy } = {}) {
    const query = { isDeleted: false, status: { $ne: 'cancelled' } };
    if (assignedTo) query.assignedTo = assignedTo;
    if (createdBy) query.createdBy = createdBy;

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name username avatar')
      .populate('createdBy', 'name username')
      .sort({ priority: 1, createdAt: -1 })
      .lean();

    const board = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };

    for (const task of tasks) {
      if (board[task.status]) board[task.status].push(task);
    }

    return board;
  }

  /**
   * Get a single task by ID
   */
  static async getTaskById(taskId) {
    return Task.findOne({ _id: taskId, isDeleted: false })
      .populate('assignedTo', 'name username avatar')
      .populate('createdBy', 'name username')
      .populate('comments.userId', 'name username avatar')
      .lean();
  }

  /**
   * Update task fields
   */
  static async updateTask(taskId, updates) {
    const allowed = ['title', 'description', 'status', 'priority', 'dueDate', 'tags'];
    const sanitized = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) sanitized[key] = updates[key];
    }
    return Task.findByIdAndUpdate(taskId, sanitized, { new: true }).lean();
  }

  /**
   * Update status only (for drag-and-drop)
   */
  static async updateStatus(taskId, status) {
    return Task.findByIdAndUpdate(taskId, { status }, { new: true }).lean();
  }

  /**
   * Assign task to a user
   */
  static async assignTask(taskId, userId, userName) {
    return Task.findByIdAndUpdate(
      taskId,
      { assignedTo: userId, assignedToName: userName },
      { new: true },
    ).lean();
  }

  /**
   * Add a comment to a task
   */
  static async addComment(taskId, { userId, userName, text }) {
    const task = await Task.findByIdAndUpdate(
      taskId,
      { $push: { comments: { userId, userName, text } } },
      { new: true },
    )
      .populate('comments.userId', 'name username avatar')
      .lean();
    return task;
  }

  /**
   * Soft delete a task
   */
  static async deleteTask(taskId) {
    return Task.findByIdAndUpdate(taskId, { isDeleted: true }, { new: true });
  }

  /**
   * Get overdue tasks (used by autonomous engine)
   */
  static async getOverdueTasks() {
    return Task.find({
      status: { $in: ['todo', 'in_progress'] },
      dueDate: { $lt: new Date() },
      isDeleted: false,
    })
      .populate('assignedTo', 'name email')
      .lean();
  }

  /**
   * Get unassigned tasks (used by autonomous engine)
   */
  static async getUnassignedTasks() {
    return Task.find({ assignedTo: null, status: 'todo', isDeleted: false }).lean();
  }

  /**
   * Get stats for dashboard widget
   */
  static async getStats({ userId, profileType } = {}) {
    const baseQuery = { isDeleted: false };
    if (profileType !== 'ceo') baseQuery.assignedTo = userId;

    const [total, byStatus, overdue, byPriority] = await Promise.all([
      Task.countDocuments(baseQuery),
      Task.aggregate([
        { $match: { ...baseQuery } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.countDocuments({
        ...baseQuery,
        status: { $in: ['todo', 'in_progress'] },
        dueDate: { $lt: new Date() },
      }),
      Task.aggregate([
        { $match: { ...baseQuery, status: { $ne: 'done' } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
    ]);

    return { total, byStatus, overdue, byPriority };
  }
}

module.exports = TaskService;
