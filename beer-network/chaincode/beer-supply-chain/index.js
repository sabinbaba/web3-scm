'use strict';

const { Contract } = require('fabric-contract-api');

const BATCH_PREFIX       = 'BATCH';
const PARTICIPANT_PREFIX = 'PARTICIPANT';

const ROLES = {
  SUPPLIER:     'supplier',
  MANUFACTURER: 'manufacturer',
  DISTRIBUTOR:  'distributor',
  RETAILER:     'retailer',
};

const MSP_ROLE_MAP = {
  SupplierMSP:     ROLES.SUPPLIER,
  ManufacturerMSP: ROLES.MANUFACTURER,
  DistributorMSP:  ROLES.DISTRIBUTOR,
  RetailerMSP:     ROLES.RETAILER,
};

function getTxTimestamp(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  return new Date(ts.seconds.low * 1000).toISOString();
}

async function getAllResults(iterator) {
  const results = [];
  let res = await iterator.next();
  while (!res.done) {
    if (res.value && res.value.value) {
      const val = res.value.value;
      const str = Buffer.isBuffer(val) ? val.toString('utf8') : val.toString();
      try {
        results.push(JSON.parse(str));
      } catch (e) {
        console.error('Failed to parse:', str, e);
      }
    }
    res = await iterator.next();
  }
  await iterator.close();
  return results;
}

class BeerSupplyChain extends Contract {

  _getMSP(ctx) {
    return ctx.clientIdentity.getMSPID();
  }

  _getRole(ctx) {
    const msp  = this._getMSP(ctx);
    const role = MSP_ROLE_MAP[msp];
    if (!role) throw new Error(`Unknown MSP: ${msp}`);
    return role;
  }

  _batchKey(ctx, batchId) {
    return ctx.stub.createCompositeKey(BATCH_PREFIX, [batchId]);
  }

  _participantKey(ctx, participantId) {
    return ctx.stub.createCompositeKey(PARTICIPANT_PREFIX, [participantId]);
  }

  async _getState(ctx, key, label) {
    const bytes = await ctx.stub.getState(key);
    if (!bytes || bytes.length === 0) {
      throw new Error(`${label} not found for key: ${key}`);
    }
    return JSON.parse(bytes.toString());
  }

  async _putState(ctx, key, obj) {
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(obj)));
  }

  _require(value, name) {
    if (!value || String(value).trim() === '') {
      throw new Error(`Field '${name}' is required`);
    }
  }

  _parseUser(userJson) {
    if (!userJson || userJson === '{}' || userJson === '') return null;
    try {
      return JSON.parse(userJson);
    } catch (e) {
      return null;
    }
  }

  async InitLedger(ctx) {
    console.log('BeerSupplyChain initialized');
    return JSON.stringify({ success: true });
  }

  async RegisterParticipant(ctx, participantId, name, role, contactInfo) {
    this._require(participantId, 'participantId');
    this._require(name,          'name');
    this._require(role,          'role');
    this._require(contactInfo,   'contactInfo');

    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(role.toLowerCase())) {
      throw new Error(`Invalid role '${role}'. Must be one of: ${validRoles.join(', ')}`);
    }

    const mspId = this._getMSP(ctx);
    const key   = this._participantKey(ctx, participantId);

    const existing = await ctx.stub.getState(key);
    if (existing && existing.length > 0) {
      throw new Error(`Participant '${participantId}' already exists`);
    }

    const participant = {
      docType:      'participant',
      participantId,
      name,
      role:         role.toLowerCase(),
      mspId,
      contactInfo,
      registeredAt: getTxTimestamp(ctx),
    };

    await this._putState(ctx, key, participant);
    ctx.stub.setEvent('ParticipantRegistered', Buffer.from(JSON.stringify(participant)));
    return JSON.stringify(participant);
  }

  async GetParticipant(ctx, participantId) {
    this._require(participantId, 'participantId');
    const key    = this._participantKey(ctx, participantId);
    const result = await this._getState(ctx, key, 'Participant');
    return JSON.stringify(result);
  }

  async ListParticipants(ctx) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey(PARTICIPANT_PREFIX, []);
    const results  = await getAllResults(iterator);
    return JSON.stringify(results);
  }

  async CreateBeerBatch(ctx, batchId, beerType, quantity, manufacturerId, productionDate, expirationDate, ingredients, performedByJson) {
    const role = this._getRole(ctx);
    if (role !== ROLES.MANUFACTURER) {
      throw new Error(`Only Manufacturer can create batches. Your role: ${role}`);
    }

    this._require(batchId,        'batchId');
    this._require(beerType,       'beerType');
    this._require(quantity,       'quantity');
    this._require(manufacturerId, 'manufacturerId');
    this._require(productionDate, 'productionDate');
    this._require(expirationDate, 'expirationDate');

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) throw new Error(`Quantity must be positive, got: ${quantity}`);

    const key      = this._batchKey(ctx, batchId);
    const existing = await ctx.stub.getState(key);
    if (existing && existing.length > 0) throw new Error(`Batch '${batchId}' already exists`);

    const mfgKey = this._participantKey(ctx, manufacturerId);
    const mfg    = await ctx.stub.getState(mfgKey);
    if (!mfg || mfg.length === 0) {
      throw new Error(`Manufacturer '${manufacturerId}' not found. Register them first.`);
    }

    let parsedIngredients = {};
    if (ingredients) {
      try { parsedIngredients = JSON.parse(ingredients); } catch (e) {
        throw new Error(`Invalid JSON for ingredients: ${e.message}`);
      }
    }

    const performedBy = this._parseUser(performedByJson);
    const now = getTxTimestamp(ctx);

    const batch = {
      docType:         'beerBatch',
      batchId,
      beerType,
      quantity:        qty,
      manufacturerId,
      mspId:           this._getMSP(ctx),
      productionDate,
      expirationDate,
      ingredients:     parsedIngredients,
      currentLocation: 'MANUFACTURER',
      currentOwnerId:  manufacturerId,
      status:          'PRODUCED',
      salesHistory:    [],
      actionHistory:   [{
        action:      'CREATED',
        performedBy: performedBy,
        mspId:       this._getMSP(ctx),
        timestamp:   now,
        txId:        ctx.stub.getTxID(),
      }],
      createdAt:  now,
      updatedAt:  now,
    };

    await this._putState(ctx, key, batch);
    ctx.stub.setEvent('BatchCreated', Buffer.from(JSON.stringify({ batchId, beerType, quantity: qty, performedBy })));
    return JSON.stringify(batch);
  }

  async QueryBatch(ctx, batchId) {
    this._require(batchId, 'batchId');
    const key    = this._batchKey(ctx, batchId);
    const result = await this._getState(ctx, key, 'Beer batch');
    return JSON.stringify(result);
  }

  async ListBatches(ctx) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey(BATCH_PREFIX, []);
    const results  = await getAllResults(iterator);
    return JSON.stringify(results);
  }

  async ListBatchesByOwner(ctx) {
    const msp      = this._getMSP(ctx);
    const iterator = await ctx.stub.getStateByPartialCompositeKey(BATCH_PREFIX, []);
    const all      = await getAllResults(iterator);
    return JSON.stringify(all.filter(b => b.mspId === msp));
  }

  async TransferBatch(ctx, batchId, toParticipantId, performedByJson) {
    this._require(batchId,         'batchId');
    this._require(toParticipantId, 'toParticipantId');

    const role = this._getRole(ctx);
    const msp  = this._getMSP(ctx);

    if (role !== ROLES.MANUFACTURER && role !== ROLES.DISTRIBUTOR) {
      throw new Error(`Only Manufacturer or Distributor can transfer. Your role: ${role}`);
    }

    const key   = this._batchKey(ctx, batchId);
    const batch = await this._getState(ctx, key, 'Beer batch');

    const callerRole = MSP_ROLE_MAP[msp];
    if (batch.currentLocation !== callerRole.toUpperCase()) {
      throw new Error(`Batch '${batchId}' is not at your location. Current location: ${batch.currentLocation}`);
    }

    const toKey  = this._participantKey(ctx, toParticipantId);
    const toPart = await this._getState(ctx, toKey, 'Recipient participant');

    if (role === ROLES.MANUFACTURER && toPart.role !== ROLES.DISTRIBUTOR) {
      throw new Error(`Manufacturer can only transfer to Distributor`);
    }
    if (role === ROLES.DISTRIBUTOR && toPart.role !== ROLES.RETAILER) {
      throw new Error(`Distributor can only transfer to Retailer`);
    }

    const performedBy = this._parseUser(performedByJson);
    const now = getTxTimestamp(ctx);

    // Add to action history
    if (!batch.actionHistory) batch.actionHistory = [];
    batch.actionHistory.push({
      action:      'TRANSFERRED',
      from:        batch.currentOwnerId,
      fromMspId:   msp,
      to:          toParticipantId,
      toMspId:     toPart.mspId,
      performedBy: performedBy,
      timestamp:   now,
      txId:        ctx.stub.getTxID(),
    });

    batch.currentOwnerId  = toParticipantId;
    batch.mspId           = toPart.mspId;
    batch.currentLocation = toPart.role.toUpperCase();
    batch.status          = 'IN_TRANSIT';
    batch.updatedAt       = now;

    await this._putState(ctx, key, batch);
    ctx.stub.setEvent('BatchTransferred', Buffer.from(JSON.stringify({ batchId, toParticipantId, performedBy })));
    return JSON.stringify(batch);
  }

  async RecordSale(ctx, batchId, quantitySold, saleInfo, performedByJson) {
    this._require(batchId,      'batchId');
    this._require(quantitySold, 'quantitySold');

    const role = this._getRole(ctx);
    const msp  = this._getMSP(ctx);

    if (role !== ROLES.RETAILER) {
      throw new Error(`Only Retailer can record sales. Your role: ${role}`);
    }

    const qty = parseInt(quantitySold);
    if (isNaN(qty) || qty <= 0) throw new Error('Quantity sold must be positive');

    const key   = this._batchKey(ctx, batchId);
    const batch = await this._getState(ctx, key, 'Beer batch');

    if (batch.currentLocation !== 'RETAILER') throw new Error(`Batch '${batchId}' is not at your location. Current location: ${batch.currentLocation}`);
    if (batch.quantity < qty) throw new Error(`Insufficient stock: available ${batch.quantity}, requested ${qty}`);

    let parsedSaleInfo = {};
    if (saleInfo) {
      try { parsedSaleInfo = JSON.parse(saleInfo); } catch (e) {}
    }

    const performedBy = this._parseUser(performedByJson);
    const now = getTxTimestamp(ctx);

    batch.quantity  -= qty;
    batch.status     = batch.quantity === 0 ? 'SOLD_OUT' : 'PARTIALLY_SOLD';
    batch.updatedAt  = now;
    batch.salesHistory.push({
      quantitySold: qty,
      soldAt:       now,
      retailerId:   batch.currentOwnerId,
      performedBy:  performedBy,
      txId:         ctx.stub.getTxID(),
      ...parsedSaleInfo,
    });

    if (!batch.actionHistory) batch.actionHistory = [];
    batch.actionHistory.push({
      action:      'SALE_RECORDED',
      quantitySold: qty,
      performedBy:  performedBy,
      mspId:        msp,
      timestamp:    now,
      txId:         ctx.stub.getTxID(),
    });

    await this._putState(ctx, key, batch);
    ctx.stub.setEvent('BatchSaleRecorded', Buffer.from(JSON.stringify({ batchId, quantitySold: qty, performedBy })));
    return JSON.stringify(batch);
  }

  async GetBatchHistory(ctx, batchId) {
    this._require(batchId, 'batchId');
    const key      = this._batchKey(ctx, batchId);
    const iterator = await ctx.stub.getHistoryForKey(key);
    const history  = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value) {
        const record = {
          txId:      res.value.tx_id,
          timestamp: res.value.timestamp,
          isDelete:  res.value.is_delete,
          value:     null,
        };
        if (!res.value.is_delete && res.value.value) {
          try { record.value = JSON.parse(res.value.value.toString()); } catch (e) {}
        }
        history.push(record);
      }
      res = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(history);
  }

  async UpdateBatch(ctx, batchId, updates) {
    this._require(batchId, 'batchId');
    this._require(updates, 'updates');

    const msp   = this._getMSP(ctx);
    const key   = this._batchKey(ctx, batchId);
    const batch = await this._getState(ctx, key, 'Beer batch');

    if (batch.currentLocation !== MSP_ROLE_MAP[msp].toUpperCase()) throw new Error(`Batch '${batchId}' does not belong to your organization`);

    let parsedUpdates;
    try { parsedUpdates = JSON.parse(updates); } catch (e) {
      throw new Error(`Invalid JSON for updates: ${e.message}`);
    }

    const allowed = ['quantity', 'currentLocation', 'status', 'beerType'];
    for (const field of Object.keys(parsedUpdates)) {
      if (!allowed.includes(field)) throw new Error(`Field '${field}' is not updatable`);
    }

    Object.assign(batch, parsedUpdates);
    batch.updatedAt = getTxTimestamp(ctx);

    await this._putState(ctx, key, batch);
    return JSON.stringify(batch);
  }
}

module.exports.contracts = [BeerSupplyChain];