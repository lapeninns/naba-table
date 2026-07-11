import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const driftState = vi.hoisted(() => ({
  current: {
    isLinked: true,
    isLoading: false,
    totalDriftCount: 0,
    openCompare: vi.fn(),
  },
}));

vi.mock('@/components/features/restaurant-settings/gbp-drift/useGbpDrift', () => ({
  useGbpDrift: () => driftState.current,
  useOptionalGbpDrift: () => driftState.current,
}));

import { GbpDriftStatusStrip } from '@/components/features/restaurant-settings/gbp-drift/GbpDriftStatusStrip';

describe('GbpDriftStatusStrip', () => {
  beforeEach(() => {
    driftState.current = {
      isLinked: true,
      isLoading: false,
      totalDriftCount: 0,
      openCompare: vi.fn(),
    };
  });

  it('@contract renders nothing while Google is not linked', () => {
    driftState.current.isLinked = false;
    const { container } = render(<GbpDriftStatusStrip />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract reports the in-sync state with an all-fields comparison', async () => {
    const user = userEvent.setup();
    render(<GbpDriftStatusStrip />);

    expect(
      screen.getByText('Nabatable and Google are in sync for comparable fields.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Compare with Google/ }));
    expect(driftState.current.openCompare).toHaveBeenCalledWith({ filter: 'all' });
  });

  it('@contract counts drifted fields and opens the drifted-only comparison', async () => {
    const user = userEvent.setup();
    driftState.current.totalDriftCount = 3;
    render(<GbpDriftStatusStrip />);

    expect(screen.getByText('3 fields need review.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Compare with Google/ }));
    expect(driftState.current.openCompare).toHaveBeenCalledWith({ filter: 'drifted_only' });
  });

  it('@contract renders the compact strip variant', () => {
    driftState.current.totalDriftCount = 1;
    render(<GbpDriftStatusStrip compact />);

    expect(screen.getByText('1 field differ from Google.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compare/ })).toBeInTheDocument();
  });
});
