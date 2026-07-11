import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const driftContextState = vi.hoisted(() => ({
  value: null as null | { openCompare: ReturnType<typeof vi.fn>; fieldViews: unknown[]; isLoading: boolean },
}));

vi.mock('@/components/features/restaurant-settings/gbp-drift/useGbpDrift', () => ({
  useOptionalGbpDrift: () => driftContextState.value,
  useGbpDrift: () => driftContextState.value,
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: { data: null, isLoading: false, isError: false, error: null },
  }),
}));

import { GbpDriftBadge } from '@/components/features/restaurant-settings/gbpDriftBadges';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function makeField(fieldKey: string, label: string): DualSyncFieldSummary {
  return {
    fieldKey,
    sectionKey: 'operatingHours',
    label,
  } as DualSyncFieldSummary;
}

describe('GbpDriftBadge', () => {
  beforeEach(() => {
    driftContextState.value = null;
  });

  it('@contract renders nothing when no drifted fields are supplied', () => {
    const { container } = render(<GbpDriftBadge fields={[null, undefined]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract @a11y names a single-field badge after the drifted field', () => {
    render(<GbpDriftBadge fields={[makeField('operatingHours.monday', 'Monday hours')]} />);

    const button = screen.getByRole('button', { name: 'Google review: Monday hours' });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Google review');
  });

  it('@contract counts multiple drifted fields and opens the compare dialog via context', async () => {
    const user = userEvent.setup();
    const openCompare = vi.fn();
    driftContextState.value = { openCompare, fieldViews: [], isLoading: false };

    render(
      <GbpDriftBadge
        fields={[
          makeField('operatingHours.monday', 'Monday hours'),
          makeField('operatingHours.tuesday', 'Tuesday hours'),
        ]}
      />,
    );

    const button = screen.getByRole('button', { name: 'Google review: 2 fields' });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('2 reviews');

    await user.click(button);
    expect(openCompare).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'drifted_only', sectionKeys: ['operatingHours'] }),
    );
  });
});
