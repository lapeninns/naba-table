import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testEmail() {
  // Get a real restaurant
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, contact_email, contact_phone, address')
    .eq('slug', 'the-queen-elizabeth-pub')
    .single();

  if (!restaurant) {
    console.error('Restaurant not found!');
    return;
  }

  console.log(`\n📧 Testing email for: ${restaurant.name}`);
  console.log(`   Restaurant ID: ${restaurant.id}`);
  console.log(`   Contact Email: ${restaurant.contact_email}`);
  console.log(`   Contact Phone: ${restaurant.contact_phone}`);
  console.log(`   Address: ${restaurant.address}\n`);

  // Make request to test email endpoint
  const response = await fetch(`http://localhost:3000/api/test-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TEST_EMAIL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      type: 'booking',
      email: 'test@example.com',
      restaurantId: restaurant.id,
    }),
  });

  const result = await response.json();
  
  if (response.ok) {
    console.log('✅ Email sent successfully!');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n📬 Check your email inbox for test@example.com to verify tenant-specific details.');
  } else {
    console.error('❌ Email failed:');
    console.error(JSON.stringify(result, null, 2));
  }
}

testEmail().catch(console.error);
