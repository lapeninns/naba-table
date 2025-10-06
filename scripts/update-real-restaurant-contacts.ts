import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials. Check .env.local file.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const restaurants = [
  {
    name: 'The Queen Elizabeth Pub',
    domain: 'thequeenelizabethpub.co.uk',
    contact_email: 'thequeen@lapeninns.com',
    contact_phone: '01553 824083',
    address: '32 Gayton Road, Kings Lynn, PE30 4EL',
    booking_policy: 'Call us at 01553 824083 or email thequeen@lapeninns.com for reservations. Walk-ins welcome based on availability.'
  },
  {
    name: 'Old Crown Pub',
    domain: 'oldcrowngirton.com',
    contact_email: 'oldcrown@lapeninns.com',
    contact_phone: '01223 276027',
    address: '89 High Street, Girton, Cambridge, CB3 0QQ',
    booking_policy: 'Book your table by calling 01223 276027 or emailing oldcrown@lapeninns.com. Same-day reservations welcome.'
  },
  {
    name: 'White Horse Pub',
    domain: 'whitehorsepub.co',
    contact_email: 'whitehorse@lapeninns.com',
    contact_phone: '01223 277217',
    address: '89 High Street, Cambridge, CB3 0QD',
    booking_policy: 'Reserve your table at 01223 277217 or whitehorse@lapeninns.com. Groups of 6+ please call ahead.'
  },
  {
    name: 'The Corner House Pub',
    domain: 'thecornerhousepub.co',
    contact_email: 'cornerhouse@lapeninns.com',
    contact_phone: '01223 921122',
    address: '231 Newmarket Road, Cambridge, CB5 8JE',
    booking_policy: 'Contact us at 01223 921122 or cornerhouse@lapeninns.com to book. Weekend reservations recommended.'
  },
  {
    name: 'Prince of Wales Pub',
    domain: 'princeofwalesbromham.com',
    contact_email: 'theprince@lapeninns.com',
    contact_phone: '01234 822447',
    address: '8 Northampton Rd, Bedford, MK43 8PE',
    booking_policy: 'Call 01234 822447 or email theprince@lapeninns.com for bookings. Mobile: 07588 864819 for urgent inquiries.'
  },
  {
    name: 'The Bell Sawtry',
    domain: 'thebellsawtry.com',
    contact_email: 'thebell@lapeninns.com',
    contact_phone: '01487 900149',
    address: '82 Green End Road, Sawtry, Huntingdon, PE28 5UY',
    booking_policy: 'Book your table at 01487 900149 or thebell@lapeninns.com. Large parties please reserve in advance.'
  },
  {
    name: 'The Railway Pub',
    domain: 'therailwaypub.co',
    contact_email: 'therailway@lapeninns.com',
    contact_phone: '01733 788345',
    address: '139 Station Road, Whittlesey, PE7 1UF',
    booking_policy: 'Reserve at 01733 788345 or therailway@lapeninns.com. Walk-ins welcome, bookings ensure your table.'
  },
  {
    name: 'The Barley Mow Pub',
    domain: 'barleymowhartford.co.uk',
    contact_email: 'barleymow@lapeninns.com',
    contact_phone: '01480 450550',
    address: '42 Main St, Hartford, Huntingdon, PE29 1XU',
    booking_policy: 'Call 01480 450550 or email barleymow@lapeninns.com to book. Mobile: 07399 835329 for urgent requests.'
  }
];

async function updateRestaurantContacts() {
  console.log('🔄 Updating restaurant contacts with real lapeninns.com details...\n');

  for (const restaurant of restaurants) {
    const { data, error } = await supabase
      .from('restaurants')
      .update({
        contact_email: restaurant.contact_email,
        contact_phone: restaurant.contact_phone,
        address: restaurant.address,
        booking_policy: restaurant.booking_policy
      })
      .eq('name', restaurant.name)
      .select('id, name, contact_email, contact_phone, address');

    if (error) {
      console.error(`❌ Error updating ${restaurant.name}:`, error);
    } else if (data && data.length > 0) {
      console.log(`✅ Updated ${restaurant.name}:`);
      console.log(`   Email: ${data[0].contact_email}`);
      console.log(`   Phone: ${data[0].contact_phone}`);
      console.log(`   Address: ${data[0].address}\n`);
    } else {
      console.log(`⚠️  Restaurant not found: ${restaurant.name}\n`);
    }
  }

  console.log('✅ All restaurant contacts updated with real lapeninns.com emails!');
}

updateRestaurantContacts();
