const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingRef: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  service: { type: String, required: true },
  pickupDate: { type: String, required: true },
  pickupTime: { type: String, default: 'Morning (9 AM - 12 PM)' },
  estimatedTotal: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'picked_up', 'washing', 'ready', 'delivered', 'cancelled'],
    default: 'pending' 
  },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
