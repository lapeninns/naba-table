import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { ZodIssue } from "zod";

import { envSchemas, resolveEnvSchemaTarget } from "../config/env.schema";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const envLocalPath = path.join(projectRoot, ".env.local");

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const schemaTarget = resolveEnvSchemaTarget(process.env);
const schema = envSchemas[schemaTarget];

if (!schema) {
  console.error(`Unknown env schema target "${schemaTarget}". Expected one of: ${Object.keys(envSchemas).join(", ")}.`);
  process.exit(1);
}

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error("Environment validation failed:\n");
  logIssues(result.error.issues);
  process.exit(1);
}

const env = result.data;
const blockers: string[] = [];
const warnings: string[] = [];

const appEnv = env.APP_ENV;
const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development'
const allowProdResources = env.ALLOW_PROD_RESOURCES_IN_NONPROD === true;

// Skip prod-resource guard when the deployment target itself is production (e.g., Vercel prod build)
const treatAsProdTarget = appEnv === "production" || vercelEnv === "production";

// -----------------------------------------------------------------------------
// Production safety invariants (avoid silent background job failures)
// -----------------------------------------------------------------------------
if (treatAsProdTarget) {
  const emailQueueEnabled = env.FEATURE_EMAIL_QUEUE_ENABLED === true;
  if (emailQueueEnabled) {
    if (!env.CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL || !env.CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN) {
      blockers.push(
        "FEATURE_EMAIL_QUEUE_ENABLED=true requires CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL and CLOUDFLARE_EMAIL_QUEUE_GATEWAY_TOKEN to be set. Without them, delayed emails cannot reach the Cloudflare queue bridge.",
      );
    }
    if (!env.CRON_SECRET) {
      blockers.push(
        "FEATURE_EMAIL_QUEUE_ENABLED=true requires CRON_SECRET to be set so trusted queue consumers can call /api/cron/process-emails.",
      );
    }
  }

  if (env.RESEND_USE_MOCK === true) {
    blockers.push("RESEND_USE_MOCK=true is not allowed for production targets.");
  }
}

if (!treatAsProdTarget && !allowProdResources) {
  const comparisons: Array<{ key: string; value?: string; prodKey: string; prodValue?: string }> = [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      value: env.NEXT_PUBLIC_SUPABASE_URL,
      prodKey: "PRODUCTION_SUPABASE_URL",
      prodValue: env.PRODUCTION_SUPABASE_URL,
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      value: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      prodKey: "PRODUCTION_SUPABASE_ANON_KEY",
      prodValue: env.PRODUCTION_SUPABASE_ANON_KEY,
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      value: env.SUPABASE_SERVICE_ROLE_KEY,
      prodKey: "PRODUCTION_SUPABASE_SERVICE_ROLE_KEY",
      prodValue: env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY,
    },
    {
      key: "RESERVE_API_BASE_URL",
      value: env.RESERVE_API_BASE_URL,
      prodKey: "PRODUCTION_BOOKING_API_BASE_URL",
      prodValue: env.PRODUCTION_BOOKING_API_BASE_URL,
    },
  ];

  for (const { key, value, prodKey, prodValue } of comparisons) {
    if (!value || !prodValue) continue;
    if (value === prodValue) {
      blockers.push(
        `${key} matches ${prodKey} while APP_ENV=${appEnv}. Set ALLOW_PROD_RESOURCES_IN_NONPROD=true to override or point to staging values.`,
      );
    }
  }
}

const dbTargetEnv = process.env.DB_TARGET_ENV ?? appEnv;
const allowProdDbWipe = process.env.ALLOW_PROD_DB_WIPE === "true";

if (dbTargetEnv === "production" && !allowProdDbWipe && !treatAsProdTarget) {
  blockers.push(
    `DB_TARGET_ENV is set to "production" while APP_ENV=${appEnv} (VERCEL_ENV=${vercelEnv ?? "unset"}) without ALLOW_PROD_DB_WIPE=true. This is blocked to protect the production database.`,
  );
}

if (process.env.APP_ENV === "staging" && process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "production") {
  warnings.push(`APP_ENV=staging should typically run with NODE_ENV=development locally or NODE_ENV=production for deploy previews.`);
}

if (blockers.length > 0) {
  console.error("\nEnvironment safety checks failed:\n");
  for (const blocker of blockers) {
    console.error(` • ${blocker}`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn("\nEnvironment warnings:\n");
  for (const warning of warnings) {
    console.warn(` • ${warning}`);
  }
}

console.log(
  `Environment validation passed for schema=${schemaTarget}, NODE_ENV=${process.env.NODE_ENV ?? "development"}, APP_ENV=${appEnv}, VERCEL_ENV=${vercelEnv ?? "unset"}.`,
);

function logIssues(issues: ZodIssue[]) {
  for (const issue of issues) {
    console.error(` • [${issue.code}] ${issue.path.join(".") || "value"}: ${issue.message}`);
  }
}
