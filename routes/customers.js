// routes/customers.js – Customer Authentication & Profile
'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Customer = require('../models/Customer');

function requireCustomer(req, res, next) {
    if (req.session && req.session.customerId) return next();
    return res.status(401).json({ success: false, error: 'Please log in to continue.' });
}

// ================================================================
// POST /api/customers/register
// ================================================================
router.post('/register', async (req, res) => {
    const { fullName, phone, email, password } = req.body;

    const errors = [];
    if (!fullName || fullName.trim().length < 2) errors.push('Full name is required.');
    if (!phone || !/^[\+]?[0-9\s\-]{10,15}$/.test(phone.trim())) errors.push('Valid phone number is required.');
    if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');
    if (errors.length) return res.status(400).json({ success: false, errors });

    try {
        const existing = await Customer.findOne({ phone: phone.trim() });
        if (existing) return res.status(409).json({ success: false, error: 'An account with this phone number already exists. Please log in.' });

        const hash = bcrypt.hashSync(password, 10);
        const customer = await Customer.create({
            fullName: fullName.trim(),
            phone: phone.trim(),
            email: (email || '').trim(),
            passwordHash: hash
        });

        req.session.customerId = customer._id;
        req.session.customerName = customer.fullName;

        return res.status(201).json({ 
            success: true, 
            customer: {
                id: customer._id,
                fullName: customer.fullName,
                phone: customer.phone,
                email: customer.email,
                address: customer.address
            } 
        });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ success: false, error: 'Could not create account. Try again.' });
    }
});

// ================================================================
// POST /api/customers/login
// ================================================================
router.post('/login', async (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ success: false, error: 'Phone and password are required.' });

    try {
        const customer = await Customer.findOne({ phone: phone.trim() });
        if (!customer || !bcrypt.compareSync(password, customer.passwordHash)) {
            return res.status(401).json({ success: false, error: 'Invalid phone number or password.' });
        }

        req.session.customerId = customer._id;
        req.session.customerName = customer.fullName;

        return res.json({
            success: true, customer: {
                id: customer._id, 
                fullName: customer.fullName,
                phone: customer.phone, 
                email: customer.email, 
                address: customer.address
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
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
router.get('/me', async (req, res) => {
    if (!req.session || !req.session.customerId) return res.json({ loggedIn: false });
    
    try {
        const customer = await Customer.findById(req.session.customerId).select('-passwordHash');
        if (!customer) return res.json({ loggedIn: false });
        
        return res.json({ 
            loggedIn: true, 
            customer: {
                id: customer._id,
                fullName: customer.fullName,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                createdAt: customer.createdAt
            } 
        });
    } catch (err) {
        return res.json({ loggedIn: false });
    }
});

// ================================================================
// PATCH /api/customers/profile  — Update profile
// ================================================================
router.patch('/profile', requireCustomer, async (req, res) => {
    const { fullName, email, address } = req.body;
    if (!fullName || fullName.trim().length < 2) return res.status(400).json({ success: false, error: 'Full name is required.' });

    try {
        const customer = await Customer.findByIdAndUpdate(
            req.session.customerId,
            { 
                fullName: fullName.trim(), 
                email: (email || '').trim(), 
                address: (address || '').trim() 
            },
            { new: true }
        ).select('-passwordHash');

        if (!customer) return res.status(404).json({ success: false, error: 'Customer not found.' });

        req.session.customerName = customer.fullName;
        return res.json({ 
            success: true, 
            customer: {
                id: customer._id,
                fullName: customer.fullName,
                phone: customer.phone,
                email: customer.email,
                address: customer.address
            } 
        });
    } catch (err) {
        console.error('Update profile error:', err);
        return res.status(500).json({ success: false, error: 'Could not update profile.' });
    }
});

// ================================================================
// PATCH /api/customers/password  — Change password
// ================================================================
router.patch('/password', requireCustomer, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, error: 'Both fields required.' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });

    try {
        const customer = await Customer.findById(req.session.customerId);
        if (!customer || !bcrypt.compareSync(currentPassword, customer.passwordHash)) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
        }

        customer.passwordHash = bcrypt.hashSync(newPassword, 10);
        await customer.save();
        
        return res.json({ success: true });
    } catch (err) {
        console.error('Change password error:', err);
        return res.status(500).json({ success: false, error: 'Could not change password.' });
    }
});

module.exports = router;
module.exports.requireCustomer = requireCustomer;
