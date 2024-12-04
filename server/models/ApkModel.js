const mongoose = require('mongoose');

const ApkSchema = new mongoose.Schema({
  filename: { type: String, required: true }, // Original filename
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true }, // GridFS file ID
  uploadedAt: { type: Date, default: Date.now }, // Upload timestamp
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the user
});

module.exports = mongoose.model('Apk', ApkSchema);
