'use strict';

const express = require('express');
const router = express.Router();
const { queryChaincode, invokeChaincode } = require('../services/fabricService');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/participants
router.get('/', async (req, res) => {
  try {
    const { mspId } = req.user;
    const participants = await queryChaincode(mspId, 'ListParticipants', []);
    return res.status(200).json({ success: true, data: participants });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/participants/:participantId
router.get('/:participantId', async (req, res) => {
  try {
    const { mspId } = req.user;
    const { participantId } = req.params;
    const participant = await queryChaincode(mspId, 'GetParticipant', [participantId]);
    return res.status(200).json({ success: true, data: participant });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/participants — Manufacturer Admin only
router.post('/', async (req, res) => {
  try {
    const { mspId, isAdmin } = req.user;

    // Only Manufacturer Admin can register participants
    if (mspId !== 'ManufacturerMSP' || !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Manufacturer Admin can register participants',
      });
    }

    const { participantId, name, role, contactInfo, district } = req.body;

    if (!participantId || !name || !role || !contactInfo) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const validRoles = ['supplier', 'manufacturer', 'distributor', 'retailer'];
    if (!validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({ success: false, error: `Invalid role` });
    }

    // District required for both distributor and retailer
    if ((role.toLowerCase() === 'distributor' || role.toLowerCase() === 'retailer') && !district) {
      return res.status(400).json({ success: false, error: 'District is required for distributor and retailer' });
    }

    const participant = await invokeChaincode(mspId, 'RegisterParticipant', [
      participantId, name, role, contactInfo, district || '',
    ]);

    return res.status(201).json({ success: true, data: participant });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
