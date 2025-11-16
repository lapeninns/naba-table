import { runAllocationsPruner } from "@/server/jobs/allocations-pruner";
import { getServiceSupabaseClient } from "@/server/supabase";

async function main(): Promise<void> {
  const client = getServiceSupabaseClient();
  await runAllocationsPruner({ client });
}

main().catch((error) => {
  console.error("[jobs:allocations-pruner] fatal", error);
  process.exitCode = 1;
});
