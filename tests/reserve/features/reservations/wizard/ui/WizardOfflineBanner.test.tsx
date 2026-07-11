import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { WizardOfflineBanner } from '@features/reservations/wizard/ui/WizardOfflineBanner';

describe('WizardOfflineBanner', () => {
  it('announces offline status politely with default copy @smoke', () => {
    render(<WizardOfflineBanner />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('You’re offline')).toBeInTheDocument();
    expect(
      screen.getByText(
        'We’ll keep your selections safe, but confirmation actions are disabled until you reconnect.',
      ),
    ).toBeInTheDocument();
  });

  it('accepts custom copy and a focusable ref @smoke', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<WizardOfflineBanner ref={ref} title="No connection" description="Reconnect to confirm." />);

    expect(screen.getByText('No connection')).toBeInTheDocument();
    expect(screen.getByText('Reconnect to confirm.')).toBeInTheDocument();
    expect(ref.current).toBe(screen.getByRole('status'));
    expect(ref.current).toHaveAttribute('tabindex', '-1');
  });
});
