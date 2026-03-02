'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const batchRoutes = require('./src/routes/batchRoutes');
const participantRoutes = require('./src/routes/participantRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Bralirwa SCM Backend is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/participants', participantRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🍺 Bralirwa SCM Backend');
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ Network path: ${process.env.FABRIC_NETWORK_PATH}`);
  console.log(`✓ Channel: ${process.env.FABRIC_CHANNEL}`);
  console.log(`✓ Chaincode: ${process.env.FABRIC_CHAINCODE}`);
  console.log('');
});

module.exports = app;