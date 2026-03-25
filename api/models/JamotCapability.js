const mongoose = require('mongoose');

/**
 * JamotCapability — singleton document storing platform capabilities as JSON.
 * Only one document exists. If empty, create. If exists, update.
 */
const JamotCapabilitySchema = new mongoose.Schema(
  {
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('JamotCapability', JamotCapabilitySchema);
