'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'bralirwa_beer_secret_2026';

// Hardcoded users for each organization
const USERS = [
  {
    id: 1,
    email: 'admin@supplier.com',
    password: 'password123',
    name: 'Supplier Admin',
    mspId: 'SupplierMSP',
    role: 'supplier',
  },
  {
    id: 2,
    email: 'admin@manufacturer.com',
    password: 'password123',
    name: 'Manufacturer Admin',
    mspId: 'ManufacturerMSP',
    role: 'manufacturer',
  },
  {
    id: 3,
    email: 'admin@distributor.com',
    password: 'password123',
    name: 'Distributor Admin',
    mspId: 'DistributorMSP',
    role: 'distributor',
  },
  {
    id: 4,
    email: 'admin@retailer.com',
    password: 'password123',
    name: 'Retailer Admin',
    mspId: 'RetailerMSP',
    role: 'retailer',
  },
];

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = USERS.find(u => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        mspId: user.mspId,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✓ Login successful: ${user.email} [${user.mspId}]`);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mspId: user.mspId,
        role: user.role,
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

    return res.status(200).json({ user: decoded });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;