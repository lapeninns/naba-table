#!/usr/bin/env tsx
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables!');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const tableIds = [
    '4b0e1a00-6663-43fd-b4ab-28776e4822f3',
    'eb1535fd-f415-48f7-a7c9-03442cdf96b1'
  ];
  
  const { data, error } = await supabase
    .from('table_inventory')
    .select('table_number, capacity, max_party_size')
    .in('id', tableIds);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Assigned Tables for Party of 11:');
  console.table(data);
  
  const totalCapacity = data?.reduce((sum, t) => sum + (t.capacity || 0), 0) || 0;
  console.log(`\nTotal capacity: ${totalCapacity}`);
  console.log('Party size: 11');
  console.log(`Slack: ${totalCapacity - 11}`);
}

checkTables();
