'use strict';

const express = require('express');
const router = express.Router();
const { queryChaincode, invokeChaincode } = require('../services/fabricService');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/batches
router.get('/', async (req, res) => {
  try {
    const { mspId } = req.user;
    const batches = await queryChaincode(mspId, 'ListBatches', []);
    return res.status(200).json({ success: true, data: batches });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/batches/my
router.get('/my', async (req, res) => {
  try {
    const { mspId } = req.user;
    const batches = await queryChaincode(mspId, 'ListBatchesByOwner', []);
    return res.status(200).json({ success: true, data: batches });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/batches/:batchId
router.get('/:batchId', async (req, res) => {
  try {
    const { mspId } = req.user;
    const { batchId } = req.params;
    const batch = await queryChaincode(mspId, 'QueryBatch', [batchId]);
    return res.status(200).json({ success: true, data: batch });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/batches/:batchId/history
router.get('/:batchId/history', async (req, res) => {
  try {
    const { mspId } = req.user;
    const { batchId } = req.params;
    const history = await queryChaincode(mspId, 'GetBatchHistory', [batchId]);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/batches
router.post('/', async (req, res) => {
  try {
    const { mspId, role, name, email } = req.user;

    if (role !== 'manufacturer') {
      return res.status(403).json({ success: false, error: 'Only Manufacturer can create batches' });
    }

    const { batchId, beerType, quantity, manufacturerId, productionDate, expirationDate, ingredients } = req.body;

    if (!batchId || !beerType || !quantity || !manufacturerId || !productionDate || !expirationDate) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const ingredientsStr = ingredients ? JSON.stringify(ingredients) : '{}';
    const performedBy = JSON.stringify({ name, email, mspId });

    const batch = await invokeChaincode(mspId, 'CreateBeerBatch', [
      batchId,
      beerType,
      quantity.toString(),
      manufacturerId,
      productionDate,
      expirationDate,
      ingredientsStr,
      performedBy,
    ]);

    return res.status(201).json({ success: true, data: batch });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/batches/:batchId/transfer
router.post('/:batchId/transfer', async (req, res) => {
  try {
    const { mspId, role, name, email } = req.user;

    if (role !== 'manufacturer' && role !== 'distributor') {
      return res.status(403).json({ success: false, error: 'Only Manufacturer or Distributor can transfer batches' });
    }

    const { batchId } = req.params;
    const { toParticipantId } = req.body;

    if (!toParticipantId) {
      return res.status(400).json({ success: false, error: 'toParticipantId is required' });
    }

    const performedBy = JSON.stringify({ name, email, mspId });

    const batch = await invokeChaincode(mspId, 'TransferBatch', [
      batchId,
      toParticipantId,
      performedBy,
    ]);

    return res.status(200).json({ success: true, data: batch });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/batches/:batchId/sale
router.post('/:batchId/sale', async (req, res) => {
  try {
    const { mspId, role, name, email } = req.user;

    if (role !== 'retailer') {
      return res.status(403).json({ success: false, error: 'Only Retailer can record sales' });
    }

    const { batchId } = req.params;
    const { quantitySold, saleInfo } = req.body;

    if (!quantitySold) {
      return res.status(400).json({ success: false, error: 'quantitySold is required' });
    }

    const saleInfoStr = saleInfo ? JSON.stringify(saleInfo) : '{}';
    const performedBy = JSON.stringify({ name, email, mspId });

    const batch = await invokeChaincode(mspId, 'RecordSale', [
      batchId,
      quantitySold.toString(),
      saleInfoStr,
      performedBy,
    ]);

    return res.status(200).json({ success: true, data: batch });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;