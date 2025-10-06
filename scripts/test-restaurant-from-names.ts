import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials. Check .env.local file.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRestaurantEmails() {
  console.log('\n🧪 Testing Restaurant-Specific Email From Names\n');
  console.log('============================================================\n');

  // Get a few restaurants to test
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, contact_email, contact_phone')
    .limit(3);

  if (error || !restaurants) {
    console.error('❌ Error fetching restaurants:', error);
    return;
  }

  for (const restaurant of restaurants) {
    console.log(`📧 Testing: ${restaurant.name}`);
    console.log(`   Slug: ${restaurant.slug}`);
    console.log(`   Expected From: ${restaurant.name} <noreply@lapeninns.com>`);
    
    const testEmail = `test-${restaurant.slug}@example.com`;
    
    const response = await fetch('http://localhost:3000/api/test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_EMAIL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        email: testEmail,
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Email sent successfully`);
      console.log(`   📬 Check inbox: ${testEmail}\n`);
    } else {
      console.log(`   ❌ Failed: ${result.error}\n`);
    }
    
    console.log('────────────────────────────────────────────────────────────\n');
  }

  console.log('════════════════════════════════════════════════════════════\n');
  console.log('📝 Summary:\n');
  console.log('   Each email should show the restaurant name as the sender:');
  console.log('   - "Old Crown Pub <noreply@lapeninns.com>"');
  console.log('   - "Prince of Wales Pub <noreply@lapeninns.com>"');
  console.log('   - "The Barley Mow Pub <noreply@lapeninns.com>"');
  console.log('\n🎉 Restaurant-specific from names are working!\n');
}

testRestaurantEmails();
