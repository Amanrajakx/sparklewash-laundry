'use strict';

const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { sendBookingEmail } = require('../mailer');
const { notifyNewBooking, notifyStatusChange } = require('../notifier');

function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ success: false, error: 'Unauthorized.' });
}

function generateRef() {
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `SW-${ts}${rand}`;
}

// POST /api/bookings — create booking (public)
router.post('/', async (req, res) => {
  const { fullName, phone, address, service, pickupDate, pickupTime, notes, estimatedTotal, customerEmail } = req.body;

  const errors = [];
  if (!fullName || fullName.trim().length < 2) errors.push('Full name is required.');
  if (!phone || !/^[\+]?[0-9\s\-]{10,15}$/.test(phone.trim())) errors.push('Valid phone number is required.');
  if (!address || address.trim().length < 5) errors.push('Address is required.');
  if (!service || !['wash-fold', 'dry-clean', 'ironing', 'bedding', 'alterations', 'express'].includes(service))
    errors.push('Please select a valid service.');
  if (!pickupDate || isNaN(Date.parse(pickupDate))) errors.push('Valid pickup date is required.');

  if (errors.length) return res.status(400).json({ success: false, errors });

  const booking_ref = generateRef();

  try {
    const bookingData = {
      bookingRef: booking_ref,
      fullName: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      service,
      pickupDate,
      pickupTime: pickupTime || 'Morning (9 AM - 12 PM)',
      estimatedTotal: parseInt(estimatedTotal) || 0,
      notes: (notes || '').trim(),
      customerId: req.session.customerId || null
    };

    const newBooking = await Booking.create(bookingData);

    sendBookingEmail(newBooking, customerEmail || '').catch(e => console.error('Email error:', e));
    notifyNewBooking(newBooking).catch(e => console.error('Notify error:', e));

    return res.status(201).json({
      success: true,
      booking: {
        id: newBooking._id,
        bookingRef: newBooking.bookingRef,
        fullName: newBooking.fullName,
        service: newBooking.service,
        pickupDate: newBooking.pickupDate,
        pickupTime: newBooking.pickupTime,
        status: newBooking.status,
        createdAt: newBooking.createdAt
      }
    });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ success: false, error: 'Could not create booking.' });
  }
});

// GET /api/bookings — list (admin)
router.get('/', requireAuth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 15);
  const skip = (page - 1) * limit;
  const status = req.query.status;
  const search = req.query.search;

  let query = {};
  if (status && status !== 'all') { query.status = status; }
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { bookingRef: { $regex: search, $options: 'i' } }
    ];
  }

  try {
    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    return res.json({ 
      success: true, 
      bookings: bookings.map(b => ({ ...b.toObject(), id: b._id })), 
      total, 
      page, 
      limit 
    });
  } catch (err) {
    console.error('List bookings error:', err);
    return res.status(500).json({ success: false, error: 'Could not load bookings.' });
  }
});

// GET /api/bookings/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const total = await Booking.countDocuments();
    const todayCount = await Booking.countDocuments({ createdAt: { $gte: startOfToday } });
    const pending = await Booking.countDocuments({ status: 'pending' });
    const active = await Booking.countDocuments({ status: { $in: ['confirmed', 'picked_up', 'washing', 'ready'] } });
    const delivered = await Booking.countDocuments({ status: 'delivered' });

    return res.json({ success: true, stats: { total, today: todayCount, pending, active, delivered } });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ success: false, error: 'Could not load stats.' });
  }
});

// GET /api/bookings/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });
    return res.json({ success: true, booking: { ...booking.toObject(), id: booking._id } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Error fetching booking.' });
  }
});

// PATCH /api/bookings/:id/status
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'picked_up', 'washing', 'ready', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status.' });

  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true }
    );
    
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });

    notifyStatusChange(booking).catch(() => { });
    return res.json({ success: true, status: booking.status });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ success: false, error: 'Could not update status.' });
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not delete.' });
  }
});

module.exports = router;