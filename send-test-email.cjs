// Quick test script to send email using Resend
// Run with: node send-test-email.cjs amanshresthaaaaa@gmail.com

require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

const email = process.argv[2];
if (!email) {
    console.error('Usage: node send-test-email.cjs <email>');
    process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
    console.error('❌ RESEND_API_KEY not found in .env.local');
    process.exit(1);
}

console.log('📧 Sending test email to:', email);

const resend = new Resend(apiKey);

resend.emails.send({
    from: process.env.RESEND_FROM || 'Nab a Table <noreply@nabatable.com>',
    to: email,
    subject: 'Test Email from Nab a Table',
    html: `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Test Email</h1>
      <p>This is a test email to verify that email sending is working correctly.</p>
      <p>All guest emails are now enabled by default and cannot be disabled.</p>
      <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
    </div>
  `,
    text: `Test Email\n\nThis is a test email to verify that email sending is working correctly.\n\nSent at: ${new Date().toISOString()}`
}).then(result => {
    console.log('✅ Email sent successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
}).catch(err => {
    console.error('❌ Failed to send email:', err.message);
    process.exit(1);
});
