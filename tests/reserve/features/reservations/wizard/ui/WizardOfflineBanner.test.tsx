import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { WizardOfflineBanner } from '@features/reservations/wizard/ui/WizardOfflineBanner';

describe('WizardOfflineBanner', () => {
  it('announces offline status politely with default copy @smoke', () => {
    render(<WizardOfflineBanner />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(banner).toHaveAttribute('aria-atomic', 'true');

    const title = screen.getByText('You’re offline');
    const description = screen.getByText(
      'We’ll keep your selections safe, but confirmation actions are disabled until you reconnect.',
    );
    expect(banner).toHaveAttribute('aria-labelledby', title.id);
    expect(banner).toHaveAttribute('aria-describedby', description.id);
  });

  it('accepts custom copy and a focusable ref @smoke', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <WizardOfflineBanner ref={ref} title="No connection" description="Reconnect to confirm." />,
    );

    expect(screen.getByText('No connection')).toBeInTheDocument();
    expect(screen.getByText('Reconnect to confirm.')).toBeInTheDocument();
    expect(ref.current).toBe(screen.getByRole('status'));
    expect(ref.current).toHaveAttribute('tabindex', '-1');
  });

  it('keeps an optional recovery action keyboard reachable without changing its behavior', () => {
    render(<WizardOfflineBanner action={<button type="button">Check connection</button>} />);

    const action = screen.getByRole('button', { name: 'Check connection' });
    expect(action).toBeEnabled();
    expect(action.closest('[data-wizard-offline-action]')).not.toBeNull();
  });
});
