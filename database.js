'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

let MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  if (!MONGODB_URI) {
    console.log('ℹ️  MONGODB_URI not set. Starting in-memory MongoDB server for local testing...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      MONGODB_URI = mongoServer.getUri();
      console.log('✅ In-memory MongoDB Server started at:', MONGODB_URI);
    } catch (err) {
      console.error('❌ Failed to start in-memory MongoDB Server:', err.message);
      console.log('👉 Falling back to local default MongoDB connection...');
      MONGODB_URI = 'mongodb://127.0.0.1:27017/sparklewash';
    }
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB successfully');
    await seedAdmin();
  } catch (err) {
    console.error('❌ MongoDB CONNECTION ERROR:', err.message);
    console.error('👉 Make sure you have allowed all IPs (0.0.0.0/0) in MongoDB Atlas Network Access!');
  }
}

connectDB();

async function seedAdmin() {
  try {
    const existing = await Admin.findOne({ username: 'admin' });
    if (!existing) {
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const hash = bcrypt.hashSync(adminPassword, 10);
      await Admin.create({
        username: 'admin',
        passwordHash: hash
      });
      console.log('✅ Default admin created. Username: admin | Password:', adminPassword);
    }
  } catch (err) {
    console.error('❌ Error seeding admin:', err);
  }
}

module.exports = mongoose.connection;