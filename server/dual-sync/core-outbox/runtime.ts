import { processCoreOutbox } from './processor';
import { createSupabaseCoreOutboxPorts } from './supabase-port';

import type { CoreOutboxCensus, ProcessCoreOutboxResult } from './types';

export async function runDefaultCoreOutbox(input: {
  readonly workerId: string;
  readonly maxJobs: number;
}): Promise<ProcessCoreOutboxResult> {
  return processCoreOutbox({ ports: createSupabaseCoreOutboxPorts(), ...input });
}

export async function censusDefaultCoreOutbox(input: {
  readonly limit: number;
}): Promise<CoreOutboxCensus> {
  return createSupabaseCoreOutboxPorts().census(input.limit);
}
