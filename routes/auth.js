// routes/auth.js – Admin Authentication
'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

// ================================================================
// POST /api/auth/login
// ================================================================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  // Rate-limit check via session (simple brute-force protection)
  if (!req.session.loginAttempts) req.session.loginAttempts = 0;
  if (req.session.loginAttempts >= 10) {
    return res.status(429).json({ success: false, error: 'Too many login attempts. Please wait and try again.' });
  }

  try {
    const admin = await Admin.findOne({ username: username.trim() });

    if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
      req.session.loginAttempts = (req.session.loginAttempts || 0) + 1;
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    // Successful login — store session
    req.session.loginAttempts = 0;
    req.session.adminId = admin._id;
    req.session.adminUsername = admin.username;

    console.log(`🔐 Admin "${admin.username}" logged in at ${new Date().toLocaleString('en-IN')}`);

    return res.json({ success: true, username: admin.username });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ================================================================
// POST /api/auth/logout
// ================================================================
router.post('/logout', (req, res) => {
  const username = req.session.adminUsername || 'unknown';
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ success: false, error: 'Logout failed.' });
    }
    console.log(`👋 Admin "${username}" logged out.`);
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

// ================================================================
// GET /api/auth/me  — Check if currently logged in
// ================================================================
router.get('/me', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.json({ loggedIn: true, username: req.session.adminUsername });
  }
  return res.json({ loggedIn: false });
});

module.exports = router;
