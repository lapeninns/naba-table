import { config as loadEnv } from "dotenv";
import path from "node:path";
import process from "node:process";

import { envSchemas } from "@/config/env.schema";

const projectRoot = path.resolve(__dirname, "..");

const envFiles = [
  path.join(projectRoot, ".env"),
  path.join(projectRoot, ".env.local"),
  path.join(projectRoot, `.env.${process.env.NODE_ENV ?? "development"}`),
].filter(Boolean);

for (const file of envFiles) {
  loadEnv({ path: file, override: false });
}

const nodeEnv = (process.env.NODE_ENV ?? "development") as keyof typeof envSchemas;
const schema = envSchemas[nodeEnv] ?? envSchemas.development;

console.log(`\n🔍 Validating environment variables for ${nodeEnv}...`);

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Environment validation failed:\n");

  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "<root>";
    console.error(`  • ${key}: ${issue.message}`);
  }

  console.error("\n💡 Update your environment files to satisfy the schema defined in config/env.schema.ts.\n");
  process.exit(1);
}

console.log(`✅ Environment validation passed (${Object.keys(result.data).length} variables checked).\n`);
