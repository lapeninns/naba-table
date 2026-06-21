/**
 * Deterministic field-policy version snapshots.
 *
 * The manifest intentionally stores serializable policy metadata only. Registry
 * normalizer/canonicalizer functions and live Core/Google field values are
 * excluded so policy hashes remain stable across equivalent code loads.
 */

import { getDualSyncDbClient, type DualSyncFieldPolicyVersionRow } from '../db';
import { hashCanonicalJson } from '../hashing';

import type { DualSyncFieldConfig } from './types';
import type { DualSyncFieldPolicyVersion } from '../types';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export interface DualSyncFieldPolicySnapshotEntry {
  readonly fieldKey: string;
  readonly sectionKey: string;
  readonly kind: string;
  readonly importable: boolean;
  readonly exportable: boolean;
  readonly conflictPolicy: string;
  readonly deletePolicy: string;
  readonly googleUpdateMask: string | null;
  readonly sortOrder: number;
  readonly policy: unknown;
}

export interface DualSyncFieldPolicySnapshot {
  readonly provider: 'google_business_profile';
  readonly fieldCount: number;
  readonly fields: ReadonlyArray<DualSyncFieldPolicySnapshotEntry>;
}

export interface BuildFieldPolicyVersionSnapshotResult {
  readonly snapshot: DualSyncFieldPolicySnapshot;
  readonly policyHash: string;
}

export function buildFieldPolicyVersionSnapshot(
  registry: ReadonlyArray<DualSyncFieldConfig>,
): BuildFieldPolicyVersionSnapshotResult {
  const fields = registry
    .map((config) => ({
      fieldKey: config.fieldKey,
      sectionKey: config.sectionKey,
      kind: config.kind,
      importable: config.importable,
      exportable: config.exportable,
      conflictPolicy: config.conflictPolicy,
      deletePolicy: config.deletePolicy,
      googleUpdateMask: config.googleUpdateMask ?? null,
      sortOrder: config.sortOrder,
      policy: config.policy,
    }))
    .sort((a, b) => a.fieldKey.localeCompare(b.fieldKey));
  const snapshot: DualSyncFieldPolicySnapshot = {
    provider: 'google_business_profile',
    fieldCount: fields.length,
    fields,
  };
  const policyHash = hashCanonicalJson(snapshot);
  if (!policyHash) {
    throw new Error('Field policy snapshot hash unexpectedly returned null');
  }
  return {
    snapshot,
    policyHash,
  };
}

function rowToFieldPolicyVersion(row: DualSyncFieldPolicyVersionRow): DualSyncFieldPolicyVersion {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    provider: row.provider,
    versionLabel: row.version_label,
    policyHash: row.policy_hash,
    policySnapshot: row.policy_snapshot,
    fieldCount: row.field_count,
    active: row.active,
    createdByUserId: row.created_by_user_id,
    activatedAt: row.activated_at,
    createdAt: row.created_at,
  };
}

export interface RecordFieldPolicyVersionInput {
  readonly client: DbClient;
  readonly registry: ReadonlyArray<DualSyncFieldConfig>;
  readonly versionLabel: string;
  readonly restaurantId?: string | null;
  readonly active?: boolean;
  readonly createdByUserId?: string | null;
  readonly activatedAt?: string | null;
}

export interface EnsureActiveFieldPolicyVersionInput {
  readonly client: DbClient;
  readonly registry: ReadonlyArray<DualSyncFieldConfig>;
  readonly restaurantId: string;
  readonly createdByUserId?: string | null;
  readonly activatedAt?: string | null;
  readonly versionLabel?: string | null;
}

export async function recordFieldPolicyVersion(
  input: RecordFieldPolicyVersionInput,
): Promise<DualSyncFieldPolicyVersion> {
  const dual = getDualSyncDbClient(input.client);
  const { snapshot, policyHash } = buildFieldPolicyVersionSnapshot(input.registry);
  const { data, error } = await dual
    .from('dual_sync_field_policy_versions')
    .insert({
      restaurant_id: input.restaurantId ?? null,
      provider: 'google_business_profile',
      version_label: input.versionLabel,
      policy_hash: policyHash,
      policy_snapshot: snapshot as unknown as Json,
      field_count: snapshot.fieldCount,
      active: input.active ?? false,
      created_by_user_id: input.createdByUserId ?? null,
      activated_at: input.activatedAt ?? null,
    } as never)
    .select('*')
    .single<DualSyncFieldPolicyVersionRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('dual_sync_field_policy_versions insert returned no row');
  }
  return rowToFieldPolicyVersion(data);
}

export async function ensureActiveFieldPolicyVersion(
  input: EnsureActiveFieldPolicyVersionInput,
): Promise<DualSyncFieldPolicyVersion> {
  const dual = getDualSyncDbClient(input.client);
  const { policyHash } = buildFieldPolicyVersionSnapshot(input.registry);
  const { data: existing, error: existingError } = await dual
    .from('dual_sync_field_policy_versions')
    .select('*')
    .eq('restaurant_id', input.restaurantId)
    .eq('provider', 'google_business_profile')
    .eq('policy_hash', policyHash)
    .eq('active', true)
    .maybeSingle<DualSyncFieldPolicyVersionRow>();
  if (existingError) {
    throw existingError;
  }
  if (existing) {
    return rowToFieldPolicyVersion(existing);
  }

  const { error: deactivateError } = await dual
    .from('dual_sync_field_policy_versions')
    .update({ active: false } as never)
    .eq('restaurant_id', input.restaurantId)
    .eq('provider', 'google_business_profile')
    .eq('active', true);
  if (deactivateError) {
    throw deactivateError;
  }

  return recordFieldPolicyVersion({
    client: input.client,
    registry: input.registry,
    versionLabel: input.versionLabel ?? `registry-${policyHash.slice(0, 12)}`,
    restaurantId: input.restaurantId,
    active: true,
    createdByUserId: input.createdByUserId ?? null,
    activatedAt: input.activatedAt ?? new Date().toISOString(),
  });
}
