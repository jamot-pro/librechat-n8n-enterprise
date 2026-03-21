const mongoose = require('mongoose');

const hiringColumnSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('HiringColumn', hiringColumnSchema);
