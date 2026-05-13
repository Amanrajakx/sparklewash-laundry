'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sparklewash';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    seedAdmin();
  })
  .catch(err => {
    console.error('❌ MongoDB CONNECTION ERROR:', err.message);
    console.error('👉 Make sure you have allowed all IPs (0.0.0.0/0) in MongoDB Atlas Network Access!');
  });

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