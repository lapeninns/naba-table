import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendFrom = process.env.RESEND_FROM || 'noreply@lapeninns.com';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials. Check .env.local file.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function showEmailFromNames() {
  console.log('\n📧 Restaurant Email From Names Preview\n');
  console.log('============================================================\n');

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('id, name, contact_email, contact_phone')
    .order('name');

  if (error || !restaurants) {
    console.error('❌ Error fetching restaurants:', error);
    return;
  }

  console.log(`Using sender email: ${resendFrom}\n`);

  restaurants.forEach((restaurant, index) => {
    const fromName = `${restaurant.name} <${resendFrom}>`;
    console.log(`${index + 1}. ${restaurant.name}`);
    console.log(`   From: ${fromName}`);
    console.log(`   Contact: ${restaurant.contact_email}`);
    console.log(`   Phone: ${restaurant.contact_phone}\n`);
  });

  console.log('════════════════════════════════════════════════════════════\n');
  console.log('✅ When customers receive booking emails, they will see:\n');
  console.log('   From: "Old Crown Pub <noreply@lapeninns.com>"');
  console.log('   From: "Prince of Wales Pub <noreply@lapeninns.com>"');
  console.log('   From: "The Barley Mow Pub <noreply@lapeninns.com>"\n');
  console.log('🎉 Each restaurant has its own branded sender name!\n');
}

showEmailFromNames();
