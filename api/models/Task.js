const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String },
  text: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
});

const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },

    // Assignment
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedToName: { type: String, default: null },

    // Status: todo → in_progress → review → done | cancelled
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

    // How was this task created?
    source: {
      type: String,
      enum: ['manual', 'divine_chat', 'divine_autonomous', 'audit', 'signage', 'social'],
      default: 'manual',
    },

    // ID of the entity that spawned this task (auditSessionId, orderId, etc.)
    sourceRef: { type: String, default: null },

    tags: [{ type: String, trim: true, maxlength: 50 }],

    comments: [CommentSchema],

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ createdBy: 1 });
TaskSchema.index({ status: 1, dueDate: 1 });
TaskSchema.index({ source: 1, sourceRef: 1 });
TaskSchema.index({ isDeleted: 1, status: 1 });

module.exports = mongoose.model('Task', TaskSchema);
