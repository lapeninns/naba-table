// Validates environment variables at build time using the shared schema.
import { config } from "dotenv";
import { resolve } from "path";
import { getEnv } from "../lib/env";

// Load environment variables before validation (in priority order)
// .env.local has highest priority (local overrides)
config({ path: resolve(process.cwd(), ".env.local") });
// .env.development for development defaults
config({ path: resolve(process.cwd(), ".env.development") });
// .env for shared defaults
config({ path: resolve(process.cwd(), ".env") });

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim();
  }

  if (typeof error === "string") {
    return error;
  }

  return JSON.stringify(error, null, 2);
}

function main() {
  const nodeEnv = process.env.NODE_ENV || "development";
  console.log(`🔍 Validating environment variables for ${nodeEnv}...`);

  try {
    const env = getEnv();
    const varCount = Object.keys(env).length;
    console.log(`✅ Environment validation passed (${varCount} variables checked).`);
  } catch (error) {
    console.error("❌ Environment validation failed:");
    console.error(formatError(error));
    process.exitCode = 1;
  }
}

main();
