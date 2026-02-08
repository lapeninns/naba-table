import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

type Args = {
  sqlPath: string;
  expectedProjectRef: string | null;
};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  pnpm -s tsx scripts/apply-sql-file.ts --file <path> [--expected-ref <projectRef>]",
      "",
      "Env:",
      "  SUPABASE_DB_URL or DATABASE_URL (connection string)",
      "",
      "Notes:",
      "  - Uses pg simple query mode so SQL files may contain multiple statements.",
      "  - Does not print the connection string (avoid leaking secrets).",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  let sqlPath: string | null = null;
  let expectedProjectRef: string | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;

    if (token === "--file") {
      sqlPath = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token.startsWith("--file=")) {
      sqlPath = token.slice("--file=".length);
      continue;
    }
    if (token === "--expected-ref") {
      expectedProjectRef = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token.startsWith("--expected-ref=")) {
      expectedProjectRef = token.slice("--expected-ref=".length);
      continue;
    }
  }

  if (!sqlPath) {
    usage();
  }

  return {
    sqlPath,
    expectedProjectRef,
  };
}

function isSafeExpectedRef(connectionString: string, expectedProjectRef: string): boolean {
  // Support both direct host (db.<ref>.supabase.co) and pooler user (postgres.<ref>@...pooler...).
  const lower = connectionString.toLowerCase();
  const ref = expectedProjectRef.toLowerCase();
  return lower.includes(ref);
}

async function main(): Promise<void> {
  const modulePath = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(modulePath), "..");
  const envLocalPath = path.join(projectRoot, ".env.local");
  if (fs.existsSync(envLocalPath)) {
    loadEnv({ path: envLocalPath, override: false });
  }

  const args = parseArgs(process.argv.slice(2));

  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Missing SUPABASE_DB_URL or DATABASE_URL.");
    process.exit(1);
  }

  if (args.expectedProjectRef && !isSafeExpectedRef(connectionString, args.expectedProjectRef)) {
    console.error(
      `Supabase DB URL does not appear to match expected project ref (${args.expectedProjectRef}). Aborting.`,
    );
    process.exit(1);
  }

  const sqlPath = path.resolve(projectRoot, args.sqlPath);
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  if (!sql.trim()) {
    console.error(`SQL file is empty: ${sqlPath}`);
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();
  try {
    // Use a plain string query so Postgres runs it via the simple query protocol,
    // which supports multi-statement SQL files (BEGIN/COMMIT, DO $$, etc).
    await client.query(sql);
  } finally {
    await client.end();
  }
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[apply-sql-file] Failed: ${message}`);
  process.exit(1);
});
