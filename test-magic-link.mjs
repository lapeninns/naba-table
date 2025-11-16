#!/usr/bin/env node

/**
 * Test script to verify magic link authentication is working
 * Run with: node test-magic-link.mjs <email>
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

async function testMagicLink() {
  const testEmail = process.argv[2] || process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  if (!testEmail) {
    console.error('❌ No test email provided. Usage: node test-magic-link.mjs <email>');
    process.exit(1);
  }

  console.log('🧪 Testing magic link authentication...');
  console.log(`📧 Test email: ${testEmail}`);
  console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('📤 Sending magic link request...');
    const { data, error } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`,
      },
    });

    if (error) {
      console.error('❌ Magic link failed!');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error status:', error.status);
      console.error('Full error:', error);
      process.exit(1);
    }

    console.log('✅ Magic link sent successfully!');
    console.log('📬 Check your inbox for the magic link email');
    console.log('Response:', data);

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

testMagicLink();
