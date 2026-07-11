import { render, screen } from '@testing-library/react';
import { Store } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { SetupChecklistCard } from '@/components/features/restaurant-settings/overview/SetupChecklistCard';

import type { SetupCard } from '@/components/features/restaurant-settings/overview/buildSetupCards';

function makeCard(over: Partial<SetupCard> = {}): SetupCard {
  return {
    key: 'profile',
    title: 'Restaurant profile',
    description: 'Name, story, and contact details guests see.',
    detail: '3 of 5 fields complete.',
    status: 'attention',
    cta: 'Finish profile',
    href: '/app/settings/restaurant/profile',
    Icon: Store,
    ...over,
  } as SetupCard;
}

describe('SetupChecklistCard', () => {
  it('@smoke renders the card copy with its status badge and CTA link', () => {
    render(<SetupChecklistCard card={makeCard()} index={0} />);

    expect(screen.getByText('Restaurant profile')).toBeInTheDocument();
    expect(screen.getByText('3 of 5 fields complete.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Finish profile' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/profile',
    );
  });

  it('@contract labels complete and optional statuses distinctly', () => {
    render(
      <>
        <SetupChecklistCard card={makeCard({ key: 'a', status: 'complete' })} index={0} />
        <SetupChecklistCard card={makeCard({ key: 'b', status: 'optional' })} index={1} />
      </>,
    );

    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });
});
