import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

import { getServiceSupabaseClient } from '@/server/supabase';

async function main() {
  const supabase = getServiceSupabaseClient();
  
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('slug, name, id')
    .order('name');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (!restaurants || restaurants.length === 0) {
    console.log('No restaurants found in database');
    return;
  }
  
  console.log('\nAvailable restaurants:\n');
  restaurants.forEach(r => {
    console.log(`  ${r.slug.padEnd(40)} | ${r.name}`);
  });
  console.log(`\nTotal: ${restaurants.length} restaurants\n`);
}

main().catch(console.error);
