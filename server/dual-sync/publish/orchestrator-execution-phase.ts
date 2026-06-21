import { updatePublishBatchStatus } from './operations';
import { runBatchExportPorts } from './orchestrator-batch-export';
import { executePreparedPublishOperations } from './orchestrator-execute-operations';
import { finalizePublish } from './orchestrator-finalize';
import { runRequiredExportPreflights } from './orchestrator-preflight';
import { preparePublishDecisions } from './orchestrator-prepare-decisions';

import type { DualSyncGoogleEditThrottle } from './google-safety';
import type { DualSyncOrchestratorPorts } from './ports';
import type {
  DualSyncPublishJobSummary,
  DualSyncPublishPlan,
  DualSyncRunPublishInput,
} from './types';
import type { buildRegistry } from '../registry';
import type { DualSyncRuntimeControls } from '../runtime-controls';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { DualSyncPublishBatch, DualSyncPublishOperationGroup } from '../types';
import type { DualSyncExportPreflightPort } from './preflight';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type ReadSnapshot = (input: {
  readonly client: DbClient;
  readonly restaurantId: string;
}) => Promise<DualSyncCanonicalSnapshot>;

interface RunPublishExecutionPhaseInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishBatch: DualSyncPublishBatch;
  readonly publishJobId: string;
  readonly input: DualSyncRunPublishInput;
  readonly plan: DualSyncPublishPlan;
  readonly operationGroups: ReadonlyArray<DualSyncPublishOperationGroup>;
  readonly operationGroupIdByKey: ReadonlyMap<string, string>;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly registry: ReturnType<typeof buildRegistry>;
  readonly runtimeControls: DualSyncRuntimeControls;
  readonly ports: DualSyncOrchestratorPorts;
  readonly exportPreflight: DualSyncExportPreflightPort;
  readonly googleEditThrottle?: DualSyncGoogleEditThrottle;
  readonly readCoreSnapshot: ReadSnapshot;
  readonly readGbpSnapshot: ReadSnapshot;
}

export async function runPublishExecutionPhase(input: RunPublishExecutionPhaseInput): Promise<{
  readonly summary: DualSyncPublishJobSummary;
}> {
  const preflightFailures = await runRequiredExportPreflights({
    client: input.client,
    restaurantId: input.restaurantId,
    publishBatchId: input.publishBatch.id,
    actorUserId: input.input.actorUserId,
    planGroups: input.plan.groups,
    operationGroupIdByKey: input.operationGroupIdByKey,
    coreSnapshot: input.coreSnapshot,
    gbpSnapshot: input.gbpSnapshot,
    exportPreflight: input.exportPreflight,
  });

  await updatePublishBatchStatus({
    client: input.client,
    publishBatchId: input.publishBatch.id,
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  const { prepared, failures } = await preparePublishDecisions({
    client: input.client,
    restaurantId: input.restaurantId,
    publishJobId: input.publishJobId,
    publishBatchId: input.publishBatch.id,
    decisions: input.input.decisions,
    registry: input.registry,
    coreSnapshot: input.coreSnapshot,
    gbpSnapshot: input.gbpSnapshot,
    preflightFailures,
    operationGroupIdByKey: input.operationGroupIdByKey,
    runtimeControls: input.runtimeControls,
    actorUserId: input.input.actorUserId,
  });

  const prebuiltResults = await runBatchExportPorts({
    ports: input.ports,
    decisions: prepared
      .filter((item) => item.direction === 'export_to_google')
      .map((item) => item.decision),
    coreSnapshot: input.coreSnapshot,
    gbpSnapshot: input.gbpSnapshot,
    registry: input.registry,
    client: input.client,
    publishJobId: input.publishJobId,
    restaurantId: input.restaurantId,
    actorUserId: input.input.actorUserId,
    googleEditThrottle: input.googleEditThrottle,
  });

  const executed = await executePreparedPublishOperations({
    client: input.client,
    restaurantId: input.restaurantId,
    publishJobId: input.publishJobId,
    publishBatchId: input.publishBatch.id,
    actorUserId: input.input.actorUserId,
    prepared,
    prebuiltResults,
    ports: input.ports,
    coreSnapshot: input.coreSnapshot,
    gbpSnapshot: input.gbpSnapshot,
    googleEditThrottle: input.googleEditThrottle,
    failures,
  });

  return finalizePublish({
    client: input.client,
    restaurantId: input.restaurantId,
    publishJobId: input.publishJobId,
    publishBatchId: input.publishBatch.id,
    input: input.input,
    operationGroups: input.operationGroups,
    failures: executed.failures,
    readCoreSnapshot: input.readCoreSnapshot,
    readGbpSnapshot: input.readGbpSnapshot,
  });
}
