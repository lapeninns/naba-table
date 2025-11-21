#!/usr/bin/env tsx

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const canonicalSchemaPath = path.join(process.cwd(), "supabase", "schema.sql");

if (!existsSync(canonicalSchemaPath)) {
  console.error(`❌ Canonical schema not found at ${canonicalSchemaPath}.`);
  process.exit(1);
}

const driftCheckUrl =
  process.env.DRIFT_CHECK_DB_URL ?? process.env.SUPABASE_DRIFT_CHECK_DB_URL ?? process.env.SUPABASE_DB_URL;

if (!driftCheckUrl) {
  console.error("❌ Set DRIFT_CHECK_DB_URL (or SUPABASE_DRIFT_CHECK_DB_URL / SUPABASE_DB_URL) for drift checks.");
  process.exit(1);
}

const tmpDir = mkdtempSync(path.join(tmpdir(), "schema-drift-"));
const dumpPath = path.join(tmpDir, "remote-schema.sql");

console.log("📥 Dumping remote schema via Supabase CLI...");
const dumpResult = spawnSync(
  "supabase",
  ["db", "dump", "--db-url", driftCheckUrl, "--schema-only", "--file", dumpPath],
  {
    stdio: "inherit",
  },
);

if (dumpResult.status !== 0) {
  console.error("❌ Failed to dump remote schema. Ensure Supabase CLI is installed and credentials are valid.");
  process.exit(dumpResult.status ?? 1);
}

const diffResult = spawnSync("git", ["--no-pager", "diff", "--no-index", "--exit-code", canonicalSchemaPath, dumpPath], {
  encoding: "utf-8",
});

if (diffResult.status !== 0) {
  console.error("❌ Schema drift detected between supabase/schema.sql and the remote database.");
  if (diffResult.stdout) {
    console.error(diffResult.stdout);
  }
  process.exit(1);
}

console.log("✅ No schema drift detected.");
