const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  profileType: {
    type: String,
    enum: ['ceo', 'employee', 'customer'],
    required: true,
  },
  permissions: [
    {
      type: String,
      required: true,
    },
  ],
  allowedWorkflows: [
    {
      workflowId: String,
      workflowName: String,
      endpoint: String,
      description: String,
    },
  ],
  metadata: {
    department: String,
    customerId: String,
    securityLevel: {
      type: Number,
      default: 1,
    },
    companyId: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index untuk performance
ProfileSchema.index({ userId: 1, profileType: 1 });

// Update timestamp on save
ProfileSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Profile', ProfileSchema);
