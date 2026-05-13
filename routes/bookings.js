'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { sendBookingEmail } = require('../mailer');
const { notifyNewBooking } = require('../notifier');

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
    const stmt = db.prepare(`
      INSERT INTO bookings (booking_ref, full_name, phone, address, service, pickup_date, pickup_time, estimated_total, notes, customer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      booking_ref,
      fullName.trim(),
      phone.trim(),
      address.trim(),
      service,
      pickupDate,
      pickupTime || 'Morning (9 AM - 12 PM)',
      parseInt(estimatedTotal) || 0,
      (notes || '').trim(),
      req.session.customerId || null
    );

    const newBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);

    sendBookingEmail(newBooking, customerEmail || '').catch(e => console.error('Email error:', e));
    notifyNewBooking(newBooking).catch(e => console.error('Notify error:', e));

    return res.status(201).json({
      success: true,
      booking: {
        id: newBooking.id,
        bookingRef: newBooking.booking_ref,
        fullName: newBooking.full_name,
        service: newBooking.service,
        pickupDate: newBooking.pickup_date,
        pickupTime: newBooking.pickup_time,
        status: newBooking.status,
        createdAt: newBooking.created_at
      }
    });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ success: false, error: 'Could not create booking.' });
  }
});

// GET /api/bookings — list (admin)
router.get('/', requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 15);
  const offset = (page - 1) * limit;
  const status = req.query.status;
  const search = req.query.search ? `%${req.query.search}%` : null;

  let where = [], params = [];
  if (status && status !== 'all') { where.push('status = ?'); params.push(status); }
  if (search) { where.push('(full_name LIKE ? OR phone LIKE ? OR booking_ref LIKE ?)'); params.push(search, search, search); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM bookings ${whereClause}`).get(...params).cnt;
    const bookings = db.prepare(`SELECT * FROM bookings ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return res.json({ success: true, bookings, total, page, limit });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not load bookings.' });
  }
});

// GET /api/bookings/stats
router.get('/stats', requireAuth, (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const total = db.prepare('SELECT COUNT(*) as n FROM bookings').get().n;
    const todayCount = db.prepare("SELECT COUNT(*) as n FROM bookings WHERE DATE(created_at) = ?").get(today).n;
    const pending = db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status = 'pending'").get().n;
    const active = db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status IN ('confirmed','picked_up','washing','ready')").get().n;
    const delivered = db.prepare("SELECT COUNT(*) as n FROM bookings WHERE status = 'delivered'").get().n;
    return res.json({ success: true, stats: { total, today: todayCount, pending, active, delivered } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not load stats.' });
  }
});

// GET /api/bookings/:id
router.get('/:id', requireAuth, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });
  return res.json({ success: true, booking });
});

// PATCH /api/bookings/:id/status
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'picked_up', 'washing', 'ready', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status.' });

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });

  try {
    db.prepare("UPDATE bookings SET status=?, updated_at=datetime('now','localtime') WHERE id=?").run(status, req.params.id);
    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    const { notifyStatusChange } = require('../notifier');
    notifyStatusChange(updated).catch(() => { });
    return res.json({ success: true, status });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not update status.' });
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', requireAuth, (req, res) => {
  const booking = db.prepare('SELECT id, booking_ref FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ success: false, error: 'Booking not found.' });
  try {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not delete.' });
  }
});

module.exports = router;