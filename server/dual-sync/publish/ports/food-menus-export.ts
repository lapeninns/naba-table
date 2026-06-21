/**
 * Concrete FoodMenus export port.
 *
 * A Google FoodMenus write is a full `menus` replacement, not an item-level
 * patch. Even when the operator approves one projected item field, this port
 * publishes the current deterministic full Nabatable projection through the
 * audited FoodMenus preflight service.
 */

import { publishFoodMenusProjectionToGoogle } from '@/server/google-business-profile/food-menus-sync';
import { getGoogleBusinessProfileFoodMenusContext } from '@/server/google-business-profile/service';

import { hashCanonicalJson } from '../../hashing';
import { buildRegistry, findFieldConfig } from '../../registry';

import type {
  DualSyncBatchExportContext,
  DualSyncBatchExportResult,
  DualSyncOperationContext,
  DualSyncOperationResult,
} from '../types';

const FOOD_MENUS_FIELD_KEY_PREFIX = 'foodMenus.items.';

function supportsFoodMenusField(fieldKey: string): boolean {
  return fieldKey.startsWith(FOOD_MENUS_FIELD_KEY_PREFIX);
}

function unsupported(fieldKey: string): DualSyncOperationResult {
  return {
    status: 'failed',
    failure: {
      code: 'UNSUPPORTED_FIELD',
      message: `FoodMenus export port does not handle ${fieldKey}.`,
      retryable: false,
    },
  };
}

function resultForField(
  ctx: Pick<DualSyncBatchExportContext, 'coreSnapshot' | 'gbpSnapshot'>,
  fieldKey: string,
  externalResponse: unknown,
): DualSyncOperationResult {
  const registry = buildRegistry({
    coreSnapshot: ctx.coreSnapshot,
    gbpSnapshot: ctx.gbpSnapshot,
    includeCoreOnly: false,
  });
  const config = findFieldConfig(registry, fieldKey);
  if (!config) {
    return {
      status: 'failed',
      failure: {
        code: 'INVALID_DECISION',
        message: `Field ${fieldKey} is not in the registry.`,
        retryable: false,
      },
    };
  }
  const canonical = config.canonicalizeCoreValue(ctx.coreSnapshot.foodMenus ?? { items: [] });
  const hash = hashCanonicalJson(canonical);
  return {
    status: 'succeeded',
    googleUpdateMask: 'menus',
    afterCoreHash: hash,
    afterGbpHash: hash,
    externalResponse,
  };
}

async function publishFoodMenusForContext(
  ctx: Pick<
    DualSyncBatchExportContext,
    'client' | 'restaurantId' | 'actorUserId' | 'coreSnapshot' | 'gbpSnapshot'
  >,
): Promise<unknown> {
  const foodMenusContext = await getGoogleBusinessProfileFoodMenusContext({
    client: ctx.client,
    restaurantId: ctx.restaurantId,
    requirePushEnabled: true,
  });
  const published = await publishFoodMenusProjectionToGoogle({
    client: ctx.client,
    restaurantId: ctx.restaurantId,
    accessToken: foodMenusContext.accessToken,
    foodMenusName: foodMenusContext.foodMenusName,
    externalProfileId: foodMenusContext.externalProfileId,
    createdByUserId: ctx.actorUserId,
  });
  if (published.attempt.status !== 'succeeded') {
    return {
      failed: true,
      attempt: published.attempt,
      googleResponse: published.googleResponse,
    };
  }
  return {
    attempt: published.attempt,
    baselineGoogleHash: published.baselineGoogleHash,
    googleResponse: published.googleResponse,
  };
}

export async function applyFoodMenusExportToGoogle(
  ctx: DualSyncOperationContext,
): Promise<DualSyncOperationResult> {
  if (!supportsFoodMenusField(ctx.decision.fieldKey)) {
    return unsupported(ctx.decision.fieldKey);
  }

  const externalResponse = await publishFoodMenusForContext(ctx);
  if (
    externalResponse &&
    typeof externalResponse === 'object' &&
    (externalResponse as { failed?: unknown }).failed
  ) {
    return {
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: 'FoodMenus publish attempt failed.',
        retryable: true,
      },
      externalResponse,
    };
  }

  return resultForField(ctx, ctx.decision.fieldKey, externalResponse);
}

export async function applyFoodMenusExportBatchToGoogle(
  ctx: DualSyncBatchExportContext,
): Promise<DualSyncBatchExportResult> {
  if (ctx.sectionKey !== 'foodMenus') {
    return { supported: false };
  }
  if (ctx.decisions.length === 0) {
    return { supported: true, perField: {} };
  }
  if (!ctx.decisions.every((decision) => supportsFoodMenusField(decision.fieldKey))) {
    return { supported: false };
  }

  const externalResponse = await publishFoodMenusForContext(ctx);
  const perField: Record<string, DualSyncOperationResult> = {};
  for (const decision of ctx.decisions) {
    if (
      externalResponse &&
      typeof externalResponse === 'object' &&
      (externalResponse as { failed?: unknown }).failed
    ) {
      perField[decision.fieldKey] = {
        status: 'failed',
        failure: {
          code: 'PORT_FAILURE',
          message: 'FoodMenus publish attempt failed.',
          retryable: true,
        },
        externalResponse,
      };
      continue;
    }
    perField[decision.fieldKey] = resultForField(ctx, decision.fieldKey, externalResponse);
  }

  return { supported: true, perField };
}
