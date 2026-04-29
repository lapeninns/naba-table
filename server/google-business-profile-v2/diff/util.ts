/**
 * Phase 2 of the GBP Dual-Sync V2 architecture.
 *
 * Shared helpers for V2 section diff adapters.
 */

import { hashCanonicalJson } from '../hashing';

import type { SyncV2DiffItem, SyncV2SectionKey } from '../types';

export interface DiffItemBuildInput<TNabatable, TGoogle> {
  readonly sectionKey: SyncV2SectionKey;
  readonly fieldKey: string;
  readonly nabatable: TNabatable;
  readonly google: TGoogle;
  readonly canImport: boolean;
  readonly canExport: boolean;
  readonly googleUpdateMask?: SyncV2DiffItem['capabilities']['googleUpdateMask'];
  readonly blockedReasons?: ReadonlyArray<string>;
  readonly sortOrder: number;
}

export function buildDiffItem<TNabatable, TGoogle>({
  sectionKey,
  fieldKey,
  nabatable,
  google,
  canImport,
  canExport,
  googleUpdateMask,
  blockedReasons,
  sortOrder,
}: DiffItemBuildInput<TNabatable, TGoogle>): SyncV2DiffItem<TNabatable, TGoogle> {
  return {
    sectionKey,
    fieldKey,
    normalizedNabatableValue: nabatable,
    normalizedGoogleValue: google,
    nabatableValueHash: hashCanonicalJson(nabatable),
    googleValueHash: hashCanonicalJson(google),
    capabilities: {
      canImport,
      canExport,
      canIgnore: true,
      googleUpdateMask,
      blockedReasons,
    },
    sortOrder,
  };
}

export function valuesEqual(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}
