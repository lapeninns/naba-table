#!/usr/bin/env tsx
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testPartySize(partySize: number) {
  // Import the function
  const { quoteTablesForBooking } = await import('@/server/capacity/tables');
  
  // Find or create a booking for this party size
  const { data: existing } = await supabase
    .from('bookings')
    .select('id, reference, party_size, status')
    .eq('party_size', partySize)
    .eq('restaurant_id', '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a')  // Prince of Wales
    .limit(1)
    .single();
  
  if (!existing) {
    console.log(`❌ No booking found for party of ${partySize}`);
    return null;
  }
  
  console.log(`\n📋 Testing party of ${partySize} (${existing.reference})...`);
  
  const quote = await quoteTablesForBooking({
    bookingId: existing.id,
    createdBy: 'test-script',
    holdTtlSeconds: 180
  });
  
  if (quote.candidate) {
    const tableIds = quote.hold?.tableIds || [];
    const { data: tables } = await supabase
      .from('table_inventory')
      .select('table_number, capacity, max_party_size')
      .in('id', tableIds);
    
    const totalCapacity = tables?.reduce((sum: number, t: any) => sum + (t.capacity || 0), 0) || 0;
    const maxPartySizes = tables?.map((t: any) => t.max_party_size) || [];
    
    console.log(`✅ SUCCESS: ${tableIds.length} tables assigned`);
    console.log(`   Tables: ${tables?.map((t: any) => t.table_number).join(', ')}`);
    console.log(`   Capacities: ${tables?.map((t: any) => t.capacity).join(', ')}`);
    console.log(`   Max Party Sizes: ${maxPartySizes.join(', ')}`);
    console.log(`   Total capacity: ${totalCapacity} (slack: ${totalCapacity - partySize})`);
    
    return { success: true, tableCount: tableIds.length, totalCapacity };
  } else {
    console.log(`❌ FAILED: ${quote.reason || 'Unknown reason'}`);
    return { success: false, reason: quote.reason };
  }
}

async function main() {
  console.log('🧪 Testing Multiple Party Sizes');
  console.log('================================\n');
  
  const partySizes = [2, 6, 9, 11, 12, 13, 14];
  type TestResult = { size: number; success: boolean; tableCount?: number; totalCapacity?: number; reason?: string };
  const results: TestResult[] = [];
  
  for (const size of partySizes) {
    const result = await testPartySize(size);
    results.push(result ? { size, ...result } : { size, success: false, reason: 'no booking' });
  }
  
  console.log('\n\n📊 Summary');
  console.log('==========');
  results.forEach((r) => {
    if (r.success) {
      console.log(`✅ Party of ${r.size}: ${r.tableCount} tables, capacity ${r.totalCapacity}`);
    } else {
      console.log(`❌ Party of ${r.size}: FAILED (${r.reason || 'no booking'})`);
    }
  });
}

main();
