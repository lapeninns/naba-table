import { describe, expect, it, vi } from 'vitest';

import { createGoogleRequestLog } from '@/server/dual-sync/publish/google-request-logs';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly insert: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly single: ReturnType<typeof vi.fn>;
}

function makeChain(result: unknown): MockChain {
  const chain: Partial<MockChain> = {};
  const fluent = vi.fn(() => chain as MockChain);
  Object.assign(chain, {
    insert: fluent,
    select: fluent,
    single: vi.fn(async () => ({ data: result, error: null })),
  });
  return chain as MockChain;
}

function makeLogRow(over: Record<string, unknown> = {}) {
  return {
    id: 'request-log-1',
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    publish_batch_id: 'batch-1',
    operation_group_id: 'group-1',
    publish_operation_id: 'operation-1',
    publish_job_id: 'job-1',
    section_key: 'profile',
    field_key: 'profile.name',
    direction: 'export_to_google',
    write_group: 'location.profile',
    phase: 'provider_write',
    status: 'failed',
    google_method: 'locations.patch',
    google_update_masks: ['profile'],
    request_summary: { fieldKey: 'profile.name' },
    response_summary: { status: 403 },
    error_code: 'LOCATION_ACCESS_LOST',
    error_message: 'Permission denied',
    retention_expires_at: '2026-11-06T00:00:00.000Z',
    created_at: '2026-05-10T00:00:00.000Z',
    ...over,
  };
}

function clientFor(chain: MockChain) {
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>;
}

describe('createGoogleRequestLog', () => {
  it('inserts redacted request and response summaries while preserving metadata', async () => {
    const chain = makeChain(makeLogRow());
    const client = clientFor(chain);

    const log = await createGoogleRequestLog({
      client,
      restaurantId: 'rest-1',
      publishBatchId: 'batch-1',
      operationGroupId: 'group-1',
      publishOperationId: 'operation-1',
      publishJobId: 'job-1',
      sectionKey: 'profile',
      fieldKey: 'profile.name',
      direction: 'export_to_google',
      writeGroup: 'location.profile',
      phase: 'provider_write',
      status: 'failed',
      googleMethod: 'locations.patch',
      googleUpdateMasks: ['profile'],
      requestSummary: {
        fieldKey: 'profile.name',
        authorization: 'Bearer request-token',
        headers: {
          cookie: 'gbp-session=request-cookie',
          'x-goog-api-key': 'request-api-key',
        },
      },
      responseSummary: {
        url: 'https://google.example/location?access_token=query-token',
        body: {
          refresh_token: 'response-refresh-token',
          message: 'invalid secret=response-secret',
        },
      },
      errorCode: 'LOCATION_ACCESS_LOST',
      errorMessage: 'Permission denied for access_token=message-token',
    });

    const insert = chain.insert.mock.calls[0]?.[0];
    expect(JSON.stringify(insert)).not.toContain('request-token');
    expect(JSON.stringify(insert)).not.toContain('request-cookie');
    expect(JSON.stringify(insert)).not.toContain('request-api-key');
    expect(JSON.stringify(insert)).not.toContain('query-token');
    expect(JSON.stringify(insert)).not.toContain('response-refresh-token');
    expect(JSON.stringify(insert)).not.toContain('response-secret');
    expect(JSON.stringify(insert)).not.toContain('message-token');
    expect(insert).toMatchObject({
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      publish_batch_id: 'batch-1',
      operation_group_id: 'group-1',
      publish_operation_id: 'operation-1',
      publish_job_id: 'job-1',
      section_key: 'profile',
      field_key: 'profile.name',
      direction: 'export_to_google',
      write_group: 'location.profile',
      phase: 'provider_write',
      status: 'failed',
      google_method: 'locations.patch',
      google_update_masks: ['profile'],
      request_summary: {
        fieldKey: 'profile.name',
        authorization: '[redacted]',
        headers: {
          cookie: '[redacted]',
          'x-goog-api-key': '[redacted]',
        },
      },
      response_summary: {
        url: 'https://google.example/location?access_token=[redacted]',
        body: {
          refresh_token: '[redacted]',
          message: 'invalid secret=[redacted]',
        },
      },
      error_code: 'LOCATION_ACCESS_LOST',
      error_message: 'Permission denied for access_token=[redacted]',
    });
    expect(log.id).toBe('request-log-1');
    expect(log.googleUpdateMasks).toEqual(['profile']);
  });
});
