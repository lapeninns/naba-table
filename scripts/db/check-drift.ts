import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "../..");
const schemaPath = path.join(projectRoot, "supabase", "schema.sql");

const dbUrl = process.env.DRIFT_CHECK_DB_URL ?? process.env.SUPABASE_DB_URL;

function normalizeSchema(content: string): string {
  return `${content.replace(/\r\n/g, "\n").trimEnd()}\n`;
}

function ensureSchemaFile(): void {
  if (fs.existsSync(schemaPath)) {
    return;
  }
  console.error("Missing supabase/schema.sql.");
  console.error(
    "Generate it with: supabase db dump --linked --file supabase/schema.sql (or supabase db dump --db-url <DB_URL> --file supabase/schema.sql)",
  );
  process.exit(1);
}

function dumpRemoteSchema(outputPath: string): string {
  try {
    const args = dbUrl
      ? ["db", "dump", "--db-url", dbUrl]
      : ["db", "dump", "--linked"];
    const output = execFileSync("supabase", args, { encoding: "utf8" });
    const normalized = normalizeSchema(output);
    fs.writeFileSync(outputPath, normalized, "utf8");
    return normalized;
  } catch (error) {
    console.error("Failed to dump schema via Supabase CLI.");
    if (!dbUrl) {
      console.error("No DRIFT_CHECK_DB_URL/SUPABASE_DB_URL set; tried linked project.");
    }
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

function diffSchemas(expectedPath: string, actualPath: string): string {
  try {
    return execFileSync(
      "git",
      ["diff", "--no-index", "--", expectedPath, actualPath],
      { encoding: "utf8" },
    );
  } catch (error) {
    if (error instanceof Error && "stdout" in error) {
      return String((error as { stdout?: string }).stdout ?? "");
    }
    return "";
  }
}

function run(): void {
  ensureSchemaFile();

  const expected = normalizeSchema(fs.readFileSync(schemaPath, "utf8"));

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "db-drift-"));
  const dumpedPath = path.join(tempDir, "schema.sql");

  try {
    const actual = dumpRemoteSchema(dumpedPath);
    if (actual === expected) {
      console.log("DB drift check passed: schema matches supabase/schema.sql");
      return;
    }

    console.error("DB drift detected: schema differs from supabase/schema.sql");
    const diff = diffSchemas(schemaPath, dumpedPath);
    if (diff.trim().length > 0) {
      console.error(diff);
    }
    process.exitCode = 1;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run();
