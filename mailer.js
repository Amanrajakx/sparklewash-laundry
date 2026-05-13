// mailer.js
'use strict';

const nodemailer = require('nodemailer');

const SERVICE_LABELS = {
  'wash-fold': 'Wash & Fold',
  'dry-clean': 'Dry Cleaning',
  'ironing': 'Steam Ironing',
  'bedding': 'Bedding & Linen',
  'alterations': 'Alterations',
  'express': 'Express Service'
};

function createTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('⚠️ SMTP not configured');
    return null;
  }

  console.log('📧 Creating Brevo SMTP transporter');

  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,

    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function row(label, value) {
  return `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #ddd;">
        ${label}
      </td>

      <td style="padding:10px;border-bottom:1px solid #ddd;">
        ${value}
      </td>
    </tr>
  `;
}

async function sendAdminEmail(booking) {
  try {
    const transporter = createTransporter();

    if (!transporter) return;

    const ownerEmail =
      process.env.OWNER_EMAIL;

    const serviceLabel =
      SERVICE_LABELS[booking.service] || booking.service;

    const info = await transporter.sendMail({
      from: `"Laundry Aman" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: `🧺 New Booking ${booking.bookingRef}`,

      html: `
        <h2>New Booking Received</h2>

        <table style="border-collapse:collapse;width:100%;">
          ${row('Booking Ref', booking.bookingRef)}
          ${row('Customer', booking.fullName)}
          ${row('Phone', booking.phone)}
          ${row('Address', booking.address)}
          ${row('Service', serviceLabel)}
          ${row('Pickup Date', booking.pickupDate)}
          ${row('Pickup Time', booking.pickupTime)}
        </table>
      `
    });

    console.log('✅ Admin email sent');
    console.log(info.messageId);

  } catch (err) {
    console.error('❌ Admin email error:', err);
  }
}

async function sendCustomerEmail(
  booking,
  customerEmail
) {
  try {
    if (!customerEmail) return;

    const transporter = createTransporter();

    if (!transporter) return;

    const info = await transporter.sendMail({
      from: `"Laundry Aman" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `✅ Booking Confirmed - ${booking.bookingRef}`,

      html: `
        <h2>Booking Confirmed</h2>

        <p>
          Hi ${booking.fullName},
        </p>

        <p>
          Your booking has been confirmed.
        </p>

        <p>
          Booking Ref:
          <strong>${booking.bookingRef}</strong>
        </p>
      `
    });

    console.log('✅ Customer email sent');
    console.log(info.messageId);

  } catch (err) {
    console.error('❌ Customer email error:', err);
  }
}

async function sendBookingEmails(
  booking,
  customerEmail
) {
  await sendAdminEmail(booking);

  if (customerEmail) {
    await sendCustomerEmail(
      booking,
      customerEmail
    );
  }
}

module.exports = {
  sendBookingEmails,
  sendAdminEmail,
  sendCustomerEmail
};