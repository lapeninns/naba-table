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
import { defaultDualSyncPorts } from './ports/default-ports';
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

export {
  defaultDualSyncPorts,
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
