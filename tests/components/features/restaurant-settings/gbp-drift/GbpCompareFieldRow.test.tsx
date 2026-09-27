import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const driftState = vi.hoisted(() => ({
  applyFieldFromGoogle: vi.fn(),
  isApplying: false,
}));

vi.mock('@/components/features/restaurant-settings/gbp-drift/useGbpDrift', () => ({
  useGbpDrift: () => driftState,
  useOptionalGbpDrift: () => driftState,
}));

import { GbpCompareFieldRow } from '@/components/features/restaurant-settings/gbp-drift/GbpCompareFieldRow';

import type { GbpDriftFieldView } from '@/components/features/restaurant-settings/gbp-drift/types';

function makeView(over: Record<string, unknown> = {}): GbpDriftFieldView {
  return {
    fieldKey: 'profile.name',
    sectionKey: 'profile',
    label: 'Business name',
    helpText: 'Shown on the public profile.',
    effectiveStatus: 'drifted',
    localValue: 'Old Crown Girton',
    gbpValue: 'Old Crown',
    canImport: true,
    field: { capability: { blockedReasons: [] } },
    ...over,
  } as unknown as GbpDriftFieldView;
}

describe('GbpCompareFieldRow', () => {
  it('preserves exact structured values before an inline import', async () => {
    const value = { displayName: 'Restaurant', categoryCode: 'gcid:restaurant', isPrimary: true };
    const { container } = render(<GbpCompareFieldRow view={makeView({ gbpValue: value })} />);
    expect(screen.getByText('Restaurant · Primary category')).toBeVisible();
    expect(container.querySelector('summary')).toHaveAccessibleName(
      'View source details: Google · Business name',
    );
    await userEvent.click(screen.getByText('View source details'));
    expect(container.querySelector('details')).toHaveAttribute('open');
    expect(JSON.parse(container.querySelector('pre')?.textContent ?? '')).toEqual(value);
  });
  beforeEach(() => {
    driftState.applyFieldFromGoogle = vi.fn();
    driftState.isApplying = false;
  });

  it('@contract renders both sides of a drifted field with the drift badge', () => {
    render(<GbpCompareFieldRow view={makeView()} />);

    expect(screen.getByText('Business name')).toBeInTheDocument();
    expect(screen.getByText('Differs from Google')).toBeInTheDocument();
    expect(screen.getByText('Old Crown Girton')).toBeInTheDocument();
    expect(screen.getByText('Old Crown')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit locally/ })).toBeInTheDocument();
  });

  it('@contract applies the Google value for an importable drifted field', async () => {
    const user = userEvent.setup();
    render(<GbpCompareFieldRow view={makeView()} />);

    await user.click(screen.getByRole('button', { name: /Use Google Info/ }));

    expect(driftState.applyFieldFromGoogle).toHaveBeenCalledWith('profile.name');
  });

  it('@contract disables the import action for synced fields', () => {
    render(<GbpCompareFieldRow view={makeView({ effectiveStatus: 'in_sync' })} />);

    expect(screen.getByText('Matches Google')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use Google Info/ })).toBeDisabled();
  });

  it('@contract explains blocked imports with the capability reasons', () => {
    render(
      <GbpCompareFieldRow
        view={makeView({
          canImport: false,
          field: { capability: { blockedReasons: ['Google-owned metadata is read-only.'] } },
        })}
      />,
    );

    expect(screen.getByRole('button', { name: /Use Google Info/ })).toBeDisabled();
    expect(screen.getByText('Google-owned metadata is read-only.')).toBeInTheDocument();
  });
});
