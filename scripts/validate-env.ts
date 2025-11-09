#!/usr/bin/env tsx
/**
 * Environment variable validation script
 * Runs before build and dev to ensure required environment variables are set
 */

import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';

export const ENV_FILES = ['.env.local', '.env.development', '.env'];
export const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];
export const OPTIONAL_ENV_VARS = ['SUPABASE_DB_URL', 'RESEND_API_KEY', 'NEXT_PUBLIC_PLAUSIBLE_DOMAIN'];

type Logger = Pick<typeof console, 'log' | 'warn' | 'error'>;

export interface ValidationSummary {
  nodeEnv: string;
  totalChecked: number;
  missingRequired: string[];
  missingOptional: string[];
  hasErrors: boolean;
  warningCount: number;
}

export interface ValidateEnvironmentOptions {
  env?: NodeJS.ProcessEnv;
  nodeEnv?: string;
  logger?: Logger;
}

export function loadEnvironmentFiles(files: string[] = ENV_FILES): string[] {
  const loadedFiles: string[] = [];
  for (const file of files) {
    const path = resolvePath(process.cwd(), file);
    if (existsSync(path)) {
      loadEnv({ path });
      loadedFiles.push(path);
    }
  }

  return loadedFiles;
}

export function validateEnvironment(options: ValidateEnvironmentOptions = {}): ValidationSummary {
  const env = options.env ?? process.env;
  const nodeEnv = options.nodeEnv ?? env.NODE_ENV ?? 'development';
  const logger = options.logger ?? console;

  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!env[varName]) {
      logger.error(`❌ Missing required environment variable: ${varName}`);
      missingRequired.push(varName);
    }
  }

  if (nodeEnv === 'production') {
    for (const varName of OPTIONAL_ENV_VARS) {
      if (!env[varName]) {
        logger.warn(`⚠️  Optional environment variable not set: ${varName} (recommended for production)`);
        missingOptional.push(varName);
      }
    }
  }

  const totalChecked = Object.keys(env).length;
  const warningCount = missingOptional.length;
  const hasErrors = missingRequired.length > 0;

  if (hasErrors) {
    logger.error('\n❌ Environment validation failed. Please check your .env.local file.');
  }

  return {
    nodeEnv,
    totalChecked,
    missingRequired,
    missingOptional,
    hasErrors,
    warningCount,
  };
}

export function runCliValidation() {
  loadEnvironmentFiles();

  const nodeEnv = process.env.NODE_ENV || 'development';
  const logger = console;

  logger.log(`🔍 Validating environment variables for ${nodeEnv}...`);
  const summary = validateEnvironment({ env: process.env, nodeEnv, logger });

  if (summary.hasErrors) {
    process.exit(1);
  }

  if (summary.warningCount > 0) {
    logger.log(
      `\n⚠️  Environment validation passed with ${summary.warningCount} warning(s) (${summary.totalChecked} variables checked).`,
    );
  } else {
    logger.log(`✅ Environment validation passed (${summary.totalChecked} variables checked).`);
  }
}

const executedPath = process.argv[1] ? resolvePath(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);

if (executedPath === modulePath) {
  runCliValidation();
}
