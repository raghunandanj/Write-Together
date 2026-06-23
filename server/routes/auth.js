const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/User");
const requireAuth = require("../middleware/requireAuth");

// Helper: creates a signed JWT containing the user's id.
// This token is what the client will send back on every future request
// to prove "I am this user" without sending a password every time.
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Note: we don't hash the password here - the User model's
    // pre("save") hook does that automatically when we call .create()
    const user = await User.create({ name, email, password });

    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: "Signup failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Deliberately vague - don't reveal whether the email exists or not
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// PUT /api/auth/profile
router.put("/profile", requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const finalEmail = email.trim().toLowerCase();

    // Check if email is taken by another user
    const existing = await User.findOne({ email: finalEmail });
    if (existing && existing._id.toString() !== String(req.userId)) {
      return res.status(409).json({ error: "Email is already in use" });
    }

    const user = await User.findById(req.userId);
    user.name = name.trim();
    user.email = finalEmail;
    await user.save();

    res.json({ id: user._id, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// PUT /api/auth/password
router.put("/password", requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "Old password and new password are required" });
    }

    const user = await User.findById(req.userId);
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect old password" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update password" });
  }
});

module.exports = router;
