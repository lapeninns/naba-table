import type { GooglePubsubPersistOutcome, GooglePubsubPersistencePort } from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type AtomicProcessingResult =
  | 'accepted'
  | 'duplicate'
  | 'ignored'
  | 'unmatched'
  | 'poison'
  | 'rejected'
  | 'failed';

type AtomicPubsubReceiptInput = {
  readonly subscription: string;
  readonly messageId: string;
  readonly eventHash: string;
  readonly eventType: string | null;
  readonly authenticationResult: 'verified';
  readonly processingResult: 'accepted' | 'ignored' | 'poison';
  readonly externalAccountId: string | null;
  readonly externalLocationId: string | null;
  readonly idempotencyKey: string;
  readonly receivedAt: string;
};

type AtomicPubsubReceiptResult = {
  readonly processingResult: AtomicProcessingResult;
  readonly receiptInserted: boolean;
  readonly jobId: string | null;
};

function atomicProcessingResult(value: string): AtomicProcessingResult {
  switch (value) {
    case 'accepted':
    case 'duplicate':
    case 'ignored':
    case 'unmatched':
    case 'poison':
    case 'rejected':
    case 'failed':
      return value;
    default:
      throw new Error('Google Pub/Sub receipt returned an invalid processing result.');
  }
}

export interface AtomicGooglePubsubReceiptPort {
  recordAtomic(input: AtomicPubsubReceiptInput): Promise<AtomicPubsubReceiptResult>;
}

export class GooglePubsubPersistenceError extends Error {
  constructor(readonly processingResult: 'rejected' | 'failed') {
    super(`Google Pub/Sub persistence ${processingResult}.`);
    this.name = 'GooglePubsubPersistenceError';
  }
}

export async function persistGooglePubsubDelivery(
  input: Parameters<GooglePubsubPersistencePort['persist']>[0],
  dependencies: AtomicGooglePubsubReceiptPort & { readonly clock?: () => Date },
): Promise<GooglePubsubPersistOutcome> {
  const supported = input.delivery.kind === 'supported';
  const result = await dependencies.recordAtomic({
    subscription: input.subscription,
    messageId: input.delivery.messageId,
    eventHash: input.delivery.eventHash,
    eventType: input.delivery.eventType,
    authenticationResult: 'verified',
    processingResult: supported
      ? 'accepted'
      : input.delivery.reason === 'malformed_notification'
        ? 'poison'
        : 'ignored',
    externalAccountId: supported ? input.delivery.externalAccountId : null,
    externalLocationId: supported ? input.delivery.externalLocationId : null,
    idempotencyKey: `pubsub:${input.subscription}:${input.delivery.messageId}`,
    receivedAt: (dependencies.clock ?? (() => new Date()))().toISOString(),
  });
  switch (result.processingResult) {
    case 'accepted':
      return { outcome: 'accepted' };
    case 'duplicate':
      return { outcome: 'duplicate' };
    case 'ignored':
    case 'poison':
      return { outcome: 'ignored' };
    case 'unmatched':
      return { outcome: 'unmatched' };
    case 'rejected':
    case 'failed':
      throw new GooglePubsubPersistenceError(result.processingResult);
  }
}

export function createSupabaseGooglePubsubPersistence(
  client: SupabaseClient<Database>,
): GooglePubsubPersistencePort {
  return {
    persist(input) {
      return persistGooglePubsubDelivery(input, {
        async recordAtomic(receipt) {
          let registryId: string | null = null;
          if (receipt.externalAccountId) {
            const registry = await client
              .from('gbp_notification_registries_v1')
              .select('id')
              .eq('provider', 'google_business_profile')
              .eq('external_account_id', receipt.externalAccountId)
              .maybeSingle();
            if (registry.error) throw registry.error;
            registryId = registry.data?.id ?? null;
          }
          const result = await client.rpc('record_gbp_pubsub_and_enqueue_v1', {
            p_subscription: receipt.subscription,
            p_message_id: receipt.messageId,
            p_event_hash: receipt.eventHash,
            p_event_type: receipt.eventType,
            p_authentication_result: receipt.authenticationResult,
            p_processing_result: receipt.processingResult,
            p_registry_id: registryId,
            p_restaurant_id: null,
            p_external_profile_row_id: null,
            p_external_account_id: receipt.externalAccountId,
            p_external_profile_id: null,
            p_external_location_id: receipt.externalLocationId,
            p_connection_generation: null,
            p_consent_epoch: null,
            p_idempotency_key: receipt.idempotencyKey,
            p_received_at: receipt.receivedAt,
          });
          if (result.error) throw result.error;
          return {
            processingResult: atomicProcessingResult(result.data.processing_result),
            receiptInserted: result.data.receipt_inserted,
            jobId: result.data.job_id,
          };
        },
      });
    },
  };
}
