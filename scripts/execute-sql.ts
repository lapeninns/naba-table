import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing SUPABASE_DB_URL or DATABASE_URL. Set it before running this script.");
  process.exit(1);
}

const modulePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(modulePath);
const sqlPath = path.resolve(scriptDir, "..", "generate_bookings.sql");

async function runSql() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    console.log("Connected to database");

    const sql = fs.readFileSync(sqlPath, "utf8");
    await client.query(sql);
    console.log("SQL executed successfully");
  } catch (err) {
    console.error("Error executing SQL:", err);
  } finally {
    await client.end();
  }
}

runSql();
