import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  EmptyGbpConnectionSection,
  ErrorGbpSection,
  LoadingGbpSection,
  NoRestaurantGbpSection,
} from '@/components/features/restaurant-settings/google-business-profile/sections/GbpStateSections';

describe('GbpStateSections', () => {
  it('@smoke prompts for a restaurant in the no-restaurant state', () => {
    render(<NoRestaurantGbpSection />);

    expect(
      screen.getByText(/Select a restaurant using the sidebar switcher/),
    ).toBeInTheDocument();
  });

  it('@smoke @a11y announces the loading state as busy status', () => {
    render(<LoadingGbpSection />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('@contract renders the load error with a working retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorGbpSection error={new Error('Connection fetch failed')} onRetry={onRetry} />);

    expect(screen.getByText('Unable to load Google Business Profile')).toBeInTheDocument();
    expect(screen.getByText('Connection fetch failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@smoke renders the empty connection copy', () => {
    render(<EmptyGbpConnectionSection />);

    expect(
      screen.getByText(/connection details are not available for this restaurant yet/),
    ).toBeInTheDocument();
  });
});
