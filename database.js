'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'sparklewash.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = OFF;');

// Create tables one by one to avoid any issues
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT    NOT NULL,
    phone         TEXT    NOT NULL UNIQUE,
    email         TEXT    DEFAULT '',
    address       TEXT    DEFAULT '',
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_ref TEXT    NOT NULL UNIQUE,
    full_name   TEXT    NOT NULL,
    phone       TEXT    NOT NULL,
    address     TEXT    NOT NULL,
    service     TEXT    NOT NULL,
    pickup_date TEXT    NOT NULL,
    pickup_time TEXT    NOT NULL DEFAULT 'Morning (9 AM - 12 PM)',
    estimated_total INTEGER DEFAULT 0,
    notes       TEXT    DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'pending',
    customer_id INTEGER DEFAULT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

// Add customer_id and pickup_time to bookings if missing
try { db.exec('ALTER TABLE bookings ADD COLUMN customer_id INTEGER DEFAULT NULL;'); } catch (e) { }
try { db.exec("ALTER TABLE bookings ADD COLUMN pickup_time TEXT DEFAULT 'Morning (9 AM - 12 PM)';"); } catch (e) { }
try { db.exec('ALTER TABLE bookings ADD COLUMN estimated_total INTEGER DEFAULT 0;'); } catch (e) { }

// Seed admin
function seedAdmin() {
  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
  if (!existing) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', hash);
    console.log('✅ Default admin created. Username: admin | Password:', adminPassword);
  }
}

seedAdmin();
module.exports = db;