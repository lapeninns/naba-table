import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { GbpReviewTable } from '@/components/features/restaurant-settings/google-business-profile/components/GbpReviewTable';
import { gbpDualSyncStateFor } from '@/src/app/(public)/dev/_mocks/gbp/gbpFixtures';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

// The dev harness fixtures: every section, a Google-owned field, a list value and menu items.
const fields = gbpDualSyncStateFor('linked').fields;

function workspace(overrides: Record<string, unknown> = {}) {
  const fieldsBySection = new Map<DualSyncSectionKey, DualSyncFieldSummary[]>();
  for (const field of fields) {
    const key = field.sectionKey as DualSyncSectionKey;
    fieldsBySection.set(key, [...(fieldsBySection.get(key) ?? []), field]);
  }
  return {
    orderedSectionKeys: [...fieldsBySection.keys()],
    fieldsBySection,
    visibleFields: fields,
    decisions: {},
    onSelectAction: vi.fn(),
    onBulkSelectSection: vi.fn(),
    onClearSection: vi.fn(),
    ...overrides,
  };
}

function Table({ sendBlockReason = null }: { sendBlockReason?: string | null }) {
  const [showMatching, setShowMatching] = useState(false);
  return (
    <GbpReviewTable
      workspace={workspace()}
      sendBlockReason={sendBlockReason}
      choicesLocked={false}
      checkedAt="2026-09-26T12:58:00.000Z"
      showMatching={showMatching}
      onShowMatchingChange={setShowMatching}
    />
  );
}

describe('GbpReviewTable', () => {
  it('lists only the differences, then every field when asked', async () => {
    const user = userEvent.setup();
    render(<Table />);

    expect(screen.getByRole('status')).toHaveTextContent(
      '11 differences in 6 sections · 0 of 11 decided',
    );
    expect(screen.queryByText('Business name')).toBeNull();
    expect(screen.getByText('All match: Service items.')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Show matching fields' }));

    const businessName = screen
      .getByText('Business name')
      .closest('[data-gbp-field]') as HTMLElement;
    expect(within(businessName).getByText('No action needed')).toBeInTheDocument();
    expect(screen.queryByText(/^All match:/)).toBeNull();
  });

  it('never offers Send to Google for a Google-owned value, and says why', () => {
    render(<Table />);

    const maps = screen.getByRole('group', { name: 'What to do with Google Maps URL' });
    expect(within(maps).getByRole('radio', { name: 'Send to Google' })).toBeDisabled();
    expect(within(maps).getByRole('radio', { name: 'Use Google’s' })).toBeEnabled();
    expect(screen.getByText('Changed on Google · Google-owned')).toBeInTheDocument();
    expect(maps).toHaveAccessibleDescription(/Google owns this value/);
  });

  it('warns that sending any menu item replaces Google’s whole menu', () => {
    render(<Table />);

    expect(screen.getByText('Google replaces its whole menu.')).toBeInTheDocument();
    expect(screen.getAllByText('Not on your menu').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not on Google').length).toBeGreaterThan(0);
  });

  it('shows list values as text and flags fields changed on both sides', () => {
    render(<Table />);

    expect(screen.getByText('Nepalese restaurant, Restaurant')).toBeInTheDocument();
    expect(screen.getByText('Changed on both · High-risk')).toBeInTheDocument();
  });

  it('turns Send to Google off everywhere while something blocks writes', () => {
    render(<Table sendBlockReason="Google writes are off." />);

    for (const radio of screen.getAllByRole('radio', { name: 'Send to Google' })) {
      expect(radio).toBeDisabled();
    }
  });
});
