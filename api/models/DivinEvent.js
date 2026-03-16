const mongoose = require('mongoose');

const DivinEventSchema = new mongoose.Schema({
  trigger: {
    type: String,
    required: true,
    // e.g. 'cron:overdueTaskEscalation' | 'event:task:created'
  },
  prompt: { type: String },
  response: { type: String },
  toolsUsed: [String],
  success: { type: Boolean, default: true },
  error: { type: String },
  duration: { type: Number }, // ms
  createdAt: { type: Date, default: Date.now, index: true },
});

DivinEventSchema.index({ trigger: 1, createdAt: -1 });
DivinEventSchema.index({ success: 1, createdAt: -1 });

module.exports = mongoose.model('DivinEvent', DivinEventSchema);
