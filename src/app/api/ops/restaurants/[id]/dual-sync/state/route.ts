/**
 * Phase 3b of the unified dual-sync engine.
 *
 * GET /api/ops/restaurants/{id}/dual-sync/state
 *
 * Returns the per-field state snapshot needed to render the dual-sync
 * UI shell:
 *  - field state rows                   (drift, conflict, in_sync, ...)
 *  - open outbound candidates            (pending exports)
 *  - canonical Core + Google snapshots   (so the UI shows side-by-side
 *                                         values without an extra round
 *                                         trip)
 *  - registry summary                    (label, helpText, conflict
 *                                         policy, capability flags)
 *
 * The route does *not* trigger a refresh; callers should hit
 * `POST .../dual-sync/refresh` first if they need fresh provider data.
 */

import { NextResponse } from 'next/server';
import { captureServerException } from '@/lib/posthog/server';

import {
  ensureRestaurantAdminAccess,
  resolveRestaurantId,
} from '@/app/api/ops/restaurants/[id]/_shared';
import { dualSyncErrorResponse } from '@/app/api/ops/restaurants/[id]/dual-sync/_shared';
import { getDualSyncRestaurantControl } from '@/server/dual-sync/controls';
import {
  getDualSyncDecisionDisabledReason,
  getDualSyncRuntimeFlags,
} from '@/server/dual-sync/flag';
import { hashCanonicalJson } from '@/server/dual-sync/hashing';
import { listOpenOutboundCandidates } from '@/server/dual-sync/outbound/candidates';
import { buildRegistry, resolveFieldCapability } from '@/server/dual-sync/registry';
import { readGoogleSnapshot } from '@/server/dual-sync/snapshots/google';
import { readNabatableSnapshot } from '@/server/dual-sync/snapshots/nabatable';
import { readLatestSucceededRun } from '@/server/dual-sync/snapshots/runs';
import { listFieldStates } from '@/server/dual-sync/state/read';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string | string[] }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return dualSyncErrorResponse('Missing restaurant id', 400);
  }
  const access = await ensureRestaurantAdminAccess(restaurantId, 'dual-sync-state');
  if (access instanceof NextResponse) return access;

  try {
    const client = getServiceSupabaseClient();
    const [coreSnapshot, gbpSnapshot] = await Promise.all([
      readNabatableSnapshot({ client, restaurantId }),
      readGoogleSnapshot({ client, restaurantId }),
    ]);

    const registry = buildRegistry({
      coreSnapshot,
      gbpSnapshot,
      includeCoreOnly: true,
    });
    const runtimeFlags = getDualSyncRuntimeFlags({ restaurantId });

    const [fieldStates, openCandidates, latestSnapshotRun] = await Promise.all([
      listFieldStates({ client, restaurantId }),
      listOpenOutboundCandidates({ client, restaurantId }),
      readLatestSucceededRun({ client, restaurantId }),
    ]);
    const control = await getDualSyncRestaurantControl({ client, restaurantId });
    const stateByKey = new Map(fieldStates.map((row) => [row.fieldKey, row]));
    const candidateByKey = new Map(openCandidates.map((row) => [row.fieldKey, row]));
    const configByKey = new Map(registry.map((config) => [config.fieldKey, config]));

    const registrySummary = registry.map((config) => {
      const sectionValueCore = readSectionValue(coreSnapshot, config.sectionKey);
      const sectionValueGbp = readSectionValue(gbpSnapshot, config.sectionKey);
      const coreValue =
        config.kind === 'profile'
          ? ((sectionValueCore as Record<string, unknown> | null)?.[
              config.fieldKey.split('.')[1] ?? ''
            ] ?? null)
          : sectionValueCore;
      const gbpValue =
        config.kind === 'profile'
          ? ((sectionValueGbp as Record<string, unknown> | null)?.[
              config.fieldKey.split('.')[1] ?? ''
            ] ?? null)
          : config.kind === 'core_only'
            ? null
            : sectionValueGbp;

      const baseCapability = resolveFieldCapability({ config, coreValue, gbpValue });
      const importDisabledReason = getDualSyncDecisionDisabledReason(
        {
          action: 'import_from_google',
          sectionKey: config.sectionKey,
          riskLevel: config.policy.riskLevel,
          requiresManualReview: config.policy.requiresManualReview,
        },
        runtimeFlags,
      );
      const exportDisabledReason = getDualSyncDecisionDisabledReason(
        {
          action: 'export_to_google',
          sectionKey: config.sectionKey,
          riskLevel: config.policy.riskLevel,
          requiresManualReview: config.policy.requiresManualReview,
        },
        runtimeFlags,
      );
      const capability = {
        ...baseCapability,
        canImport: baseCapability.canImport && importDisabledReason === null,
        canExport: baseCapability.canExport && exportDisabledReason === null,
        blockedReasons: [
          ...baseCapability.blockedReasons,
          ...(importDisabledReason ? [importDisabledReason] : []),
          ...(exportDisabledReason && exportDisabledReason !== importDisabledReason
            ? [exportDisabledReason]
            : []),
        ],
      };
      const stateRow = stateByKey.get(config.fieldKey) ?? null;
      const candidate = candidateByKey.get(config.fieldKey) ?? null;
      const coreCanonical = config.canonicalizeCoreValue(coreValue);
      const gbpCanonical = config.canonicalizeGbpValue(gbpValue);
      const coreCanonicalHash = hashCanonicalJson(coreCanonical);
      const gbpCanonicalHash = hashCanonicalJson(gbpCanonical);

      return {
        fieldKey: config.fieldKey,
        sectionKey: config.sectionKey,
        kind: config.kind,
        label: config.label,
        helpText: config.helpText ?? null,
        conflictPolicy: config.conflictPolicy,
        deletePolicy: config.deletePolicy,
        policy: config.policy,
        importable: config.importable,
        exportable: config.exportable,
        sortOrder: config.sortOrder,
        coreValue: config.normalizeCoreValue(coreValue),
        gbpValue: config.normalizeGbpValue(gbpValue),
        coreCanonicalHash,
        gbpCanonicalHash,
        capability,
        state: stateRow?.state ?? null,
        lastInSyncAt: stateRow?.lastInSyncAt ?? null,
        lastInSyncHash: stateRow?.lastInSyncHash ?? null,
        lastCoreChangeAt: stateRow?.lastCoreChangeAt ?? null,
        lastGbpChangeAt: stateRow?.lastGbpChangeAt ?? null,
        openCandidate: candidate
          ? {
              id: candidate.id,
              proposedValue: candidate.proposedValue,
              proposedValueHash: candidate.proposedValueHash,
              source: candidate.source,
              createdAt: candidate.createdAt,
              updatedAt: candidate.updatedAt,
            }
          : null,
      };
    });

    const outboundQueue = {
      totalOpen: openCandidates.length,
      autoExportable: openCandidates.filter((candidate) => {
        const config = configByKey.get(candidate.fieldKey);
        return Boolean(
          candidate.baselineGbpHash &&
          runtimeFlags.autoCandidatesEnabled &&
          runtimeFlags.exportEnabled &&
          config?.policy.exportable &&
          !config.policy.requiresManualReview &&
          config.policy.googleWriteGroup,
        );
      }).length,
      missingBaseline: openCandidates.filter((c) => !c.baselineGbpHash).length,
      lastQueuedAt: openCandidates.reduce<string | null>((acc, c) => {
        if (!c.updatedAt) return acc;
        if (!acc) return c.updatedAt;
        return c.updatedAt > acc ? c.updatedAt : acc;
      }, null),
    } as const;

    const lastSnapshot = latestSnapshotRun
      ? {
          runId: latestSnapshotRun.id,
          runKind: latestSnapshotRun.runKind,
          startedAt: latestSnapshotRun.startedAt,
          finishedAt: latestSnapshotRun.finishedAt,
        }
      : null;

    return NextResponse.json(
      {
        restaurantId,
        coreSnapshot,
        gbpSnapshot,
        coreSnapshotHash: hashCanonicalJson(coreSnapshot),
        gbpSnapshotHash: hashCanonicalJson(gbpSnapshot),
        fields: registrySummary,
        outboundQueue,
        lastSnapshot,
        control,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load dual-sync state';
    captureServerException(error, {
      distinctId: access.userId,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'dual-sync-state' },
    });
    return dualSyncErrorResponse(message, 500, 'DUAL_SYNC_STATE_ERROR');
  }
}

function readSectionValue(snapshot: DualSyncCanonicalSnapshot, sectionKey: string): unknown {
  switch (sectionKey) {
    case 'profile':
      return snapshot.profile;
    case 'operatingHours':
      return snapshot.operatingHours;
    case 'servicePeriods':
      return snapshot.servicePeriods;
    case 'businessContext.categories':
      return snapshot.businessContext.categories;
    case 'businessContext.serviceAreas':
      return snapshot.businessContext.serviceAreas;
    case 'businessContext.attributes':
      return snapshot.businessContext.attributes;
    case 'businessContext.serviceItems':
      return snapshot.businessContext.serviceItems;
    case 'foodMenus':
      return snapshot.foodMenus ?? { items: [] };
    case 'core_only':
      return null;
    default:
      return null;
  }
}

export const runtime = 'nodejs';
