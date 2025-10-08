#!/usr/bin/env node

/**
 * Verify that the database seed was successful
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public'
  }
});

async function verifySeed() {
  console.log('🔍 Verifying database seed...\n');

  try {
    // Count restaurants
    const { count: pubCount, error: pubError } = await supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true });
    
    if (pubError) {
      console.error('Error counting restaurants:', pubError);
      throw pubError;
    }

    // Count tables (optional)
    let tableCount = null;
    try {
      const { count, error } = await supabase
        .from('restaurant_tables')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      tableCount = count ?? 0;
    } catch (tableError) {
      console.warn('⚠️  Skipping restaurant_tables count:', tableError.message ?? tableError);
    }

    // Count customers
    const { count: customerCount, error: customerError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
    
    if (customerError) throw customerError;

    // Count bookings
    const { count: bookingCount, error: bookingError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true });
    
    if (bookingError) throw bookingError;

    // Get booking distribution
    const { data: bookings, error: bookingDistError } = await supabase
      .from('bookings')
      .select('booking_date, status');
    
    if (bookingDistError) throw bookingDistError;

    const today = new Date().toISOString().split('T')[0];
    const past = bookings.filter(b => b.booking_date < today).length;
    const todayCount = bookings.filter(b => b.booking_date === today).length;
    const future = bookings.filter(b => b.booking_date > today).length;

    // Get status distribution
    const statusCounts = bookings.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});

    // Display results
    console.log('📊 Database Counts:');
    console.log('─'.repeat(40));
    console.log(`  Restaurants:     ${pubCount} (expected: 8)`);
    console.log(
      `  Tables:          ${tableCount === null ? 'n/a' : tableCount} (expected: ${
        tableCount === null ? 'n/a' : '96'
      })`
    );
    console.log(`  Customers:       ${customerCount} (expected: 400)`);
    console.log(`  Bookings:        ${bookingCount} (expected: 1200)`);
    console.log('');

    console.log('📅 Booking Distribution:');
    console.log('─'.repeat(40));
    console.log(`  Past:            ${past} (expected: 480)`);
    console.log(`  Today:           ${todayCount} (expected: 160)`);
    console.log(`  Future:          ${future} (expected: 560)`);
    console.log('');

    console.log('📋 Booking Status:');
    console.log('─'.repeat(40));
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status.padEnd(15)}: ${count}`);
    });
    console.log('');

    // Verify each pub has 150 bookings
    const { data: pubs } = await supabase
      .from('restaurants')
      .select('id, name, slug');

    console.log('🏪 Bookings per Restaurant:');
    console.log('─'.repeat(40));
    
    for (const pub of pubs) {
      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', pub.id);
      
      console.log(`  ${pub.name.padEnd(30)}: ${count}`);
    }
    console.log('');

    const { count: specialBookingCount, error: specialError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('customer_email', 'amanshresthaaaaa@gmail.com');

    if (specialError) throw specialError;
    console.log(`⭐ Special guest bookings (amanshresthaaaaa@gmail.com): ${specialBookingCount}`);
    console.log('');

    // Validation
    const validations = [
      { name: 'Pubs', actual: pubCount, expected: 8 },
      { name: 'Customers', actual: customerCount, expected: 400 },
      { name: 'Bookings', actual: bookingCount, expected: 1200 },
    ];

    if (tableCount !== null) {
      validations.push({ name: 'Tables', actual: tableCount, expected: 96 });
    }

    validations.push(
      { name: 'Past bookings', actual: past, expected: 480 },
      { name: 'Today bookings', actual: todayCount, expected: 160 },
      { name: 'Future bookings', actual: future, expected: 560 },
      { name: 'Special guest bookings', actual: specialBookingCount ?? 0, expected: 24 },
    );

    const allValid = validations.every(v => v.actual === v.expected);

    if (allValid) {
      console.log('✅ All validations passed! Database seed is correct.');
    } else {
      console.log('❌ Some validations failed:');
      validations
        .filter(v => v.actual !== v.expected)
        .forEach(v => {
          console.log(`  - ${v.name}: got ${v.actual}, expected ${v.expected}`);
        });
    }

  } catch (error) {
    console.error('❌ Error verifying seed:', error.message);
    process.exit(1);
  }
}

verifySeed();
