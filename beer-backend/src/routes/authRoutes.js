'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../services/database');

const JWT_SECRET = process.env.JWT_SECRET || 'bralirwa_beer_secret_2026';

const VALID_ROLES = {
  supplier:     'SupplierMSP',
  manufacturer: 'ManufacturerMSP',
  distributor:  'DistributorMSP',
  retailer:     'RetailerMSP',
};

function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Only admins can perform this action' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/auth/register — Admin only
router.post('/register', requireAdmin, (req, res) => {
  try {
    const { email, password, name, role, participantId } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name and role are required' });
    }

    if (!VALID_ROLES[role.toLowerCase()]) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${Object.keys(VALID_ROLES).join(', ')}` });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const mspId = VALID_ROLES[role.toLowerCase()];
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO users (email, password, name, mspId, role, isAdmin, participantId)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(email, hashedPassword, name, mspId, role.toLowerCase(), participantId || null);

    const user = db.prepare('SELECT id, email, name, mspId, role, isAdmin, participantId FROM users WHERE id = ?').get(result.lastInsertRowid);

    console.log(`✓ New user registered: ${email} [${mspId}] participant=${participantId}`);
    return res.status(201).json({ message: 'User registered successfully', user: { ...user, isAdmin: user.isAdmin === 1 } });
  } catch (error) {
    console.error('Register error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      {
        id:            user.id,
        email:         user.email,
        name:          user.name,
        mspId:         user.mspId,
        role:          user.role,
        isAdmin:       user.isAdmin === 1,
        participantId: user.participantId || null,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✓ Login: ${user.email} [${user.mspId}] participant=${user.participantId}`);

    return res.status(200).json({
      token,
      user: {
        id:            user.id,
        email:         user.email,
        name:          user.name,
        mspId:         user.mspId,
        role:          user.role,
        isAdmin:       user.isAdmin === 1,
        participantId: user.participantId || null,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, mspId, role, isAdmin, participantId FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user: { ...user, isAdmin: user.isAdmin === 1 } });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// GET /api/auth/users — Admin only
router.get('/users', requireAdmin, (req, res) => {
  try {
    const users = db.prepare('SELECT id, email, name, mspId, role, isAdmin, participantId, createdAt FROM users ORDER BY createdAt DESC').all();
    return res.status(200).json({ success: true, data: users.map(u => ({ ...u, isAdmin: u.isAdmin === 1 })) });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/auth/users/:id — Admin only
router.delete('/users/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isAdmin === 1) return res.status(403).json({ error: 'Cannot delete admin users' });
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;