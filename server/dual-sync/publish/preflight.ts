/**
 * Export preflight contract for publish operation groups.
 *
 * Concrete Google write helpers still perform provider-level
 * `validateOnly` immediately before a write where Google exposes that
 * flag. This layer gives the dual-sync batch audit a durable,
 * fail-closed preflight decision point before operation rows are opened
 * or provider ports are called.
 */

import type { DualSyncOperationFailure, DualSyncPublishGroup } from './types';
import type { DualSyncCanonicalSnapshot } from '../snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DualSyncExportPreflightContext {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly publishBatchId: string;
  readonly group: DualSyncPublishGroup;
  readonly coreSnapshot: DualSyncCanonicalSnapshot;
  readonly gbpSnapshot: DualSyncCanonicalSnapshot;
  readonly actorUserId: string | null;
}

export type DualSyncExportPreflightResult =
  | {
      readonly status: 'passed' | 'skipped';
      readonly result?: unknown;
    }
  | {
      readonly status: 'failed';
      readonly failure: DualSyncOperationFailure;
      readonly result?: unknown;
    };

export type DualSyncExportPreflightPort = (
  ctx: DualSyncExportPreflightContext,
) => Promise<DualSyncExportPreflightResult>;

function googlePreflightStrategy(group: DualSyncPublishGroup) {
  switch (group.writeGroup) {
    case 'location.attributes':
      return {
        providerValidateOnly: 'unsupported',
        preflightUnsupported: true,
        maskStrategy: 'attributeMask',
        reason: 'locations.updateAttributes exposes attributeMask but no validateOnly parameter.',
      };
    case 'location.foodMenus':
      return {
        providerValidateOnly: 'unsupported',
        preflightUnsupported: true,
        maskStrategy: 'updateMask',
        reason:
          'accounts.locations.updateFoodMenus exposes updateMask but no validateOnly parameter.',
      };
    default:
      return {
        providerValidateOnly: 'supported',
        preflightUnsupported: false,
        maskStrategy: 'updateMask',
        reason: 'locations.patch supports validateOnly for this write group.',
      };
  }
}

export const defaultDualSyncExportPreflight: DualSyncExportPreflightPort = async ({ group }) => {
  if (group.direction !== 'export_to_google' || !group.requiresPreflight) {
    return {
      status: 'skipped',
      result: { reason: 'preflight_not_required' },
    };
  }

  if (group.googleUpdateMasks.length === 0) {
    return {
      status: 'failed',
      failure: {
        code: 'GOOGLE_VALIDATION_FAILED',
        message: 'Preflight requires at least one Google update mask.',
        retryable: false,
      },
      result: { reason: 'missing_google_update_mask' },
    };
  }

  const strategy = googlePreflightStrategy(group);
  if (group.writeGroup === 'location.foodMenus' && strategy.preflightUnsupported) {
    return {
      status: 'failed',
      failure: {
        code: 'GOOGLE_VALIDATION_FAILED',
        message:
          'FoodMenus replacement exports require a provider-side validation path or alternate baseline contract before writing.',
        retryable: false,
      },
      result: {
        validator: 'dual_sync_export_preflight_contract',
        providerValidateOnly: strategy.providerValidateOnly,
        preflightUnsupported: strategy.preflightUnsupported,
        maskStrategy: strategy.maskStrategy,
        unsupportedReason: strategy.reason,
        googleUpdateMasks: group.googleUpdateMasks,
        destructiveWritePossible: group.destructiveWritePossible,
      },
    };
  }
  return {
    status: 'passed',
    result: {
      validator: 'dual_sync_export_preflight_contract',
      googleValidateOnly:
        strategy.providerValidateOnly === 'supported' ? 'delegated_to_export_port' : 'unsupported',
      providerValidateOnly: strategy.providerValidateOnly,
      preflightUnsupported: strategy.preflightUnsupported,
      maskStrategy: strategy.maskStrategy,
      unsupportedReason: strategy.preflightUnsupported ? strategy.reason : undefined,
      googleUpdateMasks: group.googleUpdateMasks,
      destructiveWritePossible: group.destructiveWritePossible,
    },
  };
};
