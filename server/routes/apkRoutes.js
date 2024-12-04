const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Apk = require('../models/ApkModel');
const User = require('../models/User');
require('dotenv').config();

const router = express.Router();
const mongoURI = process.env.MONGO_URI;

// Create MongoDB connection
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Initialize GridFS
let gfs;
conn.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'uploads' });
});

// Configure GridFS storage
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return {
      bucketName: 'uploads',
      filename: `file-${Date.now()}-${file.originalname}`,
    };
  },
});
const upload = multer({ storage });

// Route to handle file uploads
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  try {
    const { userId } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Create a new APK record
    const apk = new Apk({
      filename: req.file.filename,
      fileId: req.file.id,
      userId: userId,
    });
    await apk.save();

    // Update user with the uploaded APK reference
    user.uploadedFiles.push(apk._id);
    await user.save();

    res.status(200).json({
      message: 'APK file uploaded successfully and linked to the user.',
      apk,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload the APK file.', error });
  }
});

module.exports = router;
