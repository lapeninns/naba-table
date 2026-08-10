import { coreOutboxEntrySchema } from './types';

import type { CoreOutboxEntry } from './types';

export interface CoreOutboxReconciliationProbe {
  readonly entry: CoreOutboxEntry;
  readonly hasOutstandingOutbox: boolean;
  readonly hasMatchingCandidateOrState: boolean;
}

export interface CoreOutboxReconciliationPorts {
  readonly census: (limit: number) => Promise<readonly unknown[]>;
  readonly repairMissing: (entries: readonly CoreOutboxEntry[]) => Promise<readonly string[]>;
}

export interface CoreOutboxReconciliationResult {
  readonly inspected: number;
  readonly missing: number;
  readonly repaired: number;
  readonly missingIds: readonly string[];
  readonly repairedIds: readonly string[];
}

export async function reconcileCoreOutbox(input: {
  readonly ports: CoreOutboxReconciliationPorts;
  readonly limit?: number;
  readonly repair?: boolean;
}): Promise<CoreOutboxReconciliationResult> {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
  const raw = await input.ports.census(limit);
  const probes = raw.map((value) => {
    if (typeof value !== 'object' || value === null) {
      throw new TypeError('invalid_core_outbox_reconciliation_probe');
    }
    const outstanding = Reflect.get(value, 'hasOutstandingOutbox');
    const present = Reflect.get(value, 'hasMatchingCandidateOrState');
    const entry = coreOutboxEntrySchema.parse(Reflect.get(value, 'entry'));
    if (typeof outstanding !== 'boolean' || typeof present !== 'boolean') {
      throw new TypeError('invalid_core_outbox_reconciliation_probe');
    }
    return { entry, hasOutstandingOutbox: outstanding, hasMatchingCandidateOrState: present };
  });
  const missing = probes
    .filter((probe) => !probe.hasOutstandingOutbox && !probe.hasMatchingCandidateOrState)
    .map((probe) => probe.entry);
  const repairedIds = input.repair === true ? await input.ports.repairMissing(missing) : [];
  return {
    inspected: probes.length,
    missing: missing.length,
    repaired: repairedIds.length,
    missingIds: missing.map((entry) => entry.id),
    repairedIds,
  };
}
