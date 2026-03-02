'use strict';

const express = require('express');
const router = express.Router();
const { queryChaincode, invokeChaincode } = require('../services/fabricService');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/participants — list all participants
router.get('/', async (req, res) => {
  try {
    const { mspId } = req.user;
    const participants = await queryChaincode(mspId, 'ListParticipants', []);
    return res.status(200).json({ success: true, data: participants });
  } catch (error) {
    console.error('ListParticipants error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/participants/:participantId — get one participant
router.get('/:participantId', async (req, res) => {
  try {
    const { mspId } = req.user;
    const { participantId } = req.params;
    const participant = await queryChaincode(mspId, 'GetParticipant', [participantId]);
    return res.status(200).json({ success: true, data: participant });
  } catch (error) {
    console.error('GetParticipant error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/participants — register a new participant
router.post('/', async (req, res) => {
  try {
    const { mspId } = req.user;
    const { participantId, name, role, contactInfo } = req.body;

    if (!participantId || !name || !role || !contactInfo) {
      return res.status(400).json({ success: false, error: 'Missing required fields: participantId, name, role, contactInfo' });
    }

    const validRoles = ['supplier', 'manufacturer', 'distributor', 'retailer'];
    if (!validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const participant = await invokeChaincode(mspId, 'RegisterParticipant', [
      participantId,
      name,
      role,
      contactInfo,
    ]);

    return res.status(201).json({ success: true, data: participant });
  } catch (error) {
    console.error('RegisterParticipant error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;