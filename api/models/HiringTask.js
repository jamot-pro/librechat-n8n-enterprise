const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema(
  { text: { type: String, required: true }, done: { type: Boolean, default: false } },
  { _id: true },
);

/** Image stored via existing Files/S3 pipeline; `url` is filepath at upload (S3 signed URLs may expire — see fileId for refresh). */
const taskAttachmentSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true },
    url: { type: String, required: true },
    filename: { type: String, default: '' },
  },
  { _id: false },
);

const hiringTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: null },
    labels: [{ type: String }],
    dueDate: { type: Date, default: null },
    assignee: { type: String, default: '' },
    checklist: [checklistItemSchema],
    attachments: { type: [taskAttachmentSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model('HiringTask', hiringTaskSchema);
