const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Import the User model
const router = express.Router();
const jwt = require('jsonwebtoken');
// Route to register a new user
router.post('/register', async (req, res) => {
  const { email, username, phoneNumber, password } = req.body;
console.log("register ",email,username,phoneNumber,password)
  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }, { phoneNumber }] });
    if (existingUser) {
      return res.status(200).json({ success:false, message: 'User already exists with the given email, username, or phone number.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user
    const newUser = new User({
      email,
      username,
      phoneNumber,
      password: hashedPassword,
    });

    // Save the user to the database
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    try {
      // Check if the user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid email or password.' });
      }
  
      // Verify the password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Invalid email or password.' });
      }
  
      // Generate a JWT
      const token = jwt.sign({ id: user._id }, "sihwinners", { expiresIn: '1h' });
  
      // Set the token in a cookie
      res.cookie('token', token, {
        httpOnly: true, // Prevents client-side scripts from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Set to true in production
        sameSite: 'none', // Prevents CSRF attacks
        maxAge: 3600000, // 1 hour in milliseconds
      });
  
      res.status(200).json({ success: true, message: 'Login successful.' });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
  });
// Route to fetch all users (optional, for admin purposes)
router.get('/', async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Route to fetch a specific user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

// Route to delete a user by ID (optional, for admin purposes)
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

module.exports = router;
