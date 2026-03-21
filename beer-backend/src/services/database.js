'use strict';

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/bralirwa.db');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Create table with isAdmin field
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    mspId TEXT NOT NULL,
    role TEXT NOT NULL,
    isAdmin INTEGER DEFAULT 0,
    participantId TEXT DEFAULT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// Add participantId column if it doesn't exist
try {
  db.exec(`ALTER TABLE users ADD COLUMN participantId TEXT DEFAULT NULL`);
  console.log('✓ participantId column added');
} catch (e) {
  // Column already exists, ignore
}

// Add isAdmin column if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0`);
  console.log('✓ isAdmin column added');
} catch (e) {
  // Column already exists, ignore
}

// Seed default admin users if table is empty
const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (count.count === 0) {
  const hash = bcrypt.hashSync('password123', 10);
  const insert = db.prepare(`
    INSERT INTO users (email, password, name, mspId, role, isAdmin)
    VALUES (@email, @password, @name, @mspId, @role, @isAdmin)
  `);

  insert.run({ email: 'admin@supplier.com',     password: hash, name: 'Supplier Admin',     mspId: 'SupplierMSP',     role: 'supplier',     isAdmin: 1 });
  insert.run({ email: 'admin@manufacturer.com', password: hash, name: 'Manufacturer Admin', mspId: 'ManufacturerMSP', role: 'manufacturer', isAdmin: 1 });
  insert.run({ email: 'admin@distributor.com',  password: hash, name: 'Distributor Admin',  mspId: 'DistributorMSP',  role: 'distributor',  isAdmin: 1 });
  insert.run({ email: 'admin@retailer.com',     password: hash, name: 'Retailer Admin',     mspId: 'RetailerMSP',     role: 'retailer',     isAdmin: 1 });

  console.log('✓ Default admin users seeded');
} else {
  // Make sure existing default users are marked as admin
  db.prepare(`UPDATE users SET isAdmin = 1 WHERE email IN (
    'admin@supplier.com','admin@manufacturer.com','admin@distributor.com','admin@retailer.com'
  )`).run();
}

console.log(`✓ Database connected: ${DB_PATH}`);

module.exports = db;