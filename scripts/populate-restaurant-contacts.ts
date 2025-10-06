import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function populateRestaurantContacts() {
  console.log('📋 Fetching current restaurants...\n');
  
  const { data: restaurants, error: fetchError } = await supabase
    .from('restaurants')
    .select('id, name, slug, contact_email, contact_phone, address, booking_policy');
  
  if (fetchError) {
    console.error('Error fetching restaurants:', fetchError);
    process.exit(1);
  }

  console.log(`Found ${restaurants?.length || 0} restaurants\n`);

  const updates = [
    {
      slug: 'old-crown-pub',
      contact_email: 'reservations@oldcrownpub.co.uk',
      contact_phone: '+44 20 7123 4567',
      address: '33 New Oxford Street, London WC1A 1BH',
      booking_policy: 'Reservations can be cancelled or modified up to 24 hours before your booking. For same-day changes, please call us directly at +44 20 7123 4567.'
    },
    {
      slug: 'the-queen-elizabeth-pub',
      contact_email: 'bookings@queenelizabethpub.com',
      contact_phone: '+44 20 7456 7890',
      address: '45 Westminster Bridge Road, London SE1 7EH',
      booking_policy: 'We kindly request 24 hours notice for cancellations or amendments. For bookings within 24 hours, please contact us at +44 20 7456 7890 and we\'ll be happy to assist.'
    },
    {
      slug: 'prince-of-wales-pub',
      contact_email: 'hello@princeofwalespub.co.uk',
      contact_phone: '+44 20 7345 6789',
      address: '29 Kensington Church Street, London W8 4LL',
      booking_policy: 'Cancellations accepted up to 24 hours prior to your reservation. For urgent enquiries, contact us at +44 20 7345 6789.'
    },
    {
      slug: 'the-barley-mow-pub',
      contact_email: 'bookings@barleymow.london',
      contact_phone: '+44 20 7234 8901',
      address: '82 Long Lane, London SE1 4AU',
      booking_policy: 'Please provide 24 hours notice for cancellations. Same-day modifications can be made by calling +44 20 7234 8901.'
    },
    {
      slug: 'the-bell-sawtry',
      contact_email: 'reservations@thebellsawtry.co.uk',
      contact_phone: '+44 1487 830 213',
      address: 'Great North Road, Sawtry, Huntingdon PE28 5UZ',
      booking_policy: 'We require 24 hours notice for cancellations or changes. For assistance, please call +44 1487 830 213.'
    },
    {
      slug: 'the-corner-house-pub',
      contact_email: 'info@cornerhousepub.com',
      contact_phone: '+44 20 7567 1234',
      address: '45 Bethnal Green Road, London E1 6LA',
      booking_policy: 'Reservations may be cancelled up to 24 hours in advance. For last-minute changes, ring us on +44 20 7567 1234.'
    },
    {
      slug: 'the-railway-pub',
      contact_email: 'bookings@railwaypub.co.uk',
      contact_phone: '+44 20 7678 2345',
      address: '15 Station Approach, London SE15 4RX',
      booking_policy: 'Please cancel or modify reservations 24 hours ahead. For immediate assistance, contact +44 20 7678 2345.'
    },
    {
      slug: 'white-horse-pub',
      contact_email: 'reservations@whitehorsepub.london',
      contact_phone: '+44 20 7789 3456',
      address: '1 Parsons Green, London SW6 4UL',
      booking_policy: '24 hours notice required for cancellations and amendments. Call +44 20 7789 3456 for same-day requests.'
    }
  ];

  for (const update of updates) {
    const restaurant = restaurants?.find(r => r.slug === update.slug);
    
    if (restaurant) {
      console.log(`✏️  Updating ${restaurant.name}...`);
      
      const { error: updateError } = await supabase
        .from('restaurants')
        .update({
          contact_email: update.contact_email,
          contact_phone: update.contact_phone,
          address: update.address,
          booking_policy: update.booking_policy
        })
        .eq('id', restaurant.id);
      
      if (updateError) {
        console.error(`   ❌ Error updating ${restaurant.name}:`, updateError);
      } else {
        console.log(`   ✅ Updated successfully`);
        console.log(`      Email: ${update.contact_email}`);
        console.log(`      Phone: ${update.contact_phone}`);
        console.log(`      Address: ${update.address}\n`);
      }
    } else {
      console.log(`⚠️  Restaurant with slug "${update.slug}" not found\n`);
    }
  }

  // Fetch updated data
  console.log('\n📊 Final restaurant contact details:\n');
  const { data: finalData } = await supabase
    .from('restaurants')
    .select('name, slug, contact_email, contact_phone, address')
    .order('name');
  
  if (finalData) {
    finalData.forEach(r => {
      console.log(`${r.name} (${r.slug})`);
      console.log(`  📧 ${r.contact_email}`);
      console.log(`  📞 ${r.contact_phone}`);
      console.log(`  📍 ${r.address}\n`);
    });
  }

  console.log('✅ Restaurant contact population complete!');
}

populateRestaurantContacts().catch(console.error);
