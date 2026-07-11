import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const driftState = vi.hoisted(() => ({
  current: null as null | Record<string, unknown>,
}));

vi.mock('@/components/features/restaurant-settings/gbp-drift/useGbpDrift', () => ({
  useOptionalGbpDrift: () => driftState.current,
  useGbpDrift: () => driftState.current,
}));

import { GbpDriftFieldBadge } from '@/components/features/restaurant-settings/gbp-drift/GbpDriftFieldBadge';

function makeDrift(effectiveStatus: 'drifted' | 'in_sync') {
  return {
    isLinked: true,
    openCompare: vi.fn(),
    fieldViewByKey: new Map([
      [
        'profile.name',
        { fieldKey: 'profile.name', sectionKey: 'profile', label: 'Business name', effectiveStatus },
      ],
    ]),
  };
}

describe('GbpDriftFieldBadge', () => {
  beforeEach(() => {
    driftState.current = null;
  });

  it('@contract renders nothing without a linked drift context or view', () => {
    const { container } = render(<GbpDriftFieldBadge fieldKey="profile.name" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract @a11y shows the drift state and opens the field comparison', async () => {
    const user = userEvent.setup();
    driftState.current = makeDrift('drifted');
    render(<GbpDriftFieldBadge fieldKey="profile.name" />);

    const button = screen.getByRole('button', { name: 'Compare Business name with Google' });
    expect(button).toHaveTextContent('Drifted from GBP');

    await user.click(button);
    expect(driftState.current.openCompare).toHaveBeenCalledWith(
      expect.objectContaining({ fieldKey: 'profile.name', sectionKey: 'profile' }),
    );
  });

  it('@contract shows the synced badge for in-sync fields', () => {
    driftState.current = makeDrift('in_sync');
    render(<GbpDriftFieldBadge fieldKey="profile.name" />);

    expect(screen.getByText('Synced with GBP')).toBeInTheDocument();
  });
});
