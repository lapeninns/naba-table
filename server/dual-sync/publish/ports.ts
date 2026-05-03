/**
 * Phases 3 & 3b of the unified dual-sync engine.
 *
 * Orchestrator ports. The orchestrator is provider-agnostic at the
 * boundary. `NOOP_PORTS` fail closed so that mis-wired callers never
 * silently mutate state. `defaultDualSyncPorts` wires concrete
 * per-section ports (Phase 3b: profile imports; Phase 3c will add
 * operating hours, service periods, business context, and exports).
 */

import {
  applyBusinessContextAttributeExportBatchToGoogle,
  applyBusinessContextAttributeExportToGoogle,
  applyBusinessContextCategoryExportBatchToGoogle,
  applyBusinessContextCategoryExportToGoogle,
  applyBusinessContextServiceAreaExportBatchToGoogle,
  applyBusinessContextServiceAreaExportToGoogle,
  applyBusinessContextServiceItemExportBatchToGoogle,
  applyBusinessContextServiceItemExportToGoogle,
} from './ports/business-context-export';
import {
  applyBusinessContextAttributeImportToCore,
  applyBusinessContextCategoryImportToCore,
  applyBusinessContextServiceAreaImportToCore,
  applyBusinessContextServiceItemImportToCore,
} from './ports/business-context-import';
import {
  applyFoodMenusExportBatchToGoogle,
  applyFoodMenusExportToGoogle,
} from './ports/food-menus-export';
import {
  applyOperatingHoursExportBatchToGoogle,
  applyOperatingHoursExportToGoogle,
} from './ports/operating-hours-export';
import { applyOperatingHoursImportToCore } from './ports/operating-hours-import';
import {
  applyProfileExportBatchToGoogle,
  applyProfileExportToGoogle,
} from './ports/profile-export';
import { applyProfileImportToCore } from './ports/profile-import';
import {
  applyServicePeriodsExportBatchToGoogle,
  applyServicePeriodsExportToGoogle,
} from './ports/service-periods-export';
import { applyServicePeriodsImportToCore } from './ports/service-periods-import';

import type {
  DualSyncBatchExportContext,
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationResult,
} from './types';

export interface DualSyncOrchestratorPorts {
  /**
   * Apply one import (`Google -> Core`) operation. Implementations should
   * write the canonical Google value into Core for the field referenced
   * by the decision and return the resulting hash diagnostics. Returning
   * `failure` switches the operation to `failed` and surfaces in the
   * job summary.
   */
  readonly applyImportToCore: (ctx: DualSyncOperationContext) => Promise<DualSyncOperationResult>;

  /**
   * Apply one export (`Core -> Google`) operation. Implementations should
   * call the appropriate GBP API patch with the registry-defined update
   * mask and return any external response payload for the audit log.
   */
  readonly applyExportToGoogle: (ctx: DualSyncOperationContext) => Promise<DualSyncOperationResult>;

  /**
   * Optional section-level batch entrypoint. The orchestrator groups
   * consecutive `export_to_google` decisions sharing a `sectionKey` and
   * offers them as a single call. Implementations may return
   * `{ supported: false }` to opt out; the orchestrator then falls back
   * to per-field dispatch for that group.
   */
  readonly applyExportBatchToGoogle?: (
    ctx: DualSyncBatchExportContext,
  ) => Promise<DualSyncBatchExportResult>;
}

/**
 * Default ports used when callers do not inject custom implementations.
 * Both directions return a `failed` result with code `PORT_FAILURE` so
 * that callers must opt into Phase 3b's concrete wiring before publishes
 * actually mutate state. This guards against accidental write paths
 * during the Phase 3a rollout.
 */
export const NOOP_PORTS: DualSyncOrchestratorPorts = {
  applyImportToCore: async (): Promise<DualSyncOperationResult> => ({
    status: 'failed',
    failure: {
      code: 'PORT_FAILURE',
      message:
        'No applyImportToCore port wired. Inject a concrete port to perform import publishes.',
      retryable: false,
    },
  }),
  applyExportToGoogle: async (): Promise<DualSyncOperationResult> => ({
    status: 'failed',
    failure: {
      code: 'PORT_FAILURE',
      message:
        'No applyExportToGoogle port wired. Inject a concrete port to perform export publishes.',
      retryable: false,
    },
  }),
};

const PROFILE_FIELD_KEY_PREFIX = 'profile.';
const OPERATING_HOURS_FIELD_KEY_PREFIX = 'operatingHours.weekly.';
const SERVICE_PERIODS_FIELD_KEY_PREFIX = 'servicePeriods.';
const BUSINESS_CONTEXT_CATEGORY_PREFIX = 'businessContext.categories.';
const BUSINESS_CONTEXT_SERVICE_AREA_PREFIX = 'businessContext.serviceAreas.';
const BUSINESS_CONTEXT_ATTRIBUTE_PREFIX = 'businessContext.attributes.';
const BUSINESS_CONTEXT_SERVICE_ITEM_PREFIX = 'businessContext.serviceItems.';
const FOOD_MENUS_PREFIX = 'foodMenus.items.';

function unimplementedPortResult(
  ctx: DualSyncOperationContext,
  direction: 'import' | 'export',
): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'PORT_FAILURE',
      message: `${direction === 'import' ? 'Import' : 'Export'} port for ${ctx.decision.fieldKey} is not implemented yet.`,
      retryable: false,
    },
  };
}

/**
 * Compose the concrete-port set used by the dual-sync HTTP routes.
 * Sections without a concrete port yet return a `PORT_FAILURE` result
 * so the orchestrator surfaces a precise "not implemented" error rather
 * than silently mutating state.
 */
export function defaultDualSyncPorts(): DualSyncOrchestratorPorts {
  return {
    applyImportToCore: async (ctx) => {
      const { fieldKey } = ctx.decision;
      if (fieldKey.startsWith(PROFILE_FIELD_KEY_PREFIX)) {
        return applyProfileImportToCore(ctx);
      }
      if (fieldKey.startsWith(OPERATING_HOURS_FIELD_KEY_PREFIX)) {
        return applyOperatingHoursImportToCore(ctx);
      }
      if (fieldKey.startsWith(SERVICE_PERIODS_FIELD_KEY_PREFIX)) {
        return applyServicePeriodsImportToCore(ctx);
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_CATEGORY_PREFIX)) {
        return applyBusinessContextCategoryImportToCore(ctx);
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_SERVICE_AREA_PREFIX)) {
        return applyBusinessContextServiceAreaImportToCore(ctx);
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_ATTRIBUTE_PREFIX)) {
        return applyBusinessContextAttributeImportToCore(ctx);
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_SERVICE_ITEM_PREFIX)) {
        return applyBusinessContextServiceItemImportToCore(ctx);
      }
      return unimplementedPortResult(ctx, 'import');
    },
    applyExportToGoogle: async (ctx) => {
      const { fieldKey } = ctx.decision;
      if (fieldKey.startsWith(PROFILE_FIELD_KEY_PREFIX)) {
        return applyProfileExportToGoogle(ctx);
      }
      if (fieldKey.startsWith(OPERATING_HOURS_FIELD_KEY_PREFIX)) {
        return applyOperatingHoursExportToGoogle(ctx);
      }
      if (fieldKey.startsWith(SERVICE_PERIODS_FIELD_KEY_PREFIX)) {
        return applyServicePeriodsExportToGoogle(ctx);
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_CATEGORY_PREFIX)) {
        return applyBusinessContextCategoryExportToGoogle(ctx);
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_SERVICE_AREA_PREFIX)) {
        return applyBusinessContextServiceAreaExportToGoogle(ctx);
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_ATTRIBUTE_PREFIX)) {
        return applyBusinessContextAttributeExportToGoogle(ctx);
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_SERVICE_ITEM_PREFIX)) {
        return applyBusinessContextServiceItemExportToGoogle(ctx);
      }
      if (fieldKey.startsWith(FOOD_MENUS_PREFIX)) {
        return applyFoodMenusExportToGoogle(ctx);
      }
      return unimplementedPortResult(ctx, 'export');
    },
    applyExportBatchToGoogle: async (ctx) => {
      switch (ctx.sectionKey) {
        case 'profile':
          return applyProfileExportBatchToGoogle(ctx);
        case 'operatingHours':
          return applyOperatingHoursExportBatchToGoogle(ctx);
        case 'servicePeriods':
          return applyServicePeriodsExportBatchToGoogle(ctx);
        case 'businessContext.categories':
          return applyBusinessContextCategoryExportBatchToGoogle(ctx);
        case 'businessContext.serviceAreas':
          return applyBusinessContextServiceAreaExportBatchToGoogle(ctx);
        case 'businessContext.attributes':
          return applyBusinessContextAttributeExportBatchToGoogle(ctx);
        case 'businessContext.serviceItems':
          return applyBusinessContextServiceItemExportBatchToGoogle(ctx);
        case 'foodMenus':
          return applyFoodMenusExportBatchToGoogle(ctx);
        default:
          return { supported: false };
      }
    },
  };
}

export {
  applyBusinessContextAttributeExportBatchToGoogle,
  applyBusinessContextAttributeExportToGoogle,
  applyBusinessContextAttributeImportToCore,
  applyBusinessContextCategoryExportBatchToGoogle,
  applyBusinessContextCategoryExportToGoogle,
  applyBusinessContextCategoryImportToCore,
  applyBusinessContextServiceAreaExportBatchToGoogle,
  applyBusinessContextServiceAreaExportToGoogle,
  applyBusinessContextServiceAreaImportToCore,
  applyBusinessContextServiceItemExportBatchToGoogle,
  applyBusinessContextServiceItemExportToGoogle,
  applyBusinessContextServiceItemImportToCore,
  applyFoodMenusExportBatchToGoogle,
  applyFoodMenusExportToGoogle,
  applyOperatingHoursExportBatchToGoogle,
  applyOperatingHoursExportToGoogle,
  applyOperatingHoursImportToCore,
  applyProfileExportBatchToGoogle,
  applyProfileExportToGoogle,
  applyProfileImportToCore,
  applyServicePeriodsExportBatchToGoogle,
  applyServicePeriodsExportToGoogle,
  applyServicePeriodsImportToCore,
};
