'use strict';

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/bralirwa.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    mspId TEXT NOT NULL,
    role TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default users if table is empty
const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (count.count === 0) {
  const hash = bcrypt.hashSync('password123', 10);
  const insert = db.prepare(`
    INSERT INTO users (email, password, name, mspId, role)
    VALUES (@email, @password, @name, @mspId, @role)
  `);

  insert.run({ email: 'admin@supplier.com',     password: hash, name: 'Supplier Admin',     mspId: 'SupplierMSP',     role: 'supplier' });
  insert.run({ email: 'admin@manufacturer.com', password: hash, name: 'Manufacturer Admin', mspId: 'ManufacturerMSP', role: 'manufacturer' });
  insert.run({ email: 'admin@distributor.com',  password: hash, name: 'Distributor Admin',  mspId: 'DistributorMSP',  role: 'distributor' });
  insert.run({ email: 'admin@retailer.com',     password: hash, name: 'Retailer Admin',     mspId: 'RetailerMSP',     role: 'retailer' });

  console.log('✓ Default users seeded');
}

console.log(`✓ Database connected: ${DB_PATH}`);

module.exports = db;