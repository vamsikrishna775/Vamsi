require('dotenv').config(); // To manage environment variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const userRoutes = require('./routes/userRoutes'); // Import the user routes

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON requests

// Set the upload directory (e.g., E:/uploads or D:/uploads)
const uploadPath = 'E:/uploads'; // Adjust this path as needed

// Ensure the upload folder exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + '-' + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Failed to connect to MongoDB:', err));

// Use user routes
app.use('/api/users', userRoutes);

// Endpoint for uploading APK files
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }
  res.status(200).json({
    message: `File uploaded successfully to ${uploadPath}`,
    filePath: req.file.path,
  });
});

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error. Please try again later.' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
