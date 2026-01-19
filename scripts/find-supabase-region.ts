
import { Client } from "pg";

const regions = ["eu-west-2", "eu-west-1", "eu-central-1", "us-east-1", "us-west-2", "ap-southeast-1"];
const projectRef = "rrpeokmfbtbrirqjprpe";
const password = process.argv[2];

async function findRegion() {
    if (!password) {
        console.error("Missing password");
        process.exit(1);
    }

    for (const region of regions) {
        console.log(`Checking region: ${region}...`);
        const client = new Client({
            connectionString: `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
            connectionTimeoutMillis: 5000,
            ssl: { rejectUnauthorized: false }
        });

        try {
            await client.connect();
            console.log(`✅ FOUND! Project is in region: ${region}`);
            await client.end();
            process.exit(0);
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes("Tenant or user not found")) {
                console.log(`   ❌ Not in ${region}`);
            } else {
                console.log(`   ⚠️  Error in ${region}: ${err instanceof Error ? err.message : String(err)}`);
            }
        } finally {
            await client.end().catch(() => { });
        }
    }
}

findRegion();
