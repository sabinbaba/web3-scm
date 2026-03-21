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

const RWANDA_DISTRICTS = [
  'Bugesera','Burera','Gakenke','Gasabo','Gatsibo','Gicumbi','Gisagara',
  'Huye','Kamonyi','Karongi','Kayonza','Kicukiro','Kirehe','Muhanga',
  'Musanze','Ngabo','Ngoma','Ngororero','Nyabihu','Nyagatare','Nyamagabe',
  'Nyamasheke','Nyanza','Nyarugenge','Nyaruguru','Rubavu','Ruhango',
  'Rulindo','Rusizi','Rutsiro','Rwamagana'
];

const MSP_ROLE_MAP = {
  SupplierMSP:     ROLES.SUPPLIER,
  ManufacturerMSP: ROLES.MANUFACTURER,
  DistributorMSP:  ROLES.DISTRIBUTOR,
  RetailerMSP:     ROLES.RETAILER,
};

// Removed duplicate declaration of RWANDA_DISTRICTS

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
      try { results.push(JSON.parse(str)); } catch (e) {}
    }
    res = await iterator.next();
  }
  await iterator.close();
  return results;
}

class BeerSupplyChain extends Contract {

  _getMSP(ctx) { return ctx.clientIdentity.getMSPID(); }
  _getRole(ctx) {
    const msp = this._getMSP(ctx);
    const role = MSP_ROLE_MAP[msp];
    if (!role) throw new Error(`Unknown MSP: ${msp}`);
    return role;
  }
  _batchKey(ctx, batchId) { return ctx.stub.createCompositeKey(BATCH_PREFIX, [batchId]); }
  _participantKey(ctx, id) { return ctx.stub.createCompositeKey(PARTICIPANT_PREFIX, [id]); }
  _districtKey(ctx, district) { return ctx.stub.createCompositeKey('DISTRICT_DISTRIBUTOR', [district]); }

  async _getState(ctx, key, label) {
    const bytes = await ctx.stub.getState(key);
    if (!bytes || bytes.length === 0) throw new Error(`${label} not found`);
    return JSON.parse(bytes.toString());
  }
  async _putState(ctx, key, obj) {
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(obj)));
  }
  _require(value, name) {
    if (!value || String(value).trim() === '') throw new Error(`Field '${name}' is required`);
  }
  _parseUser(userJson) {
    if (!userJson || userJson === '{}' || userJson === '') return null;
    try { return JSON.parse(userJson); } catch (e) { return null; }
  }

  async InitLedger(ctx) {
    return JSON.stringify({ success: true });
  }

  async RegisterParticipant(ctx, participantId, name, role, contactInfo, district) {
    this._require(participantId, 'participantId');
    this._require(name,          'name');
    this._require(role,          'role');
    this._require(contactInfo,   'contactInfo');

    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(role.toLowerCase())) {
      throw new Error(`Invalid role '${role}'. Must be one of: ${validRoles.join(', ')}`);
    }

    // District is required for distributors and retailers
    if (role.toLowerCase() === ROLES.DISTRIBUTOR || role.toLowerCase() === ROLES.RETAILER) {
      this._require(district, 'district');
      if (!RWANDA_DISTRICTS.includes(district)) {
        throw new Error(`Invalid district '${district}'. Must be one of the 30 Rwanda districts.`);
      }
    }

    // Enforce one distributor per district
    if (role.toLowerCase() === ROLES.DISTRIBUTOR) {
      const districtKey = this._districtKey(ctx, district);
      const existing = await ctx.stub.getState(districtKey);
      if (existing && existing.length > 0) {
        const existingDist = JSON.parse(existing.toString());
        throw new Error(`District '${district}' already has a distributor: ${existingDist.participantId} (${existingDist.name}). Only one distributor allowed per district.`);
      }
    }

    const mspId = this._getMSP(ctx);

    // District validation for distributors
    let assignedDistrict = district || '';
    if (role.toLowerCase() === ROLES.DISTRIBUTOR) {
      if (!assignedDistrict || !RWANDA_DISTRICTS.includes(assignedDistrict)) {
        throw new Error(`Invalid or missing district. Must be one of Rwanda's 30 districts.`);
      }
      // Check no other distributor exists for this district
      const iterator = await ctx.stub.getStateByPartialCompositeKey(PARTICIPANT_PREFIX, []);
      const all = await getAllResults(iterator);
      const existing = all.find(p => p.role === ROLES.DISTRIBUTOR && p.district === assignedDistrict);
      if (existing) {
        throw new Error(`District '${assignedDistrict}' already has a distributor: ${existing.name} (${existing.participantId})`);
      }
    }

    const key   = this._participantKey(ctx, participantId);
    const existingParticipant = await ctx.stub.getState(key);
    if (existingParticipant && existingParticipant.length > 0) {
      throw new Error(`Participant '${participantId}' already exists`);
    }

    const participant = {
      docType:      'participant',
      participantId,
      name,
      role:         role.toLowerCase(),
      mspId,
      contactInfo,
      district:     district || null,
      registeredAt: getTxTimestamp(ctx),
    };

    await this._putState(ctx, key, participant);

    // Register distributor in district index
    if (role.toLowerCase() === ROLES.DISTRIBUTOR) {
      const districtKey = this._districtKey(ctx, district);
      await this._putState(ctx, districtKey, { participantId, name, district });
    }

    ctx.stub.setEvent('ParticipantRegistered', Buffer.from(JSON.stringify(participant)));
    return JSON.stringify(participant);
  }

  async GetParticipant(ctx, participantId) {
    this._require(participantId, 'participantId');
    const key = this._participantKey(ctx, participantId);
    return JSON.stringify(await this._getState(ctx, key, 'Participant'));
  }

  async ListParticipants(ctx) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey(PARTICIPANT_PREFIX, []);
    return JSON.stringify(await getAllResults(iterator));
  }

  async GetDistrictDistributor(ctx, district) {
    this._require(district, 'district');
    const districtKey = this._districtKey(ctx, district);
    const bytes = await ctx.stub.getState(districtKey);
    if (!bytes || bytes.length === 0) return JSON.stringify(null);
    return bytes.toString();
  }

  async CreateBeerBatch(ctx, batchId, beerType, quantity, manufacturerId, productionDate, expirationDate, ingredients, performedByJson) {
    const role = this._getRole(ctx);
    if (role !== ROLES.MANUFACTURER) throw new Error(`Only Manufacturer can create batches`);

    this._require(batchId, 'batchId');
    this._require(beerType, 'beerType');
    this._require(quantity, 'quantity');
    this._require(manufacturerId, 'manufacturerId');
    this._require(productionDate, 'productionDate');
    this._require(expirationDate, 'expirationDate');

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) throw new Error('Quantity must be positive');

    const key = this._batchKey(ctx, batchId);
    const existing = await ctx.stub.getState(key);
    if (existing && existing.length > 0) throw new Error(`Batch '${batchId}' already exists`);

    const mfgKey = this._participantKey(ctx, manufacturerId);
    const mfg = await ctx.stub.getState(mfgKey);
    if (!mfg || mfg.length === 0) throw new Error(`Manufacturer '${manufacturerId}' not found`);

    let parsedIngredients = {};
    if (ingredients) {
      try { parsedIngredients = JSON.parse(ingredients); } catch (e) {
        throw new Error(`Invalid JSON for ingredients`);
      }
    }

    const performedBy = this._parseUser(performedByJson);
    const now = getTxTimestamp(ctx);

    const batch = {
      docType:         'beerBatch',
      batchId, beerType,
      quantity:        qty,
      manufacturerId,
      mspId:           this._getMSP(ctx),
      productionDate, expirationDate,
      ingredients:     parsedIngredients,
      currentLocation: 'MANUFACTURER',
      currentOwnerId:  manufacturerId,
      status:          'PRODUCED',
      salesHistory:    [],
      actionHistory:   [{
        action: 'CREATED', performedBy,
        mspId:  this._getMSP(ctx),
        timestamp: now, txId: ctx.stub.getTxID(),
      }],
      createdAt: now, updatedAt: now,
    };

    await this._putState(ctx, key, batch);
    ctx.stub.setEvent('BatchCreated', Buffer.from(JSON.stringify({ batchId, beerType, quantity: qty, performedBy })));
    return JSON.stringify(batch);
  }

  async QueryBatch(ctx, batchId) {
    this._require(batchId, 'batchId');
    return JSON.stringify(await this._getState(ctx, this._batchKey(ctx, batchId), 'Beer batch'));
  }

  async ListBatches(ctx) {
    const iterator = await ctx.stub.getStateByPartialCompositeKey(BATCH_PREFIX, []);
    return JSON.stringify(await getAllResults(iterator));
  }

  async ListBatchesByOwner(ctx) {
    const msp = this._getMSP(ctx);
    const iterator = await ctx.stub.getStateByPartialCompositeKey(BATCH_PREFIX, []);
    const all = await getAllResults(iterator);
    return JSON.stringify(all.filter(b => b.mspId === msp));
  }

  async TransferBatch(ctx, batchId, toParticipantId, performedByJson) {
    this._require(batchId, 'batchId');
    this._require(toParticipantId, 'toParticipantId');

    const role = this._getRole(ctx);
    const msp  = this._getMSP(ctx);

    if (role !== ROLES.MANUFACTURER && role !== ROLES.DISTRIBUTOR) {
      throw new Error(`Only Manufacturer or Distributor can transfer`);
    }

    const key   = this._batchKey(ctx, batchId);
    const batch = await this._getState(ctx, key, 'Beer batch');

    if (batch.currentLocation !== role.toUpperCase()) {
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

    // District enforcement: distributor can only transfer to retailers in same district
    if (role === ROLES.DISTRIBUTOR) {
      const fromKey  = this._participantKey(ctx, batch.currentOwnerId);
      const fromPart = await this._getState(ctx, fromKey, 'Distributor participant');

      if (!fromPart.district || !toPart.district) {
        throw new Error(`Both distributor and retailer must have a district assigned`);
      }
      if (fromPart.district !== toPart.district) {
        throw new Error(`District mismatch: Distributor is in '${fromPart.district}' but Retailer is in '${toPart.district}'. A distributor can only transfer to retailers in the same district.`);
      }
    }

    const performedBy = this._parseUser(performedByJson);
    const now = getTxTimestamp(ctx);

    if (!batch.actionHistory) batch.actionHistory = [];
    batch.actionHistory.push({
      action:      'TRANSFERRED',
      from:        batch.currentOwnerId,
      fromMspId:   msp,
      to:          toParticipantId,
      toMspId:     toPart.mspId,
      fromDistrict: batch.currentLocation === 'DISTRIBUTOR' ? (await this._getState(ctx, this._participantKey(ctx, batch.currentOwnerId), 'from part')).district : null,
      toDistrict:   toPart.district || null,
      performedBy,
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
    this._require(batchId, 'batchId');
    this._require(quantitySold, 'quantitySold');

    const role = this._getRole(ctx);
    if (role !== ROLES.RETAILER) throw new Error(`Only Retailer can record sales`);

    const qty = parseInt(quantitySold);
    if (isNaN(qty) || qty <= 0) throw new Error('Quantity sold must be positive');

    const key   = this._batchKey(ctx, batchId);
    const batch = await this._getState(ctx, key, 'Beer batch');

    if (batch.currentLocation !== 'RETAILER') {
      throw new Error(`Batch '${batchId}' is not at your location`);
    }
    if (batch.quantity < qty) {
      throw new Error(`Insufficient stock: available ${batch.quantity}, requested ${qty}`);
    }

    let parsedSaleInfo = {};
    if (saleInfo) { try { parsedSaleInfo = JSON.parse(saleInfo); } catch (e) {} }

    const performedBy = this._parseUser(performedByJson);
    const now = getTxTimestamp(ctx);

    batch.quantity  -= qty;
    batch.status     = batch.quantity === 0 ? 'SOLD_OUT' : 'PARTIALLY_SOLD';
    batch.updatedAt  = now;
    batch.salesHistory.push({
      quantitySold: qty, soldAt: now,
      retailerId: batch.currentOwnerId,
      performedBy, txId: ctx.stub.getTxID(),
      ...parsedSaleInfo,
    });

    if (!batch.actionHistory) batch.actionHistory = [];
    batch.actionHistory.push({
      action: 'SALE_RECORDED', quantitySold: qty,
      performedBy, mspId: this._getMSP(ctx),
      timestamp: now, txId: ctx.stub.getTxID(),
    });

    await this._putState(ctx, key, batch);
    ctx.stub.setEvent('BatchSaleRecorded', Buffer.from(JSON.stringify({ batchId, quantitySold: qty, performedBy })));
    return JSON.stringify(batch);
  }

  async GetBatchHistory(ctx, batchId) {
    this._require(batchId, 'batchId');
    const key = this._batchKey(ctx, batchId);
    const iterator = await ctx.stub.getHistoryForKey(key);
    const history = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value) {
        const record = {
          txId: res.value.tx_id,
          timestamp: res.value.timestamp,
          isDelete: res.value.is_delete,
          value: null,
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

    const key   = this._batchKey(ctx, batchId);
    const batch = await this._getState(ctx, key, 'Beer batch');

    if (batch.currentLocation !== MSP_ROLE_MAP[this._getMSP(ctx)].toUpperCase()) {
      throw new Error(`Batch '${batchId}' does not belong to your organization`);
    }

    let parsedUpdates;
    try { parsedUpdates = JSON.parse(updates); } catch (e) {
      throw new Error(`Invalid JSON for updates`);
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