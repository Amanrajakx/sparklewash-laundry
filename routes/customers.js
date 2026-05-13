// routes/customers.js – Customer Authentication & Profile
'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');

function requireCustomer(req, res, next) {
    if (req.session && req.session.customerId) return next();
    return res.status(401).json({ success: false, error: 'Please log in to continue.' });
}

// ================================================================
// POST /api/customers/register
// ================================================================
router.post('/register', (req, res) => {
    const { fullName, phone, email, password } = req.body;

    const errors = [];
    if (!fullName || fullName.trim().length < 2) errors.push('Full name is required.');
    if (!phone || !/^[\+]?[0-9\s\-]{10,15}$/.test(phone.trim())) errors.push('Valid phone number is required.');
    if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');
    if (errors.length) return res.status(400).json({ success: false, errors });

    const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone.trim());
    if (existing) return res.status(409).json({ success: false, error: 'An account with this phone number already exists. Please log in.' });

    try {
        const hash = bcrypt.hashSync(password, 10);
        const result = db.prepare(
            'INSERT INTO customers (full_name, phone, email, password_hash) VALUES (?, ?, ?, ?)'
        ).run(fullName.trim(), phone.trim(), (email || '').trim(), hash);

        const customer = db.prepare('SELECT id, full_name, phone, email, address FROM customers WHERE id = ?').get(result.lastInsertRowid);

        req.session.customerId = customer.id;
        req.session.customerName = customer.full_name;

        return res.status(201).json({ success: true, customer });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ success: false, error: 'Could not create account. Try again.' });
    }
});

// ================================================================
// POST /api/customers/login
// ================================================================
router.post('/login', (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ success: false, error: 'Phone and password are required.' });

    const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone.trim());
    if (!customer || !bcrypt.compareSync(password, customer.password_hash)) {
        return res.status(401).json({ success: false, error: 'Invalid phone number or password.' });
    }

    req.session.customerId = customer.id;
    req.session.customerName = customer.full_name;

    return res.json({
        success: true, customer: {
            id: customer.id, full_name: customer.full_name,
            phone: customer.phone, email: customer.email, address: customer.address
        }
    });
});

// ================================================================
// POST /api/customers/logout
// ================================================================
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// ================================================================
// GET /api/customers/me
// ================================================================
router.get('/me', (req, res) => {
    if (!req.session || !req.session.customerId) return res.json({ loggedIn: false });
    const customer = db.prepare('SELECT id, full_name, phone, email, address, created_at FROM customers WHERE id = ?').get(req.session.customerId);
    if (!customer) return res.json({ loggedIn: false });
    return res.json({ loggedIn: true, customer });
});

// ================================================================
// PATCH /api/customers/profile  — Update profile
// ================================================================
router.patch('/profile', requireCustomer, (req, res) => {
    const { fullName, email, address } = req.body;
    if (!fullName || fullName.trim().length < 2) return res.status(400).json({ success: false, error: 'Full name is required.' });

    try {
        db.prepare(`UPDATE customers SET full_name=?, email=?, address=?, updated_at=datetime('now','localtime') WHERE id=?`)
            .run(fullName.trim(), (email || '').trim(), (address || '').trim(), req.session.customerId);

        req.session.customerName = fullName.trim();
        const updated = db.prepare('SELECT id, full_name, phone, email, address FROM customers WHERE id = ?').get(req.session.customerId);
        return res.json({ success: true, customer: updated });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Could not update profile.' });
    }
});

// ================================================================
// PATCH /api/customers/password  — Change password
// ================================================================
router.patch('/password', requireCustomer, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, error: 'Both fields required.' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.session.customerId);
    if (!bcrypt.compareSync(currentPassword, customer.password_hash)) {
        return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE customers SET password_hash=?, updated_at=datetime('now','localtime') WHERE id=?").run(hash, req.session.customerId);
    return res.json({ success: true });
});

module.exports = router;
module.exports.requireCustomer = requireCustomer;
