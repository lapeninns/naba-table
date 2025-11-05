#!/usr/bin/env tsx
/**
 * Test if feature flags are being loaded correctly
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function testFeatureFlags() {
  console.log("\n🔍 Testing Feature Flags...\n");

  // Import feature flags module
  const featureFlagsModule = await import('@/server/feature-flags');
  const isCombinationPlannerEnabled = featureFlagsModule.isCombinationPlannerEnabled;

  // Import env module
  const envModule = await import('@/lib/env');
  const env = envModule.env;

  console.log("📋 Environment Variables:");
  console.log(`  FEATURE_COMBINATION_PLANNER = ${process.env.FEATURE_COMBINATION_PLANNER}`);
  console.log(`  FEATURE_ALLOCATOR_MERGES_ENABLED = ${process.env.FEATURE_ALLOCATOR_MERGES_ENABLED}`);
  console.log(`  FEATURE_ALLOCATOR_K_MAX = ${process.env.FEATURE_ALLOCATOR_K_MAX}`);
  console.log(`  FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS = ${process.env.FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS}`);

  console.log("\n📦 Parsed env.featureFlags:");
  console.log(`  combinationPlanner = ${env.featureFlags.combinationPlanner}`);
  console.log(`  allocator.mergesEnabled = ${env.featureFlags.allocator.mergesEnabled}`);
  console.log(`  allocator.kMax = ${env.featureFlags.allocator.kMax}`);
  console.log(`  selector.maxCombinationEvaluations = ${env.featureFlags.selector.maxCombinationEvaluations}`);

  console.log("\n🔧 Feature Flag Functions:");
  console.log(`  isCombinationPlannerEnabled() = ${isCombinationPlannerEnabled()}`);

  // Import more feature flags
  const isAllocatorAdjacencyRequired = featureFlagsModule.isAllocatorAdjacencyRequired;
  const getAllocatorKMax = featureFlagsModule.getAllocatorKMax;
  
  console.log(`  isAllocatorAdjacencyRequired() = ${isAllocatorAdjacencyRequired()}`);
  console.log(`  getAllocatorKMax() = ${getAllocatorKMax()}`);

  console.log("\n");
}

testFeatureFlags().catch(console.error);
