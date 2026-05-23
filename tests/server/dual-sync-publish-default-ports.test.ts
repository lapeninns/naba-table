import { describe, expect, it } from 'vitest';

import { defaultDualSyncPorts } from '@/server/dual-sync/publish/ports';

import type {
  DualSyncBatchExportContext,
  DualSyncOperationContext,
} from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = {} as SupabaseClient<Database>;
const snapshot = {} as DualSyncCanonicalSnapshot;

function operationContext(fieldKey: string): DualSyncOperationContext {
  return {
    client,
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    decision: {
      fieldKey,
      sectionKey: 'profile',
      action: 'export_to_google',
      pinnedCoreHash: null,
      pinnedGbpHash: null,
    },
    coreSnapshot: snapshot,
    gbpSnapshot: snapshot,
    actorUserId: 'user-1',
  };
}

function batchContext(
  sectionKey: DualSyncBatchExportContext['sectionKey'],
): DualSyncBatchExportContext {
  return {
    client,
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    sectionKey,
    decisions: [],
    coreSnapshot: snapshot,
    gbpSnapshot: snapshot,
    actorUserId: 'user-1',
  };
}

describe('defaultDualSyncPorts', () => {
  it('fails closed for unknown import and export field routes', async () => {
    const ports = defaultDualSyncPorts();

    await expect(ports.applyImportToCore(operationContext('unknown.field'))).resolves.toEqual({
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: 'Import port for unknown.field is not implemented yet.',
        retryable: false,
      },
    });
    await expect(ports.applyExportToGoogle(operationContext('unknown.field'))).resolves.toEqual({
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: 'Export port for unknown.field is not implemented yet.',
        retryable: false,
      },
    });
  });

  it('reports unsupported batch sections without running a concrete port', async () => {
    const ports = defaultDualSyncPorts();

    await expect(
      ports.applyExportBatchToGoogle?.(
        batchContext('businessContext' as DualSyncBatchExportContext['sectionKey']),
      ),
    ).resolves.toEqual({ supported: false });
  });
});
