import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ProfileGoogleCard,
  ProfileReadinessPanel,
  ProfileReadinessSummary,
} from '@/components/features/restaurant-settings/profile/ProfileStatusBar';

import type { ReadinessChecklistItem } from '@/components/features/restaurant-settings/restaurantProfileModel';

const GOOGLE_HREF = '/app/settings/restaurant/google-business-profile#gbp-connection';

function items(
  missing: ReadonlyArray<ReadinessChecklistItem['key']> = [],
): ReadinessChecklistItem[] {
  const all: Array<Omit<ReadinessChecklistItem, 'complete'>> = [
    { key: 'name', label: 'Restaurant name', required: true },
    { key: 'bookingUrl', label: 'Booking page link', required: true },
    { key: 'contactPhone', label: 'Public phone', required: true },
    { key: 'timezone', label: 'Timezone', required: true },
    { key: 'logo', label: 'Logo', required: false },
    { key: 'description', label: 'Business description', required: false },
    { key: 'contactEmail', label: 'Contact email', required: false },
    { key: 'address', label: 'Address', required: false },
    { key: 'mapUrl', label: 'Google Maps link', required: false },
  ];
  return all.map((item) => ({ ...item, complete: !missing.includes(item.key) }));
}

describe('ProfileReadinessPanel', () => {
  it('counts filled-in details and lists required ones first, optional ones marked', () => {
    render(<ProfileReadinessPanel items={items(['logo', 'address'])} onFocusItem={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Profile readiness' })).toBeInTheDocument();
    expect(screen.getByText('7 of 9 details filled in.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '7 of 9 details filled in' })).toBeInTheDocument();
    expect(screen.getByText('Everything guests need is filled in')).toBeInTheDocument();

    const rows = within(screen.getByRole('list', { name: 'Profile details' })).getAllByRole(
      'listitem',
    );
    expect(rows).toHaveLength(9);
    expect(rows[0]).toHaveTextContent(/^Restaurant name, filled in$/);
    expect(rows[4]).toHaveTextContent(/Logo, missingOptional/);
    expect(within(rows[0]).queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers "Add" for each missing detail and passes its key', async () => {
    const user = userEvent.setup();
    const onFocusItem = vi.fn();
    render(
      <ProfileReadinessPanel items={items(['bookingUrl', 'logo'])} onFocusItem={onFocusItem} />,
    );

    expect(screen.getByText('1 detail needed before guests can book')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Booking page link' }));
    await user.click(screen.getByRole('button', { name: 'Add Logo' }));
    expect(onFocusItem.mock.calls).toEqual([['bookingUrl'], ['logo']]);
  });
});

describe('ProfileReadinessSummary', () => {
  it('shows the count and "Add" links for missing required details only', async () => {
    const user = userEvent.setup();
    const onFocusItem = vi.fn();
    render(
      <ProfileReadinessSummary
        items={items(['bookingUrl', 'contactPhone', 'logo'])}
        onFocusItem={onFocusItem}
      />,
    );

    expect(screen.getByText('2 details needed before guests can book')).toBeInTheDocument();
    expect(screen.getByText('6 of 9 filled in')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /logo/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add public phone' }));
    expect(onFocusItem).toHaveBeenCalledWith('contactPhone');
  });
});

describe('ProfileGoogleCard', () => {
  it('links Google when not linked and offers compare only when linked with differences', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ProfileGoogleCard googleLinked={false} googleDetail="Optional." googleHref={GOOGLE_HREF} />,
    );

    expect(screen.getByText('Not linked')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Link Google Business Profile' })).toHaveAttribute(
      'href',
      GOOGLE_HREF,
    );
    unmount();

    const onCompareWithGoogle = vi.fn();
    render(
      <ProfileGoogleCard
        googleLinked
        googleDetail="Linked."
        googleHref={GOOGLE_HREF}
        gbpDriftCount={2}
        onCompareWithGoogle={onCompareWithGoogle}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Compare with Google (2)' }));
    expect(onCompareWithGoogle).toHaveBeenCalledTimes(1);
  });
});
