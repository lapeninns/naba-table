import { createHash } from 'node:crypto';

import { GoogleBusinessProfileError } from './errors';
import {
  claimedGoogleWriteBundleSchema,
  type ClaimedGoogleWriteGrant,
} from './writePermitClaimedBundle';

export type GoogleWritePermitBinding = {
  readonly restaurantId: string;
  readonly externalProfileRowId: string;
  readonly accountId: string;
  readonly profileId: string;
  readonly locationId: string;
  readonly connectionGeneration: number;
  readonly consentEpoch: number;
  readonly bundleId: string;
  readonly executionId: string;
  readonly grantId: string;
  readonly groupId: string;
  readonly bundleOrder: number;
  readonly bundleSize: number;
  readonly method: 'PATCH' | 'POST' | 'DELETE';
  readonly resource: string;
  readonly updateMasks: readonly string[];
  readonly requestHash: string;
};

export type GoogleWritePermitStore = {
  readonly claim: () => Promise<unknown>;
  readonly dispatch: (binding: GoogleWritePermitBinding) => Promise<unknown>;
  readonly finalize: (
    binding: GoogleWritePermitBinding,
    status: 'consumed' | 'failed' | 'outcome_unknown',
    reasonCode: string,
  ) => Promise<unknown>;
};

const issued = new WeakSet<GoogleWritePermit>();
const ISSUE_PERMIT = Symbol('issue-google-write-permit');

export class GoogleWriteOutcomeUnknownError extends GoogleBusinessProfileError {
  constructor() {
    super('Google listing write outcome is unknown.', {
      code: 'GBP_WRITE_OUTCOME_UNKNOWN',
      status: 502,
      kind: 'upstream',
    });
    this.name = 'GoogleWriteOutcomeUnknownError';
  }
}

export function isGoogleWriteOutcomeUnknownError(
  error: unknown,
): error is GoogleWriteOutcomeUnknownError {
  return error instanceof GoogleWriteOutcomeUnknownError;
}

export class GoogleWritePermit {
  readonly binding: GoogleWritePermitBinding;
  readonly store: GoogleWritePermitStore;
  #consumed = false;

  private constructor(binding: GoogleWritePermitBinding, store: GoogleWritePermitStore) {
    this.binding = binding;
    this.store = store;
  }

  static issue(
    binding: GoogleWritePermitBinding,
    store: GoogleWritePermitStore,
    authority: typeof ISSUE_PERMIT,
  ): GoogleWritePermit {
    if (authority !== ISSUE_PERMIT) throw invalidPermit('GBP_WRITE_PERMIT_FORGED');
    const immutableBinding = Object.freeze({
      ...binding,
      updateMasks: Object.freeze([...binding.updateMasks].sort()),
    });
    const permit = new GoogleWritePermit(immutableBinding, store);
    issued.add(permit);
    return permit;
  }

  consume(authority: typeof ISSUE_PERMIT): void {
    if (authority !== ISSUE_PERMIT) throw invalidPermit('GBP_WRITE_PERMIT_FORGED');
    if (this.#consumed) throw invalidPermit('GBP_WRITE_PERMIT_REPLAYED');
    this.#consumed = true;
  }
}

function invalidPermit(code = 'GBP_WRITE_PERMIT_INVALID'): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError('Google listing write permit is invalid.', {
    code,
    status: 409,
  });
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function hashGoogleRequest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function isExactGrantBinding(
  grant: ClaimedGoogleWriteGrant,
  binding: GoogleWritePermitBinding,
): boolean {
  const masks = [...binding.updateMasks];
  return (
    grant.id === binding.grantId &&
    grant.group_id === binding.groupId &&
    grant.bundle_order === binding.bundleOrder &&
    grant.bundle_size === binding.bundleSize &&
    grant.restaurant_id === binding.restaurantId &&
    grant.external_profile_row_id === binding.externalProfileRowId &&
    grant.external_account_id === binding.accountId &&
    grant.external_profile_id === binding.profileId &&
    grant.external_location_id === binding.locationId &&
    grant.connection_generation === binding.connectionGeneration &&
    grant.consent_epoch === binding.consentEpoch &&
    grant.bundle_id === binding.bundleId &&
    grant.execution_id === binding.executionId &&
    grant.google_method === binding.method &&
    grant.google_resource === binding.resource &&
    grant.request_hash === binding.requestHash &&
    masks.join(',') === [...masks].sort().join(',') &&
    grant.update_masks.join(',') === masks.join(',')
  );
}

export function issueGoogleWritePermitsFromClaimedBundle(
  rows: unknown,
  bindings: readonly GoogleWritePermitBinding[],
  store: GoogleWritePermitStore,
): readonly GoogleWritePermit[] {
  const result = claimedGoogleWriteBundleSchema.safeParse(rows);
  if (!result.success) throw invalidPermit('GBP_WRITE_PERMIT_CLAIM_INVALID');
  const grants = result.data;
  const expectedSize = grants.length;
  const uniqueGrantIds = new Set(grants.map((grant) => grant.id));
  const uniqueBindingIds = new Set(bindings.map((binding) => binding.grantId));
  const complete =
    bindings.length === expectedSize &&
    uniqueGrantIds.size === expectedSize &&
    uniqueBindingIds.size === expectedSize &&
    grants.every(
      (grant, index) =>
        grant.bundle_size === expectedSize &&
        grant.bundle_order === index + 1 &&
        bindings[index] !== undefined &&
        isExactGrantBinding(grant, bindings[index]),
    );
  if (!complete) throw invalidPermit('GBP_WRITE_PERMIT_CLAIM_MISMATCH');
  return Object.freeze(
    bindings.map((binding) => GoogleWritePermit.issue(binding, store, ISSUE_PERMIT)),
  );
}

export async function claimGoogleWritePermit(
  bindings: readonly GoogleWritePermitBinding[],
  store: GoogleWritePermitStore,
): Promise<readonly GoogleWritePermit[]> {
  if (bindings.length === 0) throw invalidPermit('GBP_WRITE_PERMIT_CLAIM_MISMATCH');
  return issueGoogleWritePermitsFromClaimedBundle(await store.claim(), bindings, store);
}

async function finalizeDispatchedPermit(
  permit: GoogleWritePermit,
  status: 'consumed' | 'failed' | 'outcome_unknown',
  reasonCode: string,
): Promise<void> {
  try {
    await permit.store.finalize(permit.binding, status, reasonCode);
  } catch {
    throw new GoogleWriteOutcomeUnknownError();
  }
}

export async function executeGoogleWrite<T>(params: {
  readonly permit: GoogleWritePermit;
  readonly method: 'PATCH' | 'POST' | 'DELETE';
  readonly resource: string;
  readonly updateMasks: readonly string[];
  readonly payload: unknown;
  readonly dispatch: () => Promise<T>;
}): Promise<T> {
  const { permit } = params;
  if (!issued.has(permit)) throw invalidPermit('GBP_WRITE_PERMIT_FORGED');
  const binding = permit.binding;
  const masks = [...params.updateMasks].sort();
  if (
    binding.method !== params.method ||
    binding.resource !== params.resource ||
    [...binding.updateMasks].sort().join(',') !== masks.join(',') ||
    binding.requestHash !== hashGoogleRequest(params.payload)
  )
    throw invalidPermit('GBP_WRITE_PERMIT_REQUEST_MISMATCH');
  permit.consume(ISSUE_PERMIT);
  await permit.store.dispatch(binding);
  let result: T;
  try {
    result = await params.dispatch();
  } catch (error) {
    const definitive =
      error instanceof GoogleBusinessProfileError &&
      error.upstreamStatus !== undefined &&
      error.upstreamStatus >= 400 &&
      error.upstreamStatus < 500 &&
      error.upstreamStatus !== 408 &&
      error.upstreamStatus !== 429;
    await finalizeDispatchedPermit(
      permit,
      definitive ? 'failed' : 'outcome_unknown',
      definitive ? 'provider_definitive_rejection' : 'provider_outcome_unknown',
    );
    if (definitive) throw error;
    throw new GoogleWriteOutcomeUnknownError();
  }
  await finalizeDispatchedPermit(permit, 'consumed', 'provider_succeeded');
  return result;
}
