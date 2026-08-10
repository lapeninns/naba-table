import { fieldKeysForCoreOutboxEntry } from './mapping';
import { coreOutboxClaimHandleSchema, coreOutboxEntrySchema } from './types';

import type {
  CoreOutboxEntry,
  CoreOutboxClaimHandle,
  CoreOutboxPorts,
  ProcessCoreOutboxResult,
} from './types';

const MAX_BATCH_SIZE = 100;

async function retryRows(input: {
  readonly ports: CoreOutboxPorts;
  readonly entries: readonly CoreOutboxClaimHandle[];
  readonly workerId: string;
  readonly errorCode: 'invalid_outbox_schema' | 'candidate_discovery_failed';
}): Promise<{ readonly retried: number; readonly deadLettered: number }> {
  if (input.entries.length === 0) return { retried: 0, deadLettered: 0 };
  const result = await input.ports.retry(input.entries, input.workerId, input.errorCode);
  if (result.deadLetterIds.length > 0) {
    await input.ports.notifyDeadLetters(result.deadLetterIds, input.errorCode);
  }
  return {
    retried: input.entries.length - result.deadLetterIds.length,
    deadLettered: result.deadLetterIds.length,
  };
}

function groupByRestaurant(
  entries: readonly CoreOutboxEntry[],
): ReadonlyMap<string, CoreOutboxEntry[]> {
  const groups = new Map<string, CoreOutboxEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.restaurantId) ?? [];
    group.push(entry);
    groups.set(entry.restaurantId, group);
  }
  return groups;
}

export async function processCoreOutbox(input: {
  readonly ports: CoreOutboxPorts;
  readonly workerId: string;
  readonly maxJobs?: number;
}): Promise<ProcessCoreOutboxResult> {
  const limit = Math.max(1, Math.min(input.maxJobs ?? 50, MAX_BATCH_SIZE));
  const claimed = await input.ports.claim({ workerId: input.workerId, limit });
  const valid: CoreOutboxEntry[] = [];
  const poisonEntries: CoreOutboxClaimHandle[] = [];

  for (const value of claimed) {
    const parsed = coreOutboxEntrySchema.safeParse(value);
    if (parsed.success) valid.push(parsed.data);
    else {
      const handle = coreOutboxClaimHandleSchema.safeParse(value);
      if (handle.success) poisonEntries.push(handle.data);
    }
  }

  const poison = await retryRows({
    ports: input.ports,
    entries: poisonEntries,
    workerId: input.workerId,
    errorCode: 'invalid_outbox_schema',
  });
  let completed = 0;
  let retried = poison.retried;
  let deadLettered = poison.deadLettered;

  for (const [restaurantId, entries] of groupByRestaurant(valid)) {
    const localEntries: CoreOutboxEntry[] = [];
    const ignoredIds: string[] = [];
    for (const entry of entries) {
      if (await input.ports.isProviderOrigin(entry)) ignoredIds.push(entry.id);
      else localEntries.push(entry);
    }
    if (ignoredIds.length > 0) {
      await input.ports.complete(
        entries.filter((entry) => ignoredIds.includes(entry.id)),
        input.workerId,
      );
      completed += ignoredIds.length;
    }
    if (localEntries.length === 0) continue;

    const ids = localEntries.map((entry) => entry.id);
    const fieldKeys = [
      ...new Set(localEntries.flatMap((entry) => fieldKeysForCoreOutboxEntry(entry))),
    ].sort();
    try {
      await input.ports.discoverCandidates({ restaurantId, fieldKeys });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      const failed = await retryRows({
        ports: input.ports,
        entries: localEntries,
        workerId: input.workerId,
        errorCode: 'candidate_discovery_failed',
      });
      retried += failed.retried;
      deadLettered += failed.deadLettered;
      continue;
    }
    await input.ports.complete(localEntries, input.workerId);
    completed += ids.length;
  }

  return { claimed: claimed.length, completed, retried, deadLettered };
}
