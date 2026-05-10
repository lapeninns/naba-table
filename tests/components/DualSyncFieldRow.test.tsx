import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncFieldRow } from '@/components/features/restaurant-settings/dual-sync/DualSyncFieldRow';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function makeField(over: Partial<DualSyncFieldSummary> = {}): DualSyncFieldSummary {
  return {
    fieldKey: 'profile.name',
    sectionKey: 'profile',
    kind: 'profile',
    label: 'Business name',
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey: 'profile.name',
      sectionKey: 'profile',
      authority: 'bidirectional_manual',
      riskLevel: 'critical',
      importable: true,
      exportable: true,
      requiresManualReview: true,
      googleWriteGroup: 'location.profile',
      semanticComparator: 'text',
      canonicalizer: 'canonicalizeText',
      destructiveWritePossible: true,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: 'Nabatable name',
    gbpValue: 'Google name',
    coreCanonicalHash: 'core-hash',
    gbpCanonicalHash: 'gbp-hash',
    capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
    state: 'conflict',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
    ...over,
  };
}

describe('DualSyncFieldRow', () => {
  it('renders policy badges for manual-review high-risk fields', () => {
    render(<DualSyncFieldRow field={makeField()} selectedAction={null} onChangeAction={vi.fn()} />);

    expect(screen.getByText('Manual review')).toBeInTheDocument();
    expect(screen.getByText('High-risk field')).toBeInTheDocument();
  });

  it('renders explicit blocked-action reasons for non-writable fields', () => {
    render(
      <DualSyncFieldRow
        field={makeField({
          fieldKey: 'profile.googleMapUrl',
          label: 'Google Maps URL',
          exportable: false,
          conflictPolicy: 'gbp_wins',
          policy: {
            fieldKey: 'profile.googleMapUrl',
            sectionKey: 'profile',
            authority: 'google_authoritative',
            riskLevel: 'low',
            importable: true,
            exportable: false,
            requiresManualReview: false,
            noWriteReason: 'Google Maps URL is Google-owned metadata and is not directly writable.',
            semanticComparator: 'url',
            canonicalizer: 'canonicalizeUrl',
            destructiveWritePossible: false,
          },
          capability: {
            canImport: true,
            canExport: false,
            canIgnore: true,
            blockedReasons: [
              'Google Maps URL is Google-owned metadata and is not directly writable.',
            ],
          },
        })}
        selectedAction={null}
        onChangeAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Google-owned')).toBeInTheDocument();
    expect(screen.getByText(/Google Maps URL is Google-owned metadata/)).toBeInTheDocument();
  });
});
