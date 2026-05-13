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
    console.log('⚠️  EMAIL not configured — skipping email send.');
    return null;
  }

  console.log(`📧 Email transporter created for: ${process.env.EMAIL_USER}`);

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS.replace(/\s/g, '') // remove spaces from app password
    }
  });
}

// ================================================================
// EMAIL TO ADMIN — full booking details
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

    await transporter.sendMail({
      from: `"Laundry Aman System" <${process.env.EMAIL_USER}>`,
      to: ownerEmail,
      subject: `🧺 New Booking #${booking.bookingRef} – ${booking.fullName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f1117;color:#e8eaf0;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#007aff,#00c8b4);padding:28px;text-align:center;">
            <h1 style="margin:0;font-size:22px;color:#fff;">🧺 New Booking Received!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Laundry Aman – Admin Notification</p>
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

            <div style="margin-top:24px;text-align:center;">
              <a
                href="http://localhost:${process.env.PORT || 3000}/admin"
                style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#007aff,#00c8b4);color:#fff;text-decoration:none;border-radius:50px;font-weight:bold;font-size:14px;"
              >
                View in Admin Panel →
              </a>
            </div>
          </div>

          <div style="padding:14px;text-align:center;background:#0a0d13;font-size:12px;color:#5a6578;">
            Laundry Aman • Naviwadi, Thakurdwar, Girgaon, Mumbai • ${new Date().toLocaleString('en-IN')}
          </div>
        </div>
      `
    });

    console.log(
      `📧 Admin email sent to ${ownerEmail} for booking ${booking.bookingRef}`
    );

  } catch (err) {
    console.error('❌ ADMIN EMAIL ERROR:', err.message);
    throw err;
  }
}

// ================================================================
// EMAIL TO CUSTOMER — confirmation with booking details
// ================================================================
async function sendCustomerEmail(booking, customerEmail) {
  try {
    const transporter = createTransporter();

    if (!transporter || !customerEmail) return;

    const serviceLabel =
      SERVICE_LABELS[booking.service] || booking.service;

    await transporter.sendMail({
      from: `"Laundry Aman" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `✅ Booking Confirmed! #${booking.bookingRef} – Laundry Aman`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f1117;color:#e8eaf0;border-radius:12px;overflow:hidden;">

          <div style="background:linear-gradient(135deg,#007aff,#00c8b4);padding:32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">🧺</div>
            <h1 style="margin:0;font-size:22px;color:#fff;">Booking Confirmed!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
              Thank you for choosing Laundry Aman
            </p>
          </div>

          <div style="padding:28px;">

            <p style="font-size:15px;margin-bottom:20px;">
              Hi <strong>${booking.fullName}</strong>,<br/>
              Your laundry booking has been confirmed! Here are your booking details:
            </p>

            <div style="background:#1a1f2e;border-radius:12px;padding:20px;margin-bottom:20px;">
              <div style="text-align:center;margin-bottom:16px;">
                <span style="font-size:13px;color:#9ca8b8;">Booking Reference</span><br/>
                <span style="font-size:24px;font-weight:bold;color:#4db3ff;">
                  ${booking.bookingRef}
                </span>
              </div>

              <table style="width:100%;border-collapse:collapse;">
                ${row('Service', `<strong style="color:#00e5c8">${serviceLabel}</strong>`)}
                ${row('Pickup Date', booking.pickupDate)}
                ${row('Pickup Time', booking.pickupTime || 'Morning (9 AM - 12 PM)')}
                ${row('Address', booking.address)}
                ${booking.estimatedTotal
          ? row(
            'Estimated Total',
            `<strong style="color:#4db3ff">₹${booking.estimatedTotal}</strong>`
          )
          : ''
        }
                ${booking.notes ? row('Your Notes', booking.notes) : ''}
              </table>
            </div>

            <div style="background:#0d2137;border-radius:12px;padding:16px;margin-bottom:20px;">
              <h3 style="margin:0 0 12px;font-size:14px;color:#4db3ff;">
                📋 What happens next?
              </h3>

              <div style="font-size:13px;color:#9ca8b8;line-height:1.8;">
                1️⃣ We will confirm your pickup shortly<br/>
                2️⃣ Our team will arrive at your address on the pickup date<br/>
                3️⃣ We will clean your clothes with expert care<br/>
                4️⃣ Fresh clothes delivered back to your door!
              </div>
            </div>

            <div style="background:#0d2137;border-radius:12px;padding:16px;margin-bottom:20px;">
              <h3 style="margin:0 0 12px;font-size:14px;color:#4db3ff;">
                📞 Need help?
              </h3>

              <div style="font-size:13px;color:#9ca8b8;line-height:1.8;">
                📱 Call/WhatsApp:
                <a href="tel:+919082166108" style="color:#4db3ff;">
                  +91 90821 66108
                </a><br/>

                📍 Address: Naviwadi, Thakurdwar, Girgaon, Mumbai<br/>
                🕐 Hours: Mon–Sun 8am – 8pm
              </div>
            </div>

            <div style="text-align:center;">
              <a
                href="https://wa.me/919082166108?text=Hi+I+have+a+query+about+booking+${booking.bookingRef}"
                style="display:inline-block;padding:12px 28px;background:#25D366;color:#fff;text-decoration:none;border-radius:50px;font-weight:bold;font-size:14px;"
              >
                💬 Chat on WhatsApp
              </a>
            </div>

          </div>

          <div style="padding:14px;text-align:center;background:#0a0d13;font-size:12px;color:#5a6578;">
            Laundry Aman • Naviwadi, Thakurdwar, Girgaon, Mumbai<br/>
            You received this email because you placed a booking with us.
          </div>

        </div>
      `
    });

    console.log(
      `📧 Customer email sent to ${customerEmail} for booking ${booking.bookingRef}`
    );

  } catch (err) {
    console.error('❌ CUSTOMER EMAIL ERROR:', err.message);
    throw err;
  }
}

// Helper to build table rows
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
// Main export — sends both emails
// ================================================================
async function sendBookingEmails(booking, customerEmail) {
  await sendAdminEmail(booking);

  if (customerEmail) {
    await sendCustomerEmail(booking, customerEmail);
  }
}

module.exports = {
  sendBookingEmails,
  sendAdminEmail,
  sendCustomerEmail
};