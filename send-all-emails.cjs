// Comprehensive test script with ENHANCED email templates
// Run with: node send-all-emails.cjs <email>
// This demonstrates psychology-backed copy with varied messaging

require('dotenv').config({ path: '.env.local' });

const email = process.argv[2];
if (!email) {
  console.error('Usage: node send-all-emails.cjs <email>');
  process.exit(1);
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Nab a Table <noreply@nabatable.com>';

if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY not found in .env.local');
  process.exit(1);
}

const { Resend } = require('resend');
const resend = new Resend(RESEND_API_KEY);

// Mock booking data
const mockBooking = {
  id: 'test-booking-123',
  reference: 'TCH-1226',
  customer_name: 'Aman Shrestha',
  customer_email: email,
  customer_phone: '+44 7123 456789',
  party_size: 4,
  booking_date: '2025-12-27',
  start_time: '19:00',
  end_time: '21:00',
  booking_type: 'dinner',
  seating_preference: 'indoor',
  notes: 'Anniversary celebration - would love a quiet table if possible',
};

const venue = {
  name: 'The Corner House',
  address: '123 High Street, London, SW1A 1AA',
  phone: '+44 20 1234 5678',
  timezone: 'Europe/London',
};

const guestFirstName = 'Aman';

// Enhanced email templates with psychology-backed copy
const emailTypes = [
  {
    name: '1️⃣ Booking Request Received (Pending)',
    subject: '🎉 You\'re Almost There! - The Corner House',
    headline: '🎉 You\'re Almost There!',
    intro: `Great news, ${guestFirstName}! We've received your reservation request for ${venue.name}. Our team is confirming the perfect table for you right now.`,
    status: 'Awaiting confirmation',
    statusColor: '#854d0e',
    statusBg: '#fef9c3',
    statusNote: 'We will follow up as soon as the restaurant confirms your table.',
    ctaLabel: 'View Your Request',
  },
  {
    name: '2️⃣ Booking Confirmed',
    subject: '✨ Your Table is Confirmed! - The Corner House',
    headline: '✨ Your Table is Confirmed!',
    intro: `${guestFirstName}, you're all set! Your table at ${venue.name} is locked in and waiting for you. We can't wait to welcome you!`,
    status: 'Confirmed',
    statusColor: '#166534',
    statusBg: '#dcfce7',
    statusNote: 'Show this ticket on arrival and we will take care of the rest.',
    ctaLabel: 'View Your Reservation',
  },
  {
    name: '3️⃣ Booking Reminder (24h)',
    subject: '📅 Tomorrow\'s the Day! - The Corner House',
    headline: '📅 Tomorrow\'s the Day!',
    intro: `${guestFirstName}, just a friendly reminder—your reservation at ${venue.name} is tomorrow! Here are your booking details to help you prepare.`,
    status: 'Confirmed',
    statusColor: '#166534',
    statusBg: '#dcfce7',
    statusNote: 'We\'re excited to host you. Here\'s everything you need to know.',
    ctaLabel: 'View Booking Details',
  },
  {
    name: '4️⃣ Booking Reminder (2h - Same Day)',
    subject: '🍽️ Your Table Awaits! - The Corner House',
    headline: '🍽️ Your Table Awaits!',
    intro: `${guestFirstName}, your reservation at ${venue.name} is coming up soon! We're getting everything ready for your arrival. See you shortly!`,
    status: 'Confirmed',
    statusColor: '#166534',
    statusBg: '#dcfce7',
    statusNote: 'The team is preparing to welcome you. Can\'t wait to see you!',
    ctaLabel: 'Get Directions →',
  },
  {
    name: '5️⃣ Review Request (Post-Visit)',
    subject: '🌟 How Was Your Experience? - The Corner House',
    headline: '🌟 How Was Your Experience?',
    intro: `${guestFirstName}, we hope you had an amazing time at ${venue.name}! Your feedback helps us serve you even better—and helps others discover great dining experiences.`,
    status: 'Completed',
    statusColor: '#1d4ed8',
    statusBg: '#dbeafe',
    statusNote: 'Your opinion matters! A quick review helps fellow food lovers find their next favorite spot.',
    ctaLabel: 'Share Your Experience',
  },
];

// Enhanced HTML template with better design
function generateEmailHtml(emailType) {
  const now = new Date();
  const bookingDate = new Date('2025-12-27T19:00:00Z');
  const formattedDate = bookingDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailType.headline}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:20px;box-shadow:0 10px 40px -10px rgba(0,0,0,0.1);overflow:hidden;">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:40px 32px;text-align:center;">
              <div style="display:inline-block;width:64px;height:64px;background:rgba(255,255,255,0.15);border-radius:16px;line-height:64px;font-size:28px;margin-bottom:16px;">
                🏠
              </div>
              <h2 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.02em;">${venue.name}</h2>
            </td>
          </tr>
          
          <!-- Status Badge -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <span style="display:inline-block;padding:8px 20px;border-radius:24px;background:${emailType.statusBg};color:${emailType.statusColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">
                ${emailType.status}
              </span>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding:28px 32px;text-align:center;">
              <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#0f172a;line-height:1.2;letter-spacing:-0.03em;">
                ${emailType.headline}
              </h1>
              <p style="margin:0 0 16px;font-size:16px;color:#475569;line-height:1.7;">
                ${emailType.intro}
              </p>
              <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;font-style:italic;">
                ${emailType.statusNote}
              </p>
            </td>
          </tr>
          
          <!-- CTA Button with Gradient -->
          <tr>
            <td style="padding:8px 32px 32px;text-align:center;">
              <a href="https://nabatable.com/bookings/${mockBooking.id}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#ffffff;text-decoration:none;border-radius:14px;font-weight:700;font-size:14px;letter-spacing:0.02em;box-shadow:0 4px 14px 0 rgba(15,23,42,0.25);transition:all 0.2s;">
                ${emailType.ctaLabel}
              </a>
            </td>
          </tr>
          
          <!-- Quick Actions -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="#" style="display:inline-block;margin:0 6px;padding:10px 18px;background:#f1f5f9;color:#475569;text-decoration:none;border-radius:10px;font-size:13px;font-weight:500;">📅 Calendar</a>
                    <a href="#" style="display:inline-block;margin:0 6px;padding:10px 18px;background:#f1f5f9;color:#475569;text-decoration:none;border-radius:10px;font-size:13px;font-weight:500;">📍 Directions</a>
                    <a href="#" style="display:inline-block;margin:0 6px;padding:10px 18px;background:#f1f5f9;color:#475569;text-decoration:none;border-radius:10px;font-size:13px;font-weight:500;">⚙️ Manage</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);"></div>
            </td>
          </tr>
          
          <!-- Reservation Details Card -->
          <tr>
            <td style="padding:28px 32px;">
              <div style="background:#f8fafc;border-radius:16px;padding:24px;">
                <h3 style="margin:0 0 20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;">
                  Reservation Details
                </h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="50%" style="padding:10px 0;vertical-align:top;">
                      <span style="display:block;font-size:11px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Date</span>
                      <span style="display:block;font-size:15px;color:#0f172a;font-weight:600;">${formattedDate}</span>
                    </td>
                    <td width="50%" style="padding:10px 0;vertical-align:top;">
                      <span style="display:block;font-size:11px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Time</span>
                      <span style="display:block;font-size:15px;color:#0f172a;font-weight:600;">7:00 PM – 9:00 PM</span>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" style="padding:10px 0;vertical-align:top;">
                      <span style="display:block;font-size:11px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Guests</span>
                      <span style="display:block;font-size:15px;color:#0f172a;font-weight:600;">${mockBooking.party_size} guests</span>
                    </td>
                    <td width="50%" style="padding:10px 0;vertical-align:top;">
                      <span style="display:block;font-size:11px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Reference</span>
                      <span style="display:block;font-size:15px;color:#0f172a;font-weight:600;font-family:monospace;">${mockBooking.reference}</span>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" style="padding:10px 0;vertical-align:top;">
                      <span style="display:block;font-size:11px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Seating</span>
                      <span style="display:block;font-size:15px;color:#0f172a;font-weight:600;">Indoor</span>
                    </td>
                    <td width="50%" style="padding:10px 0;vertical-align:top;">
                      <span style="display:block;font-size:11px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Type</span>
                      <span style="display:block;font-size:15px;color:#0f172a;font-weight:600;">Dinner</span>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          
          <!-- Guest Notes -->
          <tr>
            <td style="padding:0 32px 28px;">
              <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border-radius:12px;padding:16px 20px;">
                <div style="display:flex;align-items:flex-start;">
                  <span style="font-size:18px;margin-right:10px;">📝</span>
                  <div>
                    <span style="display:block;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;margin-bottom:4px;">Guest Notes</span>
                    <span style="font-size:14px;color:#78350f;line-height:1.5;">${mockBooking.notes}</span>
                  </div>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Venue Info -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#0f172a;">${venue.name}</p>
              <p style="margin:0 0 6px;font-size:14px;color:#64748b;">${venue.address}</p>
              <p style="margin:0;font-size:14px;color:#64748b;">${venue.phone}</p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background:#f8fafc;text-align:center;border-radius:0 0 20px 20px;">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
                Powered by <strong style="color:#64748b;">Nab a Table</strong>
              </p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;">
                Email Type: ${emailType.name.replace(/[^a-zA-Z0-9 ]/g, '')}<br>
                Sent at: ${now.toISOString()}
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// Send all emails with delay between each
async function sendAllEmails() {
  console.log(`\n📧 Sending all 5 booking emails to: ${email}\n`);
  console.log('─'.repeat(50));

  for (let i = 0; i < emailTypes.length; i++) {
    const emailType = emailTypes[i];

    try {
      console.log(`\n${emailType.name}`);
      console.log(`   Subject: ${emailType.subject}`);

      const result = await resend.emails.send({
        from: RESEND_FROM,
        to: email,
        subject: emailType.subject,
        html: generateEmailHtml(emailType),
      });

      if (result.data?.id) {
        console.log(`   ✅ Sent! ID: ${result.data.id}`);
      } else if (result.error) {
        console.log(`   ❌ Error: ${result.error.message}`);
      }

      // Add delay between emails to avoid rate limiting
      if (i < emailTypes.length - 1) {
        console.log(`   ⏳ Waiting 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}`);
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log('\n✅ All emails sent! Check your inbox.\n');
  console.log('📊 Email Copy Features:');
  console.log('   • Psychology-backed headlines with emojis');
  console.log('   • Personalized greetings using first name');
  console.log('   • Varied copy to prevent email fatigue');
  console.log('   • Action-oriented CTAs with arrows');
  console.log('   • Social proof mentions in review requests');
  console.log('   • FOMO/urgency in reminders\n');
}

sendAllEmails();
