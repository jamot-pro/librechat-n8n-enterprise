const mongoose = require('mongoose');

/**
 * AuditPrompt — versioned prompt templates for the audit platform.
 *
 * Each edit creates a new document with an incremented version.
 * Only one version per key has isLatest=true at any time.
 *
 * Key format: prompt_<name_with_underscores> (no spaces, lowercase)
 * Version: integer starting at 1, incremented on each edit
 */
const AuditPromptSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      match: [/^prompt_[a-z0-9_]+$/, 'Key must match: prompt_<lowercase_underscored_name>'],
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'general',
      index: true,
    },
    isLatest: {
      type: Boolean,
      default: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

// Compound indexes for common queries
AuditPromptSchema.index({ key: 1, version: 1 }, { unique: true });
AuditPromptSchema.index({ key: 1, isLatest: 1 });
AuditPromptSchema.index({ category: 1, isLatest: 1 });

module.exports = mongoose.model('AuditPrompt', AuditPromptSchema);
