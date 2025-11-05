#!/usr/bin/env tsx
/**
 * Run auto-assignment for table combination testing (2025-11-15)
 * Based on ops-auto-assign-ultra-fast.ts but targets the combination test date
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

if (!process.env.FEATURE_AUTO_ASSIGN_ON_BOOKING) {
  process.env.FEATURE_AUTO_ASSIGN_ON_BOOKING = 'true';
}
process.env.SUPPRESS_EMAILS = process.env.SUPPRESS_EMAILS ?? 'true';

const CONFIG = {
  TARGET_RESTAURANT_SLUG: 'prince-of-wales-pub-bromham',
  TARGET_DATE: '2025-11-15',  // Combination test date
  MAX_CONCURRENT_BOOKINGS: 15,
  SINGLE_ATTEMPT_ONLY: true,
  HOLD_TTL_SECONDS: 180,
};

console.log("\n🎯 COMBINATION TEST - Auto-Assignment");
console.log("=====================================");
console.log(`Restaurant: ${CONFIG.TARGET_RESTAURANT_SLUG}`);
console.log(`Date: ${CONFIG.TARGET_DATE}`);
console.log(`Adjacency required: ${process.env.FEATURE_ALLOCATOR_REQUIRE_ADJACENCY || 'default (true)'}`);
console.log(`Combination planner: ${process.env.FEATURE_COMBINATION_PLANNER || 'default (false)'}`);
console.log("=====================================\n");

// Now run the regular script
import('./ops-auto-assign-ultra-fast');
