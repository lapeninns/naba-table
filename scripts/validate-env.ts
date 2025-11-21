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
const ALLOWED_APP_ENVS = ['development', 'staging', 'production', 'test'] as const;
type AppEnv = (typeof ALLOWED_APP_ENVS)[number];

type Logger = Pick<typeof console, 'log' | 'warn' | 'error'>;

export interface ValidationSummary {
  nodeEnv: string;
  appEnv: AppEnv;
  totalChecked: number;
  missingRequired: string[];
  missingOptional: string[];
  safetyErrors: string[];
  productionMarkerErrors: string[];
  guardOverride: boolean;
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

function toBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

function normalizeAppEnv(raw?: string | null): { appEnv: AppEnv; warning?: string } {
  const normalized = (raw ?? '').toLowerCase().trim();
  if (ALLOWED_APP_ENVS.includes(normalized as AppEnv)) {
    return { appEnv: normalized as AppEnv };
  }
  return {
    appEnv: 'development',
    warning: normalized.length > 0 ? `Unknown APP_ENV "${normalized}" — defaulting to development.` : undefined,
  };
}

function safeDescribe(name: string, value: string): string {
  const length = value.length;
  return `${name}(len=${length})`;
}

const PRODUCTION_MARKER_MAP = [
  ['NEXT_PUBLIC_SUPABASE_URL', 'PRODUCTION_SUPABASE_URL'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'PRODUCTION_SUPABASE_ANON_KEY'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'PRODUCTION_SUPABASE_SERVICE_ROLE_KEY'],
  ['RESERVE_API_BASE_URL', 'PRODUCTION_BOOKING_API_BASE_URL'],
] as const;

function collectProdResourceSafety(
  env: NodeJS.ProcessEnv,
  appEnv: AppEnv,
  nodeEnv: string,
  allowProdResourcesOverride: boolean,
): string[] {
  const errors: string[] = [];

  if (appEnv === 'production' && nodeEnv !== 'production') {
    errors.push(`APP_ENV=production but NODE_ENV=${nodeEnv} — align environments before running.`);
  }

  const guardable = appEnv !== 'production' && !allowProdResourcesOverride;

  if (guardable) {
    for (const [currentKey, markerKey] of PRODUCTION_MARKER_MAP) {
      const current = env[currentKey];
      const prodValue = env[markerKey];
      if (current && prodValue && current === prodValue) {
        errors.push(
          `${currentKey} matches provided production value ${safeDescribe(
            prodValue.length ? currentKey : 'prod',
            prodValue,
          )}; set a non-production credential or export ALLOW_PROD_RESOURCES_IN_NONPROD=true (not recommended).`,
        );
      }
    }
  }

  return errors;
}

function collectProductionMarkerAlignment(env: NodeJS.ProcessEnv, appEnv: AppEnv): string[] {
  if (appEnv !== 'production') return [];

  const errors: string[] = [];
  for (const [liveKey, markerKey] of PRODUCTION_MARKER_MAP) {
    const liveValue = env[liveKey];
    const markerValue = env[markerKey];

    if (!markerValue) {
      errors.push(`Missing ${markerKey} — required in production so environment guards can detect credential drift.`);
      continue;
    }

    if (!liveValue) {
      errors.push(`Missing ${liveKey} while ${markerKey} is set — export active production credentials.`);
      continue;
    }

    if (liveValue !== markerValue) {
      errors.push(
        `${markerKey} does not match live ${liveKey}; set the marker to the active production credential so non-production safeguards remain accurate.`,
      );
    }
  }

  return errors;
}

export function validateEnvironment(options: ValidateEnvironmentOptions = {}): ValidationSummary {
  const env = options.env ?? process.env;
  const nodeEnv = options.nodeEnv ?? env.NODE_ENV ?? 'development';
  const logger = options.logger ?? console;
  const { appEnv, warning: appEnvWarning } = normalizeAppEnv(env.APP_ENV ?? nodeEnv);
  const guardOverride = toBooleanFlag(env.ALLOW_PROD_RESOURCES_IN_NONPROD);

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

  const safetyErrors = collectProdResourceSafety(env, appEnv, nodeEnv, guardOverride);
  const productionMarkerErrors = collectProductionMarkerAlignment(env, appEnv);
  for (const message of [...safetyErrors, ...productionMarkerErrors]) {
    logger.error(`❌ Environment safety guard: ${message}`);
  }

  const totalChecked = Object.keys(env).length;
  const warningCount = missingOptional.length + (appEnvWarning ? 1 : 0);
  const hasErrors = missingRequired.length > 0 || safetyErrors.length > 0 || productionMarkerErrors.length > 0;

  if (appEnvWarning) {
    logger.warn(`⚠️  ${appEnvWarning}`);
  }

  if (hasErrors) {
    logger.error('\n❌ Environment validation failed. Please check your .env.local file.');
  }

  return {
    nodeEnv,
    appEnv,
    totalChecked,
    missingRequired,
    missingOptional,
    safetyErrors,
    productionMarkerErrors,
    guardOverride,
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
