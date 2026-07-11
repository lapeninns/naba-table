import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GuestDietaryBadge } from '@/components/features/dashboard/booking-details/components/guest/GuestDietaryBadge';

describe('GuestDietaryBadge', () => {
  it('@contract renders nothing when there are no dietary entries', () => {
    const { container } = render(
      <GuestDietaryBadge allergies={null} dietaryRestrictions={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract counts allergies and restrictions together in the badge label', () => {
    render(
      <GuestDietaryBadge allergies={['Nuts', 'Shellfish']} dietaryRestrictions={['Vegan']} />,
    );

    expect(screen.getByText('Dietary (3)')).toBeInTheDocument();
  });

  it('@contract opens the popover listing each section', async () => {
    const user = userEvent.setup();
    render(<GuestDietaryBadge allergies={['Nuts']} dietaryRestrictions={['Vegan']} />);

    await user.click(screen.getByRole('button', { name: /Dietary \(2\)/ }));

    expect(await screen.findByText('Dietary details')).toBeInTheDocument();
    expect(screen.getByText('Allergies')).toBeInTheDocument();
    expect(screen.getByText('Nuts')).toBeInTheDocument();
    expect(screen.getByText('Dietary restrictions')).toBeInTheDocument();
    expect(screen.getByText('Vegan')).toBeInTheDocument();
  });

  it('@contract omits the empty section from the popover', async () => {
    const user = userEvent.setup();
    render(<GuestDietaryBadge allergies={['Nuts']} dietaryRestrictions={null} />);

    await user.click(screen.getByRole('button', { name: /Dietary \(1\)/ }));

    expect(await screen.findByText('Allergies')).toBeInTheDocument();
    expect(screen.queryByText('Dietary restrictions')).not.toBeInTheDocument();
  });
});
