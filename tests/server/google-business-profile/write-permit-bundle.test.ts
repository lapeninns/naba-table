import { describe, expect, it, vi } from 'vitest';

import { GoogleProviderError } from '@/server/google-business-profile/clientTransport';
import {
  createGoogleFoodMenusMutationClient,
  GoogleWritePreDispatchError,
} from '@/server/google-business-profile/mutationClients';
import {
  claimGoogleWritePermit,
  executeGoogleWrite,
  GoogleWriteOutcomeUnknownError,
  hashGoogleRequest,
  issueGoogleWritePermitsFromClaimedBundle,
  type GoogleWritePermitBinding,
  type GoogleWritePermitStore,
} from '@/server/google-business-profile/writePermit';
import { createGoogleWritePermitStore } from '@/server/google-business-profile/writePermitRepository';

import type { Database } from '@/types/supabase';

const ids = {
  restaurant: '11111111-1111-4111-8111-111111111111',
  profileRow: '22222222-2222-4222-8222-222222222222',
  bundle: '33333333-3333-4333-8333-333333333333',
  execution: '44444444-4444-4444-8444-444444444444',
  firstGrant: '55555555-5555-4555-8555-555555555555',
  secondGrant: '66666666-6666-4666-8666-666666666666',
  actor: '77777777-7777-4777-8777-777777777777',
} as const;

function binding(grantId: string, bundleOrder: number): GoogleWritePermitBinding {
  const payload = { title: `title-${bundleOrder}` };
  return {
    restaurantId: ids.restaurant,
    externalProfileRowId: ids.profileRow,
    accountId: 'account-1',
    profileId: 'profile-1',
    locationId: 'location-1',
    connectionGeneration: 2,
    consentEpoch: 3,
    bundleId: ids.bundle,
    executionId: ids.execution,
    grantId,
    groupId: `group-${bundleOrder}`,
    bundleOrder,
    bundleSize: 2,
    method: 'PATCH',
    resource: `locations/location-1/title-${bundleOrder}`,
    updateMasks: ['title'],
    requestHash: hashGoogleRequest(payload),
  };
}

function row(
  input: GoogleWritePermitBinding,
): Database['public']['Tables']['gbp_write_grants_v1']['Row'] {
  const hash = 'a'.repeat(64);
  return {
    actor_user_id: ids.actor,
    after_hashes: [hash],
    before_hashes: [hash],
    bundle_hash: hash,
    bundle_id: input.bundleId,
    bundle_order: input.bundleOrder,
    bundle_size: input.bundleSize,
    claimed_at: '2026-08-09T12:00:00.000Z',
    connection_generation: input.connectionGeneration,
    consent_epoch: input.consentEpoch,
    core_snapshot_hash: hash,
    created_at: '2026-08-09T12:00:00.000Z',
    decision_hash: hash,
    direction: 'export_to_google',
    dispatched_at: null,
    execution_id: input.executionId,
    expires_at: '2026-08-09T12:15:00.000Z',
    external_account_id: input.accountId,
    external_location_id: input.locationId,
    external_profile_id: input.profileId,
    external_profile_row_id: input.externalProfileRowId,
    field_keys: ['title'],
    google_method: input.method,
    google_resource: input.resource,
    google_snapshot_hash: hash,
    group_id: input.groupId,
    id: input.grantId,
    issued_at: '2026-08-09T12:00:00.000Z',
    manifest_hash: hash,
    policy_version: 'policy-1',
    preview_fingerprint: hash,
    provider: 'google_business_profile',
    reason_code: null,
    renderer_version: 'renderer-1',
    request_hash: input.requestHash,
    restaurant_id: input.restaurantId,
    risk_acknowledgements: ['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
    status: 'claimed',
    terminal_at: null,
    update_masks: [...input.updateMasks],
    update_masks_hash: hash,
    write_group: 'title',
  };
}

function store(): GoogleWritePermitStore {
  return {
    claim: vi.fn(),
    dispatch: vi.fn(),
    finalize: vi.fn(),
  };
}

describe('claimed Google write permit bundles', () => {
  const bindings = [binding(ids.firstGrant, 1), binding(ids.secondGrant, 2)];

  it('issues ordered permits without making a second claim', () => {
    const permitStore = store();
    const permits = issueGoogleWritePermitsFromClaimedBundle(
      bindings.map(row),
      bindings,
      permitStore,
    );

    expect(permits.map((permit) => permit.binding.grantId)).toEqual([
      ids.firstGrant,
      ids.secondGrant,
    ]);
    expect(permitStore.claim).not.toHaveBeenCalled();
  });

  it('claims a queued complete bundle once and issues one permit per grant', async () => {
    const permitStore = store();
    vi.mocked(permitStore.claim).mockResolvedValue(bindings.map(row));

    const permits = await claimGoogleWritePermit(bindings, permitStore);

    expect(permitStore.claim).toHaveBeenCalledOnce();
    expect(permits.map((permit) => permit.binding.bundleOrder)).toEqual([1, 2]);
  });

  it.each([
    ['non-claimed status', () => [{ ...row(bindings[0]), status: 'granted' }, row(bindings[1])]],
    ['partial bundle', () => [row(bindings[0])]],
    ['reordered rows', () => [row(bindings[1]), row(bindings[0])]],
    ['duplicate grant', () => [row(bindings[0]), { ...row(bindings[1]), id: ids.firstGrant }]],
    [
      'mismatched group',
      () => [{ ...row(bindings[0]), group_id: 'other-group' }, row(bindings[1])],
    ],
    [
      'mismatched binding',
      () => [row(bindings[0]), { ...row(bindings[1]), request_hash: 'b'.repeat(64) }],
    ],
  ])('rejects %s', (_name, buildRows) => {
    expect(() =>
      issueGoogleWritePermitsFromClaimedBundle(buildRows(), bindings, store()),
    ).toThrowError(expect.objectContaining({ code: expect.stringMatching(/^GBP_WRITE_PERMIT_/) }));
  });

  it('rejects an unknown content-bearing database field', () => {
    const rows = bindings.map(row);
    const first = rows[0];
    if (!first) throw new Error('fixture must include the first grant row');

    expect(() =>
      issueGoogleWritePermitsFromClaimedBundle(
        [{ ...first, provider_payload: { title: 'unparsed provider content' } }, ...rows.slice(1)],
        bindings,
        store(),
      ),
    ).toThrowError(expect.objectContaining({ code: 'GBP_WRITE_PERMIT_CLAIM_INVALID' }));
  });

  it('dispatches and finalizes each grant independently and rejects replay', async () => {
    const permitStore = store();
    const [firstPermit] = issueGoogleWritePermitsFromClaimedBundle(
      bindings.map(row),
      bindings,
      permitStore,
    );
    if (!firstPermit) throw new Error('fixture must include the first permit');

    await executeGoogleWrite({
      permit: firstPermit,
      method: firstPermit.binding.method,
      resource: firstPermit.binding.resource,
      updateMasks: firstPermit.binding.updateMasks,
      payload: { title: 'title-1' },
      dispatch: async () => 'ok',
    });

    expect(permitStore.dispatch).toHaveBeenCalledWith(firstPermit.binding);
    expect(permitStore.finalize).toHaveBeenCalledWith(
      firstPermit.binding,
      'consumed',
      'provider_succeeded',
    );
    await expect(
      executeGoogleWrite({
        permit: firstPermit,
        method: firstPermit.binding.method,
        resource: firstPermit.binding.resource,
        updateMasks: firstPermit.binding.updateMasks,
        payload: { title: 'title-1' },
        dispatch: async () => 'replayed',
      }),
    ).rejects.toMatchObject({ code: 'GBP_WRITE_PERMIT_REPLAYED' });
  });

  it('marks only a durably finalized ambiguous provider write as outcome unknown', async () => {
    const permitStore = store();
    const [permit] = issueGoogleWritePermitsFromClaimedBundle(
      bindings.map(row),
      bindings,
      permitStore,
    );
    if (!permit) throw new Error('fixture must include the first permit');

    const result = executeGoogleWrite({
      permit,
      method: permit.binding.method,
      resource: permit.binding.resource,
      updateMasks: permit.binding.updateMasks,
      payload: { title: 'title-1' },
      dispatch: async () => {
        throw new TypeError('secret network failure detail');
      },
    });

    await expect(result).rejects.toMatchObject({
      name: 'GoogleWriteOutcomeUnknownError',
      code: 'GBP_WRITE_OUTCOME_UNKNOWN',
      message: 'Google listing write outcome is unknown.',
    });
    await expect(result).rejects.toBeInstanceOf(GoogleWriteOutcomeUnknownError);
    await expect(result).rejects.not.toHaveProperty('cause');
    expect(permitStore.finalize).toHaveBeenCalledWith(
      permit.binding,
      'outcome_unknown',
      'provider_outcome_unknown',
    );
  });

  it('marks a FoodMenus eligibility timeout as pre-dispatch without consuming the permit', async () => {
    const permitStore = store();
    const [permit] = issueGoogleWritePermitsFromClaimedBundle(
      bindings.map(row),
      bindings,
      permitStore,
    );
    if (!permit) throw new Error('fixture must include the first permit');
    const client = createGoogleFoodMenusMutationClient({
      accessToken: 'token',
      dependencies: {
        fetch: vi.fn().mockRejectedValue(new TypeError('eligibility network timeout')),
        random: () => 0,
        sleep: async () => undefined,
      },
    });

    const result = client.replace({
      permit,
      accountId: 'account-1',
      locationId: 'location-1',
      payload: {},
    });

    await expect(result).rejects.toBeInstanceOf(GoogleWritePreDispatchError);
    await expect(result).rejects.toMatchObject({
      code: 'GBP_WRITE_PRE_DISPATCH_FAILED',
      message: 'Google listing write could not be dispatched.',
    });
    await expect(result).rejects.not.toHaveProperty('cause');
    expect(permitStore.dispatch).not.toHaveBeenCalled();
    expect(permitStore.finalize).not.toHaveBeenCalled();
  });

  it.each([
    [
      'malformed eligibility response',
      JSON.stringify({
        name: 'locations/location-1',
        metadata: { canHaveFoodMenus: 'not-a-boolean' },
      }),
    ],
    [
      'ineligible location',
      JSON.stringify({ name: 'locations/location-1', metadata: { canHaveFoodMenus: false } }),
    ],
  ])('marks %s as pre-dispatch without dispatch or finalize', async (_name, responseBody) => {
    const permitStore = store();
    const [permit] = issueGoogleWritePermitsFromClaimedBundle(
      bindings.map(row),
      bindings,
      permitStore,
    );
    if (!permit) throw new Error('fixture must include the first permit');
    const client = createGoogleFoodMenusMutationClient({
      accessToken: 'token',
      dependencies: { fetch: vi.fn().mockResolvedValue(new Response(responseBody)) },
    });

    const result = client.replace({
      permit,
      accountId: 'account-1',
      locationId: 'location-1',
      payload: {},
    });

    await expect(result).rejects.toBeInstanceOf(GoogleWritePreDispatchError);
    await expect(result).rejects.not.toBeInstanceOf(GoogleWriteOutcomeUnknownError);
    expect(permitStore.dispatch).not.toHaveBeenCalled();
    expect(permitStore.finalize).not.toHaveBeenCalled();
  });

  it('redacts a post-dispatch response-schema failure behind the outcome marker', async () => {
    const permitStore = store();
    const [permit] = issueGoogleWritePermitsFromClaimedBundle(
      bindings.map(row),
      bindings,
      permitStore,
    );
    if (!permit) throw new Error('fixture must include the first permit');

    const result = executeGoogleWrite({
      permit,
      method: permit.binding.method,
      resource: permit.binding.resource,
      updateMasks: permit.binding.updateMasks,
      payload: { title: 'title-1' },
      dispatch: async () => {
        throw new GoogleProviderError('secret malformed provider response', {
          code: 'GBP_MALFORMED_RESPONSE',
          status: 502,
          kind: 'malformed_response',
        });
      },
    });

    await expect(result).rejects.toBeInstanceOf(GoogleWriteOutcomeUnknownError);
    await expect(result).rejects.not.toHaveProperty(
      'message',
      expect.stringContaining('secret malformed'),
    );
    expect(permitStore.finalize).toHaveBeenCalledWith(
      permit.binding,
      'outcome_unknown',
      'provider_outcome_unknown',
    );
  });

  it.each([
    ['ambiguous provider failure', new TypeError('secret network timeout')],
    [
      'definitive provider failure',
      new GoogleProviderError('secret provider rejection', {
        code: 'GBP_UPSTREAM',
        status: 502,
        upstreamStatus: 400,
      }),
    ],
  ])('returns a safe outcome marker when %s cannot be finalized', async (_name, providerError) => {
    const permitStore = store();
    vi.mocked(permitStore.finalize).mockRejectedValue(new Error('secret finalize unavailable'));
    const [permit] = issueGoogleWritePermitsFromClaimedBundle(
      bindings.map(row),
      bindings,
      permitStore,
    );
    if (!permit) throw new Error('fixture must include the first permit');
    const dispatch = vi.fn(async () => {
      throw providerError;
    });

    const result = executeGoogleWrite({
      permit,
      method: permit.binding.method,
      resource: permit.binding.resource,
      updateMasks: permit.binding.updateMasks,
      payload: { title: 'title-1' },
      dispatch,
    });

    await expect(result).rejects.toBeInstanceOf(GoogleWriteOutcomeUnknownError);
    await expect(result).rejects.toMatchObject({
      code: 'GBP_WRITE_OUTCOME_UNKNOWN',
      message: 'Google listing write outcome is unknown.',
    });
    await expect(result).rejects.not.toHaveProperty('cause');
    await expect(result).rejects.not.toHaveProperty('message', expect.stringContaining('secret'));
    expect(dispatch).toHaveBeenCalledOnce();
    expect(permitStore.dispatch).toHaveBeenCalledOnce();
    expect(permitStore.finalize).toHaveBeenCalledOnce();
  });

  it('returns a safe outcome marker when a provider success cannot be finalized', async () => {
    const permitStore = store();
    vi.mocked(permitStore.finalize).mockRejectedValue(new Error('secret finalize unavailable'));
    const [permit] = issueGoogleWritePermitsFromClaimedBundle(
      bindings.map(row),
      bindings,
      permitStore,
    );
    if (!permit) throw new Error('fixture must include the first permit');
    const dispatch = vi.fn(async () => 'provider-response');

    const result = executeGoogleWrite({
      permit,
      method: permit.binding.method,
      resource: permit.binding.resource,
      updateMasks: permit.binding.updateMasks,
      payload: { title: 'title-1' },
      dispatch,
    });

    await expect(result).rejects.toBeInstanceOf(GoogleWriteOutcomeUnknownError);
    await expect(result).rejects.toMatchObject({ code: 'GBP_WRITE_OUTCOME_UNKNOWN' });
    await expect(result).rejects.not.toHaveProperty('cause');
    expect(dispatch).toHaveBeenCalledOnce();
    expect(permitStore.dispatch).toHaveBeenCalledOnce();
    expect(permitStore.finalize).toHaveBeenCalledOnce();
  });

  it('uses per-grant dispatch and finalize RPC identities', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row(bindings[0]), error: null });
    const permitStore = createGoogleWritePermitStore(
      { rpc },
      {
        p_bundle_hash: 'a'.repeat(64),
        p_bundle_id: ids.bundle,
        p_connection_generation: 2,
        p_consent_epoch: 3,
        p_decision_hashes: ['a'.repeat(64), 'a'.repeat(64)],
        p_execution_id: ids.execution,
        p_external_account_id: 'account-1',
        p_external_location_id: 'location-1',
        p_external_profile_id: 'profile-1',
        p_external_profile_row_id: ids.profileRow,
        p_grant_ids: [ids.firstGrant, ids.secondGrant],
        p_manifest_hashes: ['a'.repeat(64), 'a'.repeat(64)],
        p_policy_version: 'policy-1',
        p_renderer_version: 'renderer-1',
        p_request_hashes: bindings.map((item) => item.requestHash),
        p_restaurant_id: ids.restaurant,
        p_update_masks_hashes: ['a'.repeat(64), 'a'.repeat(64)],
      },
    );

    await permitStore.dispatch(bindings[0]);
    await permitStore.finalize(bindings[0], 'failed', 'provider_definitive_rejection');

    expect(rpc).toHaveBeenNthCalledWith(1, 'dispatch_gbp_write_grant_v1', {
      p_restaurant_id: ids.restaurant,
      p_bundle_id: ids.bundle,
      p_grant_id: ids.firstGrant,
      p_execution_id: ids.execution,
      p_bundle_order: 1,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'finalize_gbp_write_grant_v1', {
      p_restaurant_id: ids.restaurant,
      p_bundle_id: ids.bundle,
      p_grant_id: ids.firstGrant,
      p_execution_id: ids.execution,
      p_bundle_order: 1,
      p_status: 'failed',
      p_reason_code: 'provider_definitive_rejection',
    });
  });
});
