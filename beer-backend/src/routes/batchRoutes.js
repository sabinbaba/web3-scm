'use strict';

const express = require('express');
const router = express.Router();
const { queryChaincode, invokeChaincode } = require('../services/fabricService');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/batches — list all batches
router.get('/', async (req, res) => {
  try {
    const { mspId } = req.user;
    const batches = await queryChaincode(mspId, 'ListBatches', []);
    return res.status(200).json({ success: true, data: batches });
  } catch (error) {
    console.error('ListBatches error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/batches/my — list batches owned by caller's org
router.get('/my', async (req, res) => {
  try {
    const { mspId } = req.user;
    const batches = await queryChaincode(mspId, 'ListBatchesByOwner', []);
    return res.status(200).json({ success: true, data: batches });
  } catch (error) {
    console.error('ListBatchesByOwner error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/batches/:batchId — get one batch
router.get('/:batchId', async (req, res) => {
  try {
    const { mspId } = req.user;
    const { batchId } = req.params;
    const batch = await queryChaincode(mspId, 'QueryBatch', [batchId]);
    return res.status(200).json({ success: true, data: batch });
  } catch (error) {
    console.error('QueryBatch error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/batches/:batchId/history — get batch history
router.get('/:batchId/history', async (req, res) => {
  try {
    const { mspId } = req.user;
    const { batchId } = req.params;
    const history = await queryChaincode(mspId, 'GetBatchHistory', [batchId]);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('GetBatchHistory error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/batches — create a new batch (Manufacturer only)
router.post('/', async (req, res) => {
  try {
    const { mspId, role } = req.user;

    if (role !== 'manufacturer') {
      return res.status(403).json({ success: false, error: 'Only Manufacturer can create batches' });
    }

    const { batchId, beerType, quantity, manufacturerId, productionDate, expirationDate, ingredients } = req.body;

    if (!batchId || !beerType || !quantity || !manufacturerId || !productionDate || !expirationDate) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const ingredientsStr = ingredients ? JSON.stringify(ingredients) : '{}';

    const batch = await invokeChaincode(mspId, 'CreateBeerBatch', [
      batchId,
      beerType,
      quantity.toString(),
      manufacturerId,
      productionDate,
      expirationDate,
      ingredientsStr,
    ]);

    return res.status(201).json({ success: true, data: batch });
  } catch (error) {
    console.error('CreateBeerBatch error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/batches/:batchId/transfer — transfer batch
router.post('/:batchId/transfer', async (req, res) => {
  try {
    const { mspId, role } = req.user;

    if (role !== 'manufacturer' && role !== 'distributor') {
      return res.status(403).json({ success: false, error: 'Only Manufacturer or Distributor can transfer batches' });
    }

    const { batchId } = req.params;
    const { toParticipantId } = req.body;

    if (!toParticipantId) {
      return res.status(400).json({ success: false, error: 'toParticipantId is required' });
    }

    const batch = await invokeChaincode(mspId, 'TransferBatch', [batchId, toParticipantId]);
    return res.status(200).json({ success: true, data: batch });
  } catch (error) {
    console.error('TransferBatch error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/batches/:batchId/sale — record a sale (Retailer only)
router.post('/:batchId/sale', async (req, res) => {
  try {
    const { mspId, role } = req.user;

    if (role !== 'retailer') {
      return res.status(403).json({ success: false, error: 'Only Retailer can record sales' });
    }

    const { batchId } = req.params;
    const { quantitySold, saleInfo } = req.body;

    if (!quantitySold) {
      return res.status(400).json({ success: false, error: 'quantitySold is required' });
    }

    const saleInfoStr = saleInfo ? JSON.stringify(saleInfo) : '{}';

    const batch = await invokeChaincode(mspId, 'RecordSale', [
      batchId,
      quantitySold.toString(),
      saleInfoStr,
    ]);

    return res.status(200).json({ success: true, data: batch });
  } catch (error) {
    console.error('RecordSale error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;