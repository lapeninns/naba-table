import { clearAllDemandProfileCaches } from "./demand-profiles";
import { clearScarcityCache } from "./scarcity";
import { invalidateStrategicConfigCache } from "./strategic-config";

/**
 * Clears all in-memory caches used by strategic scoring (scarcity + demand profiles).
 * Invoke after updating configuration files or Supabase data to ensure the planner
 * observes new weights without a process restart.
 */
export function clearStrategicCaches(): void {
  clearScarcityCache();
  clearAllDemandProfileCaches();
  invalidateStrategicConfigCache();
}
