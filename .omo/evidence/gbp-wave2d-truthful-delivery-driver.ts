import { deliverClaimedGoogleWriteNotices } from '../../server/dual-sync/notifications/terminal';

import type { DualSyncNotificationEvent } from '../../server/dual-sync/notifications/types';

const notice = {
  noticeId: 'notice-1',
  restaurantId: 'restaurant-1',
  grantId: 'grant-1',
  leaseToken: 'lease-1',
  terminalKind: 'consumed' as const,
  safeReasonCode: 'provider_succeeded',
  terminalAt: '2026-08-09T10:00:00.000Z',
};

type StoreStatus = 'pending' | 'claimed' | 'dispatched' | 'outcome_unknown';
let status: StoreStatus = 'pending';
let transportCalls = 0;
const transitions: string[] = [];

const persistence = {
  async recoverDispatched() {
    if (status !== 'dispatched') return 0;
    status = 'outcome_unknown';
    transitions.push('dispatched->outcome_unknown');
    return 1;
  },
  async claim() {
    if (status !== 'pending') return [];
    status = 'claimed';
    transitions.push('pending->claimed');
    return [notice];
  },
  async dispatch(input: { readonly dispatchKey: string }) {
    if (status !== 'claimed') throw new Error('invalid dispatch state');
    status = 'dispatched';
    transitions.push(`claimed->dispatched:${input.dispatchKey}`);
  },
  async finalize() {
    throw new Error('simulated finalize outage after confirmed external call');
  },
};

const notification = {
  async emit(_event: DualSyncNotificationEvent) {
    if (status !== 'dispatched') throw new Error('external call occurred before durable dispatch');
    transportCalls += 1;
    return { outcome: 'confirmed_success' as const };
  },
};

async function main(): Promise<void> {
  let finalizeFailureObserved = false;
  try {
    await deliverClaimedGoogleWriteNotices({
      persistence,
      notification,
      workerId: 'worker-1',
      now: '2026-08-09T10:01:00.000Z',
    });
  } catch (error) {
    finalizeFailureObserved =
      error instanceof Error && error.message.includes('simulated finalize outage');
  }

  const recovery = await deliverClaimedGoogleWriteNotices({
    persistence,
    notification,
    workerId: 'worker-2',
    now: '2026-08-09T10:03:00.000Z',
  });

  const result = {
    scenario: 'durable-dispatch-confirmed-call-finalize-failure-recovery',
    finalizeFailureObserved,
    transportCalls,
    finalStatus: status,
    transitions,
    recovery,
  };
  if (
    !finalizeFailureObserved ||
    transportCalls !== 1 ||
    status !== 'outcome_unknown' ||
    recovery.outcomeUnknown !== 1 ||
    recovery.claimed !== 0
  ) {
    throw new Error(`truthful delivery scenario failed: ${JSON.stringify(result)}`);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main();
