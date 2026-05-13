// server.js – SparkleWash Express Server
'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

// Initialize database (runs migrations)
require('./database');

const bookingsRouter = require('./routes/bookings');
const authRouter = require('./routes/auth');
const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');

const app = express();
app.set('trust proxy', 1); // Required for sessions to work on Render
const PORT = process.env.PORT || 3000;

// ---- Middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: [`http://localhost:${PORT}`, 'http://127.0.0.1:' + PORT],
  credentials: true
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'sparklewash-dev-secret',
  resave: false,
  saveUninitialized: false,
  proxy: true, // Tell session to trust the proxy
  cookie: {
    secure: true, // Render uses HTTPS, so this should be true
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));

// ---- Block sensitive files before static middleware ----
app.use((req, res, next) => {
  const blocked = /\.(env|db|db-shm|db-wal|json|js)$/i;
  const sensitiveFiles = ['.env', 'database.js', 'server.js', 'mailer.js', 'package.json', 'package-lock.json'];
  const reqPath = req.path.toLowerCase();

  if (sensitiveFiles.some(f => reqPath === '/' + f) ||
    reqPath.includes('/.env') ||
    reqPath.endsWith('.db') || reqPath.endsWith('.db-shm') || reqPath.endsWith('.db-wal')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// ---- Serve Static Files ----
app.use(express.static(path.join(__dirname), {
  index: 'index.html'
}));

// ---- API Routes ----
app.use('/api/bookings', bookingsRouter);
app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);

// ---- Admin page ----
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ---- Customer pages ----
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// ---- Health check ----
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'running', timestamp: new Date().toISOString() });
});

// ---- 404 fallback ----
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found.' });
  }
  res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

// ---- Start Server ----
app.listen(PORT, () => {
  console.log('');
  console.log('🫧  SparkleWash Server is running!');
  console.log('━'.repeat(40));
  console.log(`🌐  Website:       http://localhost:${PORT}`);
  console.log(`🔐  Admin Panel:   http://localhost:${PORT}/admin`);
  console.log(`⚡  API Base:      http://localhost:${PORT}/api`);
  console.log('━'.repeat(40));
  console.log(`🔑  Admin Login:   admin / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
  console.log('━'.repeat(40));
  console.log('');
});

module.exports = app;