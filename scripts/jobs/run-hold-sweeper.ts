import { runHoldSweeper } from "@/server/jobs/capacity-holds";
import { getServiceSupabaseClient } from "@/server/supabase";

async function main(): Promise<void> {
  const client = getServiceSupabaseClient();
  await runHoldSweeper({ client });
}

main().catch((error) => {
  console.error("[jobs:hold-sweeper] fatal", error);
  process.exitCode = 1;
});
