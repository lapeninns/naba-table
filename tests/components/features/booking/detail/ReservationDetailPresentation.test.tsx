import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ReservationDetailActionControls,
  ReservationDetailErrorState,
  ReservationDetailLoadingState,
} from '@/components/features/booking/detail/ReservationDetailPresentation';

describe('ReservationDetailPresentation', () => {
  it('@smoke renders the loading state skeletons without throwing', () => {
    const { container } = render(<ReservationDetailLoadingState />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('@contract renders the error state description and fires onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ReservationDetailErrorState
        description="We could not load this reservation."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('We could not load this reservation.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to dashboard' })).toHaveAttribute(
      'href',
      '/guest/dashboard',
    );

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each(['summary', 'mobile'] as const)(
    '@contract fires download, share, and calendar callbacks in the %s layout',
    async (layout) => {
      const user = userEvent.setup();
      const onDownload = vi.fn();
      const onShare = vi.fn();
      const onAddToCalendar = vi.fn();

      render(
        <ReservationDetailActionControls
          layout={layout}
          onDownload={onDownload}
          onShare={onShare}
          onAddToCalendar={onAddToCalendar}
        />,
      );

      await user.click(screen.getByRole('button', { name: /PDF/ }));
      expect(onDownload).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: /Share/ }));
      expect(onShare).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: /Add to calendar/ }));
      expect(onAddToCalendar).toHaveBeenCalledTimes(1);
    },
  );
});
