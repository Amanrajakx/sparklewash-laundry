// notifier.js – Unified Notification System (WhatsApp & SMS)
'use strict';

/**
 * Sends a WhatsApp notification (Simulated/Placeholder)
 * @param {string} phone - Customer phone number
 * @param {string} message - The message content
 */
async function sendWhatsApp(phone, message) {
  console.log(`\n📱 [WHATSAPP SIMULATION] To: ${phone}`);
  console.log(`💬 Message: ${message}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  // To integrate for real, you would use an API like Twilio or Interakt here:
  /*
  const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
  await client.messages.create({
     from: 'whatsapp:+14155238886',
     body: message,
     to: `whatsapp:${phone}`
  });
  */
}

/**
 * Sends an SMS notification (Simulated/Placeholder)
 * @param {string} phone - Customer phone number
 * @param {string} message - The message content
 */
async function sendSMS(phone, message) {
  console.log(`\n📟 [SMS SIMULATION] To: ${phone}`);
  console.log(`💬 Message: ${message}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Real integration example (Twilio):
  /*
  const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
  await client.messages.create({
     body: message,
     to: phone,
     from: '+1234567890'
  });
  */
}

/**
 * Notifies customer of order status changes
 */
async function notifyStatusChange(booking) {
  const statusLabels = {
    'confirmed': 'confirmed ✅',
    'picked_up': 'picked up 🚗',
    'washing': 'being washed 🫧',
    'ready': 'ready for delivery 📦',
    'delivered': 'delivered! 🎁 Enjoy your fresh clothes.',
    'cancelled': 'cancelled ❌'
  };

  const statusText = statusLabels[booking.status];
  if (!statusText) return;

  const msg = `Hi ${booking.full_name}, your SparkleWash order ${booking.booking_ref} is now ${statusText}`;
  
  // Send both for maximum reach (in simulation)
  await sendWhatsApp(booking.phone, msg);
  // await sendSMS(booking.phone, msg); // SMS can be expensive, usually one is enough
}

/**
 * Notifies customer of new booking
 */
async function notifyNewBooking(booking) {
  const msg = `Hi ${booking.full_name}, thank you for booking with SparkleWash! Your Booking Ref is ${booking.booking_ref}. We will pick up your laundry on ${booking.pickup_date} (${booking.pickup_time}).`;
  await sendWhatsApp(booking.phone, msg);
}

module.exports = { notifyStatusChange, notifyNewBooking };
