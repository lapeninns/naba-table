import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyProfileImportToCore } from '@/server/dual-sync/publish/ports/profile-import';

import type { DualSyncOperationContext } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ROW_ID = '22222222-2222-4222-8222-222222222222';
const rpcMock = vi.fn();
const fromMock = vi.fn();
const maybeSingleMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const client = { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient<Database>;

const linkedProfile = {
  id: PROFILE_ROW_ID,
  restaurant_id: RESTAURANT_ID,
  provider: 'google_business_profile',
  connection_status: 'linked',
  external_account_id: 'account-1',
  external_profile_id: 'profile-1',
  external_location_id: 'location-1',
  connection_generation: 2,
  consent_epoch: 3,
};

function makeSnapshot(over: Partial<DualSyncCanonicalSnapshot> = {}): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Tasty',
      contactPhone: '+15551234567',
      address: '1 Main',
      storefrontAddress: null,
      googleMapUrl: 'https://maps.google.com/?cid=1',
      googleReviewUrl: 'https://search.google.com/local/writereview?placeid=abc',
    },
    operatingHours: { weekly: [] },
    servicePeriods: { periods: [] },
    businessContext: { categories: [], serviceAreas: [], attributes: [], serviceItems: [] },
    ...over,
  };
}

function makeCtx(
  fieldKey: string,
  gbpSnapshot: DualSyncCanonicalSnapshot = makeSnapshot(),
): DualSyncOperationContext {
  return {
    client,
    restaurantId: RESTAURANT_ID,
    publishJobId: 'job-1',
    decision: {
      fieldKey,
      sectionKey: fieldKey.startsWith('profile.') ? 'profile' : 'operatingHours',
      action: 'import_from_google',
      pinnedCoreHash: null,
      pinnedGbpHash: null,
    },
    coreSnapshot: makeSnapshot(),
    gbpSnapshot,
    actorUserId: null,
  };
}

describe('applyProfileImportToCore', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    maybeSingleMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    const query = {
      select: selectMock,
      eq: eqMock,
      maybeSingle: maybeSingleMock,
      update: updateMock,
      delete: deleteMock,
    };
    selectMock.mockReturnValue(query);
    eqMock.mockReturnValue(query);
    fromMock.mockReturnValue(query);
    maybeSingleMock.mockResolvedValue({ data: linkedProfile, error: null });
    rpcMock.mockResolvedValue({ data: { id: RESTAURANT_ID }, error: null });
  });

  it.each([
    ['profile.name', 'Acme'],
    ['profile.contactPhone', '+15551234567'],
    ['profile.address', '1 Main'],
    ['profile.googleMapUrl', 'https://maps.google.com/?cid=1'],
    ['profile.googleReviewUrl', 'https://search.google.com/local/writereview?placeid=abc'],
  ])(
    'atomically imports supported field %s through one exact fenced RPC',
    async (fieldKey, value) => {
      const result = await applyProfileImportToCore(makeCtx(fieldKey));

      expect(fromMock).toHaveBeenCalledOnce();
      expect(fromMock).toHaveBeenCalledWith('restaurant_external_profiles');
      expect(eqMock.mock.calls).toEqual([
        ['restaurant_id', RESTAURANT_ID],
        ['provider', 'google_business_profile'],
        ['connection_status', 'linked'],
      ]);
      expect(updateMock).not.toHaveBeenCalled();
      expect(deleteMock).not.toHaveBeenCalled();
      expect(rpcMock).toHaveBeenCalledOnce();
      expect(rpcMock).toHaveBeenCalledWith('apply_gbp_profile_import_to_core_v1', {
        p_restaurant_id: RESTAURANT_ID,
        p_external_profile_row_id: PROFILE_ROW_ID,
        p_expected_account_id: 'account-1',
        p_expected_profile_id: 'profile-1',
        p_expected_location_id: 'location-1',
        p_connection_generation: 2,
        p_consent_epoch: 3,
        p_field_key: fieldKey,
        p_value: value,
      });
      expect(result.status).toBe('succeeded');
    },
  );

  it.each([
    'profile.contactPhone',
    'profile.address',
    'profile.googleMapUrl',
    'profile.googleReviewUrl',
  ])('passes null semantics for nullable field %s', async (fieldKey) => {
    const snapshot = makeSnapshot();
    const profile = snapshot.profile;
    if (!profile) throw new Error('fixture must include profile data');
    const nullProfile = {
      ...profile,
      contactPhone: fieldKey === 'profile.contactPhone' ? null : profile.contactPhone,
      address: fieldKey === 'profile.address' ? null : profile.address,
      googleMapUrl: fieldKey === 'profile.googleMapUrl' ? null : profile.googleMapUrl,
      googleReviewUrl: fieldKey === 'profile.googleReviewUrl' ? null : profile.googleReviewUrl,
    };

    const result = await applyProfileImportToCore(
      makeCtx(fieldKey, { ...snapshot, profile: nullProfile }),
    );

    expect(result.status).toBe('succeeded');
    expect(rpcMock).toHaveBeenLastCalledWith(
      'apply_gbp_profile_import_to_core_v1',
      expect.objectContaining({ p_field_key: fieldKey, p_value: null }),
    );
  });

  it.each(['profile.businessDescription', 'operatingHours.weekly.0'])(
    'rejects unsupported field %s without reading or writing tables',
    async (fieldKey) => {
      const result = await applyProfileImportToCore(makeCtx(fieldKey));

      expect(result).toMatchObject({ status: 'failed', failure: { code: 'PORT_FAILURE' } });
      expect(fromMock).not.toHaveBeenCalled();
      expect(rpcMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing current profile', { data: null, error: null }],
    ['cross-tenant profile read', { data: null, error: null }],
    ['profile read failure', { data: null, error: { message: 'secret database detail' } }],
  ])('fails safely for %s without invoking the import RPC', async (_name, readResult) => {
    maybeSingleMock.mockResolvedValue(readResult);

    const result = await applyProfileImportToCore(makeCtx('profile.name'));

    expect(result).toEqual({
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: 'Google profile import could not be applied.',
        retryable: false,
      },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns a safe failure for a stale-fence RPC rejection with no fallback writes', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'GBP profile import fence mismatch: secret account' },
    });

    const result = await applyProfileImportToCore(makeCtx('profile.name'));

    expect(result).toEqual({
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: 'Google profile import could not be applied.',
        retryable: false,
      },
    });
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it.each(['profile read', 'import RPC'])('redacts a thrown %s database error', async (phase) => {
    if (phase === 'profile read') {
      maybeSingleMock.mockRejectedValue(new Error('secret profile read detail'));
    } else {
      rpcMock.mockRejectedValue(new Error('secret RPC detail'));
    }

    const result = await applyProfileImportToCore(makeCtx('profile.name'));

    expect(result).toEqual({
      status: 'failed',
      failure: {
        code: 'PORT_FAILURE',
        message: 'Google profile import could not be applied.',
        retryable: false,
      },
    });
  });
});
