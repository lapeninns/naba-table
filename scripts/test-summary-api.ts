import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
loadEnv({ path: path.join(projectRoot, '.env.local') });

// Now import other modules
import { getTodayBookingsSummary } from '../server/ops/bookings';
import { getServiceSupabaseClient } from '../server/supabase';

async function testSummary() {
  const restaurantId = '486de541-a307-4414-b0b1-f774a0e4a9fa'; // White Horse Pub
  const date = '2026-01-20';

  console.log(`Testing summary for restaurant ${restaurantId} on ${date}...`);

  try {
    const summary = await getTodayBookingsSummary(restaurantId, {
      client: getServiceSupabaseClient(),
      targetDate: date,
    });
    console.log('Summary loaded successfully!');
    console.log('Totals:', summary.totals);
  } catch (error) {
    console.error('Failed to load summary:', error);
  }
}

testSummary();
