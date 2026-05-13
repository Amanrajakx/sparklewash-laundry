// routes/orders.js – Customer's own orders
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireCustomer } = require('./customers');

// ================================================================
// GET /api/orders  — Get all orders for logged-in customer
// ================================================================
router.get('/', requireCustomer, (req, res) => {
    try {
        const orders = db.prepare(`
      SELECT id, booking_ref, full_name, service, pickup_date, pickup_time, estimated_total, status, notes, created_at, updated_at
      FROM bookings
      WHERE customer_id = ?
      ORDER BY created_at DESC
    `).all(req.session.customerId);

        return res.json({ success: true, orders });
    } catch (err) {
        console.error('Orders fetch error:', err);
        return res.status(500).json({ success: false, error: 'Could not load orders.' });
    }
});

// ================================================================
// GET /api/orders/:ref  — Track a specific order by booking ref
// Also allows guest tracking (no login needed — just ref number)
// ================================================================
router.get('/track/:ref', (req, res) => {
    try {
        const order = db.prepare(`
      SELECT booking_ref, full_name, service, pickup_date, pickup_time, estimated_total, status, notes, created_at, updated_at
      FROM bookings WHERE booking_ref = ?
    `).get(req.params.ref.toUpperCase());

        if (!order) return res.status(404).json({ success: false, error: 'Booking not found. Please check your reference number.' });
        return res.json({ success: true, order });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Could not track order.' });
    }
});

// ================================================================
// POST /api/orders/link  — Link a booking ref to logged-in customer
// (So old bookings made before account creation can be claimed)
// ================================================================
router.post('/link', requireCustomer, (req, res) => {
    const { bookingRef } = req.body;
    if (!bookingRef) return res.status(400).json({ success: false, error: 'Booking reference is required.' });

    const booking = db.prepare('SELECT * FROM bookings WHERE booking_ref = ?').get(bookingRef.trim().toUpperCase());
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });
    if (booking.customer_id && booking.customer_id !== req.session.customerId) {
        return res.status(403).json({ success: false, error: 'This booking belongs to another account.' });
    }

    db.prepare('UPDATE bookings SET customer_id = ? WHERE booking_ref = ?').run(req.session.customerId, bookingRef.trim().toUpperCase());
    return res.json({ success: true, message: 'Booking linked to your account!' });
});

module.exports = router;
