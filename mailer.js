// mailer.js – Email notifications for both Admin and Customer
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
  if (
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS ||
    process.env.EMAIL_USER === 'your_gmail@gmail.com'
  ) {
    console.log('⚠️ EMAIL not configured — skipping email send.');
    return null;
  }

  console.log(`📧 Email transporter created for: ${process.env.EMAIL_USER}`);

  return nodemailer.createTransport({
    service: 'gmail',

    logger: true,
    debug: true,

    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS.replace(/\s/g, '')
    }
  });
}

// ================================================================
// Helper to build table rows
// ================================================================
function row(label, value) {
  return `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #1e2535;color:#9ca8b8;font-size:13px;width:40%;">
        ${label}
      </td>

      <td style="padding:10px;border-bottom:1px solid #1e2535;font-size:13px;">
        ${value}
      </td>
    </tr>
  `;
}

// ================================================================
// EMAIL TO ADMIN
// ================================================================
async function sendAdminEmail(booking) {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.log('📧 Email not configured. Skipping.');
      return;
    }

    const ownerEmail =
      process.env.OWNER_EMAIL || process.env.EMAIL_USER;

    const serviceLabel =
      SERVICE_LABELS[booking.service] || booking.service;

    console.log('📨 Sending ADMIN email...');
    console.log('FROM:', process.env.EMAIL_USER);
    console.log('TO:', ownerEmail);

    const info = await transporter.sendMail({
      from: `"Laundry Aman System" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: `🧺 New Booking #${booking.bookingRef} – ${booking.fullName}`,

      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f1117;color:#e8eaf0;border-radius:12px;overflow:hidden;">

          <div style="background:linear-gradient(135deg,#007aff,#00c8b4);padding:28px;text-align:center;">
            <h1 style="margin:0;font-size:22px;color:#fff;">
              🧺 New Booking Received!
            </h1>

            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
              Laundry Aman – Admin Notification
            </p>
          </div>

          <div style="padding:28px;">

            <table style="width:100%;border-collapse:collapse;">
              ${row('Booking Ref', `<strong style="color:#4db3ff">${booking.bookingRef}</strong>`)}
              ${row('Customer', booking.fullName)}
              ${row('Phone', `<a href="tel:${booking.phone}" style="color:#4db3ff">${booking.phone}</a>`)}
              ${row('Address', booking.address)}
              ${row('Service', `<strong style="color:#00e5c8">${serviceLabel}</strong>`)}
              ${row('Pickup Date', booking.pickupDate)}
              ${row('Pickup Time', booking.pickupTime || 'Morning (9 AM - 12 PM)')}
              ${row(
        'Est. Total',
        booking.estimatedTotal
          ? `<strong style="color:#4db3ff">₹${booking.estimatedTotal}</strong>`
          : 'To be calculated'
      )}
              ${row('Notes', booking.notes || 'None')}
            </table>

          </div>

          <div style="padding:14px;text-align:center;background:#0a0d13;font-size:12px;color:#5a6578;">
            Laundry Aman • Naviwadi, Thakurdwar, Girgaon, Mumbai
          </div>

        </div>
      `
    });

    console.log('✅ Admin email successfully sent');
    console.log('MESSAGE ID:', info.messageId);

  } catch (err) {
    console.error('❌ ADMIN EMAIL ERROR:', err);
  }
}

// ================================================================
// EMAIL TO CUSTOMER
// ================================================================
async function sendCustomerEmail(
  booking,
  customerEmail
) {
  try {
    const transporter = createTransporter();

    if (!transporter || !customerEmail) {
      console.log('⚠️ Customer email skipped');
      return;
    }

    const serviceLabel =
      SERVICE_LABELS[booking.service] || booking.service;

    console.log('📨 Sending CUSTOMER email...');
    console.log('FROM:', process.env.EMAIL_USER);
    console.log('TO:', customerEmail);

    const info = await transporter.sendMail({
      from: `"Laundry Aman" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `✅ Booking Confirmed! #${booking.bookingRef} – Laundry Aman`,

      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f1117;color:#e8eaf0;border-radius:12px;overflow:hidden;">

          <div style="background:linear-gradient(135deg,#007aff,#00c8b4);padding:32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">🧺</div>

            <h1 style="margin:0;font-size:22px;color:#fff;">
              Booking Confirmed!
            </h1>

            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
              Thank you for choosing Laundry Aman
            </p>
          </div>

          <div style="padding:28px;">

            <p style="font-size:15px;margin-bottom:20px;">
              Hi <strong>${booking.fullName}</strong>,
              <br/>
              Your laundry booking has been confirmed!
            </p>

            <table style="width:100%;border-collapse:collapse;">
              ${row('Booking Ref', booking.bookingRef)}
              ${row('Service', serviceLabel)}
              ${row('Pickup Date', booking.pickupDate)}
              ${row('Pickup Time', booking.pickupTime || 'Morning (9 AM - 12 PM)')}
              ${row('Address', booking.address)}
            </table>

          </div>

          <div style="padding:14px;text-align:center;background:#0a0d13;font-size:12px;color:#5a6578;">
            Laundry Aman • Naviwadi, Thakurdwar, Girgaon, Mumbai
          </div>

        </div>
      `
    });

    console.log('✅ Customer email successfully sent');
    console.log('MESSAGE ID:', info.messageId);

  } catch (err) {
    console.error('❌ CUSTOMER EMAIL ERROR:', err);
  }
}

// ================================================================
// MAIN EMAIL FUNCTION
// ================================================================
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

// ================================================================
// EXPORTS
// ================================================================
module.exports = {
  sendBookingEmails,
  sendAdminEmail,
  sendCustomerEmail
};