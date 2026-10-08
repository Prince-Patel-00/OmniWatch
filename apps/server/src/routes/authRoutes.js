import express from 'express';
import { findUserByEmail, findUserById, createUser } from '../db.js';
import { verifyPassword, signToken, requireAuth } from '../auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name || user.email.split('@')[0]
      }
    });
  } catch (err) {
    console.error('Error in auth login:', err);
    res.status(500).json({ success: false, error: 'Login failed: ' + err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email address is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    const newUser = await createUser({
      email,
      password,
      displayName: displayName || email.split('@')[0]
    });

    const token = signToken({ userId: newUser.id, email: newUser.email });
    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName
      }
    });
  } catch (err) {
    console.error('Error in auth register:', err);
    res.status(500).json({ success: false, error: 'Registration failed: ' + err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name || user.email.split('@')[0]
      }
    });
  } catch (err) {
    console.error('Error in auth /me:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve profile: ' + err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
