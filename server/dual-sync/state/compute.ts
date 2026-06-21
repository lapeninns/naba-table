/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Pure state-computation function. Given the canonical hashes for one
 * field (Core side, Google side, last-known-in-sync) and a few state
 * overlays (open outbound candidate, ignored flag, last publish failure),
 * derive the canonical `DualSyncFieldState`.
 *
 * The function does not read or write any database; both sides of the
 * call must already have hashes precomputed.
 */

import type { DualSyncConflictPolicy } from '../registry/types';
import type { DualSyncFieldState } from '../types';

export interface ComputeFieldStateInput {
  readonly conflictPolicy: DualSyncConflictPolicy;
  readonly coreHash: string | null;
  readonly gbpHash: string | null;
  readonly lastInSyncHash: string | null;
  readonly hasOpenOutboundCandidate?: boolean;
  readonly previousState?: DualSyncFieldState | null;
  readonly previousCoreHash?: string | null;
  readonly previousGbpHash?: string | null;
  readonly ignored?: boolean;
}

/**
 * Truth table:
 *
 *   policy=unsupported                                                  -> unsupported
 *   ignored                                                              -> ignored
 *   coreHash == gbpHash                                                  -> in_sync
 *   coreHash == lastInSync && gbpHash != lastInSync                      -> gbp_dirty
 *   coreHash != lastInSync && gbpHash == lastInSync                      -> core_dirty
 *   coreHash != lastInSync && gbpHash != lastInSync                      -> conflict
 *   coreHash != gbpHash && lastInSync == null                            -> drifted
 *   pending_*  / *_failed                                                -> retained from previous state
 *                                                                         when chosenSide hash unchanged
 *   open outbound candidate present and effective state == core_dirty     -> pending_export overlay
 *
 * Notes:
 *   - `null` means "field absent" on that side. This is treated as a
 *     value: e.g. null vs "abc" is drifted/dirty as expected.
 *   - The `pending_export` overlay only kicks in when the operator has
 *     queued an export candidate; once the publish completes the candidate
 *     resolves and the next computation falls through to in_sync.
 */
export function computeFieldState(input: ComputeFieldStateInput): DualSyncFieldState {
  const {
    conflictPolicy,
    coreHash,
    gbpHash,
    lastInSyncHash,
    hasOpenOutboundCandidate,
    previousState,
    previousCoreHash,
    previousGbpHash,
    ignored,
  } = input;

  if (conflictPolicy === 'unsupported') return 'unsupported';
  if (ignored) return 'ignored';

  if (coreHash === gbpHash) {
    return 'in_sync';
  }

  // Retain pending_* / *_failed overlays only while the side chosen by the
  // decision has not moved since the decision/failure was recorded.
  if (previousState === 'pending_import' || previousState === 'import_failed') {
    if (previousGbpHash === undefined || previousGbpHash === gbpHash) {
      return previousState;
    }
  }
  if (previousState === 'pending_export' || previousState === 'export_failed') {
    if (previousCoreHash === undefined || previousCoreHash === coreHash) {
      return previousState;
    }
  }

  if (lastInSyncHash !== null) {
    const coreMoved = coreHash !== lastInSyncHash;
    const gbpMoved = gbpHash !== lastInSyncHash;
    if (coreMoved && gbpMoved) return 'conflict';
    if (gbpMoved && !coreMoved) {
      return 'gbp_dirty';
    }
    if (coreMoved && !gbpMoved) {
      return hasOpenOutboundCandidate ? 'pending_export' : 'core_dirty';
    }
  }

  // Two sides differ but we have no last-known-in-sync baseline (first
  // diff after migration / first ever pull). Surface as `drifted` so the
  // operator can decide direction explicitly.
  return 'drifted';
}
