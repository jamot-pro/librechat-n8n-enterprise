const mongoose = require('mongoose');

/**
 * In-app notifications created by the Divine agent via notify_user tool.
 * Displayed in the frontend notification bell / activity panel.
 */
const DivineNotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
  },
  // Optional context link (e.g. task ID, order ID)
  refType: { type: String }, // 'task' | 'order' | 'audit' | 'social_draft' | 'briefing'
  refId: { type: String },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

DivineNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('DivineNotification', DivineNotificationSchema);
