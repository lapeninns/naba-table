import {
  applyBusinessContextAttributeExportBatchToGoogle,
  applyBusinessContextAttributeExportToGoogle,
  applyBusinessContextCategoryExportBatchToGoogle,
  applyBusinessContextCategoryExportToGoogle,
  applyBusinessContextServiceAreaExportBatchToGoogle,
  applyBusinessContextServiceAreaExportToGoogle,
  applyBusinessContextServiceItemExportBatchToGoogle,
  applyBusinessContextServiceItemExportToGoogle,
} from './business-context-export';
import {
  applyFoodMenusExportBatchToGoogle,
  applyFoodMenusExportToGoogle,
} from './food-menus-export';
import {
  applyOperatingHoursExportBatchToGoogle,
  applyOperatingHoursExportToGoogle,
} from './operating-hours-export';
import { applyProfileExportBatchToGoogle, applyProfileExportToGoogle } from './profile-export';
import { applyProfileImportToCore } from './profile-import';
import {
  applyServicePeriodsExportBatchToGoogle,
  applyServicePeriodsExportToGoogle,
} from './service-periods-export';

import type { DualSyncOrchestratorPorts } from '../ports';
import type { DualSyncOperationContext, DualSyncOperationResult } from '../types';

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

function atomicImportRequiredResult(): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'PORT_FAILURE',
      message: 'This Google import requires an atomic provider-fenced database operation.',
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
        return atomicImportRequiredResult();
      }
      if (fieldKey.startsWith(SERVICE_PERIODS_FIELD_KEY_PREFIX)) {
        return atomicImportRequiredResult();
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_CATEGORY_PREFIX)) {
        return atomicImportRequiredResult();
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_SERVICE_AREA_PREFIX)) {
        return atomicImportRequiredResult();
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_ATTRIBUTE_PREFIX)) {
        return atomicImportRequiredResult();
      }
      if (fieldKey.startsWith(BUSINESS_CONTEXT_SERVICE_ITEM_PREFIX)) {
        return atomicImportRequiredResult();
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
