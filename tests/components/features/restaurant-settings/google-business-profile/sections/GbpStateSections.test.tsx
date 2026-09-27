import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  EmptyGbpConnectionSection,
  ErrorGbpSection,
  LoadingGbpSection,
  NoRestaurantGbpSection,
} from '@/components/features/restaurant-settings/google-business-profile/sections/GbpStateSections';
import { HttpError } from '@/lib/http/errors';

describe('GbpStateSections', () => {
  it('@smoke prompts for a restaurant in the no-restaurant state', () => {
    render(<NoRestaurantGbpSection />);

    expect(screen.getByRole('heading', { name: 'Select a restaurant' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Choose a restaurant with the sidebar switcher to manage its Google Business Profile connection.',
      ),
    ).toBeInTheDocument();
  });

  it('@smoke @a11y announces the loading state as busy status', () => {
    render(<LoadingGbpSection />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading Google Business Profile');
  });

  it('@contract renders the load error as a reason code with a working retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const error = new HttpError({
      status: 500,
      message: 'SECRET_DB_DETAIL relation "x" does not exist',
    });
    const { container } = render(<ErrorGbpSection error={error} onRetry={onRetry} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Couldn’t load Google Business Profile');
    expect(alert).toHaveTextContent('Your saved settings are unchanged. Reason code HTTP_500');
    expect(screen.getByText('HTTP_500')).toHaveClass('font-mono');
    // A bare alert, not an alert nested in a card.
    expect(container.firstElementChild).toBe(alert);
    expect(document.body.textContent).not.toContain('SECRET_DB_DETAIL');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@smoke renders the empty connection copy', () => {
    render(<EmptyGbpConnectionSection />);

    expect(
      screen.getByText(/connection details are not available for this restaurant yet/),
    ).toBeInTheDocument();
  });
});
