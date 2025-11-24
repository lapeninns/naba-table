// Test script to verify email functionality
// Run with: node test-email.mjs

import 'dotenv/config';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM ?? 'Nab a Table <noreply@example.com>';

if (!resendApiKey) {
  console.error('❌ RESEND_API_KEY is not set. Provide it via environment variable.');
  process.exit(1);
}

const resend = new Resend(resendApiKey);

async function testEmailSending() {
  try {
    console.log('Testing Resend email sending...');
    
    const to = process.env.TEST_EMAIL_RECIPIENT ?? process.argv[2];

    if (!to) {
      console.error('❌ Missing recipient. Set TEST_EMAIL_RECIPIENT env var or pass as CLI argument.');
      process.exit(1);
    }

    const now = new Date().toISOString();
    const subject = 'Test Email from Nab a Table';
    const result = await resend.emails.send({
      from: resendFrom,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Test Email</h1>
          <p>This is a test email to verify that Resend is configured correctly.</p>
          <p>If you receive this email, the integration is working!</p>
          <p>Sent at: ${now}</p>
        </div>
      `,
      text: `Test Email\n\nThis is a test email to verify that Resend is configured correctly.\n\nIf you receive this email, the integration is working!\n\nSent at: ${now}`,
    });

    console.log('✅ Email sent successfully!');
    console.log('Result:', result);
    
    if (result.data?.id) {
      console.log(`📧 Email ID: ${result.data.id}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    
    if (error.message) {
      console.error('Error message:', error.message);
    }
    
    if (error.name) {
      console.error('Error type:', error.name);
    }
  }
}

testEmailSending();
