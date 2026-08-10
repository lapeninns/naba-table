import {
  processCoreOutbox,
  type CoreOutboxEntry,
  type CoreOutboxPorts,
} from '../../server/dual-sync/core-outbox';

const hash = (character: string) => character.repeat(64);
const tenantA = '00000000-0000-4000-8000-000000000010';
const tenantB = '00000000-0000-4000-8000-000000000020';
const base: CoreOutboxEntry = {
  id: '00000000-0000-4000-8000-000000000001',
  restaurantId: tenantA,
  sourceTable: 'restaurant_service_periods',
  sourceRowId: '00000000-0000-4000-8000-000000000100',
  operation: 'UPDATE',
  changedColumns: ['service_periods'],
  beforeHash: hash('a'),
  afterHash: hash('b'),
  idempotencyHash: hash('c'),
  attemptCount: 1,
  leaseToken: '00000000-0000-4000-8000-000000000900',
};
const second: CoreOutboxEntry = {
  ...base,
  id: '00000000-0000-4000-8000-000000000002',
  restaurantId: tenantB,
  sourceRowId: '00000000-0000-4000-8000-000000000200',
};
const completed = new Set<string>();
const candidates = new Set<string>();
let rows: readonly CoreOutboxEntry[] = [base, second];
let crashTenant = tenantB;

const ports: CoreOutboxPorts = {
  claim: async () => rows.filter((entry) => !completed.has(entry.id)),
  complete: async (entries) => {
    for (const entry of entries) completed.add(entry.id);
  },
  retry: async () => ({ deadLetterIds: [] }),
  isProviderOrigin: async () => false,
  discoverCandidates: async ({ restaurantId, fieldKeys }) => {
    for (const fieldKey of fieldKeys) candidates.add(`${restaurantId}:${fieldKey}`);
    if (restaurantId === crashTenant) throw new TypeError('simulated_crash');
    return fieldKeys;
  },
  notifyDeadLetters: async () => undefined,
};

async function main(): Promise<void> {
  const firstRun = await processCoreOutbox({
    ports,
    workerId: 'manual-worker-1',
    maxJobs: 10,
  });
  crashTenant = '';
  rows = [second, { ...base, id: '00000000-0000-4000-8000-000000000003' }];
  const reclaimRun = await processCoreOutbox({
    ports,
    workerId: 'manual-worker-2',
    maxJobs: 10,
  });

  process.stdout.write(
    `${JSON.stringify({
      scenario: 'core_change_claim_recompute_complete_crash_reclaim_duplicate_tenant_isolation',
      firstRun,
      reclaimRun,
      completedIds: [...completed].sort(),
      candidateKeys: [...candidates].sort(),
      providerCalls: 0,
      contentFieldsPresent: false,
    })}\n`,
  );
}

void main();
