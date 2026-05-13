// routes/orders.js – Customer's own orders
'use strict';

const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { requireCustomer } = require('./customers');

// ================================================================
// GET /api/orders  — Get all orders for logged-in customer
// ================================================================
router.get('/', requireCustomer, async (req, res) => {
    try {
        const orders = await Booking.find({ customerId: req.session.customerId })
            .sort({ createdAt: -1 });

        return res.json({ 
            success: true, 
            orders: orders.map(o => ({ ...o.toObject(), id: o._id })) 
        });
    } catch (err) {
        console.error('Orders fetch error:', err);
        return res.status(500).json({ success: false, error: 'Could not load orders.' });
    }
});

// ================================================================
// GET /api/orders/track/:ref  — Track a specific order by booking ref
// Also allows guest tracking (no login needed — just ref number)
// ================================================================
router.get('/track/:ref', async (req, res) => {
    try {
        const order = await Booking.findOne({ bookingRef: req.params.ref.toUpperCase() });

        if (!order) return res.status(404).json({ success: false, error: 'Booking not found. Please check your reference number.' });
        return res.json({ success: true, order: { ...order.toObject(), id: order._id } });
    } catch (err) {
        console.error('Track order error:', err);
        return res.status(500).json({ success: false, error: 'Could not track order.' });
    }
});

// ================================================================
// POST /api/orders/link  — Link a booking ref to logged-in customer
// (So old bookings made before account creation can be claimed)
// ================================================================
router.post('/link', requireCustomer, async (req, res) => {
    const { bookingRef } = req.body;
    if (!bookingRef) return res.status(400).json({ success: false, error: 'Booking reference is required.' });

    try {
        const cleanRef = bookingRef.trim().toUpperCase();
        const booking = await Booking.findOne({ bookingRef: cleanRef });
        
        if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });
        
        if (booking.customerId && booking.customerId.toString() !== req.session.customerId.toString()) {
            return res.status(403).json({ success: false, error: 'This booking belongs to another account.' });
        }

        booking.customerId = req.session.customerId;
        await booking.save();
        
        return res.json({ success: true, message: 'Booking linked to your account!' });
    } catch (err) {
        console.error('Link order error:', err);
        return res.status(500).json({ success: false, error: 'Could not link booking.' });
    }
});

module.exports = router;
