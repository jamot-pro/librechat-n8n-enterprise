const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const DivineConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    messages: [MessageSchema],
  },
  { timestamps: true },
);

DivineConversationSchema.index({ userId: 1 });

module.exports = mongoose.model('DivineConversation', DivineConversationSchema);
