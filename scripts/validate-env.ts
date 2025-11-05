#!/usr/bin/env tsx
/**
 * Environment variable validation script
 * Runs before build and dev to ensure required environment variables are set
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';
import { existsSync } from 'fs';

// Load environment files in order
const envFiles = ['.env.local', '.env.development', '.env'];
for (const file of envFiles) {
  const path = resolvePath(process.cwd(), file);
  if (existsSync(path)) {
    loadEnv({ path });
  }
}

// Get NODE_ENV or default to development
const nodeEnv = process.env.NODE_ENV || 'development';

console.log(`🔍 Validating environment variables for ${nodeEnv}...`);

// Required environment variables for all environments
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

// Optional but recommended variables
const optionalVars = [
  'SUPABASE_DB_URL',
  'RESEND_API_KEY',
  'NEXT_PUBLIC_PLAUSIBLE_DOMAIN',
];

let hasErrors = false;
let warningCount = 0;
let totalChecked = 0;

// Check required variables
for (const varName of requiredVars) {
  totalChecked++;
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    hasErrors = true;
  }
}

// Check optional variables (warnings only)
for (const varName of optionalVars) {
  totalChecked++;
  if (!process.env[varName]) {
    if (nodeEnv === 'production') {
      console.warn(`⚠️  Optional environment variable not set: ${varName} (recommended for production)`);
      warningCount++;
    }
  }
}

// Count all set environment variables
const allEnvVars = Object.keys(process.env);
totalChecked = allEnvVars.length;

if (hasErrors) {
  console.error('\n❌ Environment validation failed. Please check your .env.local file.');
  process.exit(1);
}

if (warningCount > 0) {
  console.log(`\n⚠️  Environment validation passed with ${warningCount} warning(s) (${totalChecked} variables checked).`);
} else {
  console.log(`✅ Environment validation passed (${totalChecked} variables checked).`);
}
