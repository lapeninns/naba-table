import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuestPageShell, GuestPageSection, GuestSurfaceCard } from '@/components/guest/ui/GuestPrimitives';

describe('guest shell foundation', () => {
  it('renders page shell with bounded layout slots', () => {
    render(
      <GuestPageShell
        hero={
          <div data-testid="hero">
            <h1>Welcome back</h1>
          </div>
        }
      >
        <div data-testid="body">Body content</div>
      </GuestPageShell>,
    );

    expect(screen.getByTestId('hero').closest('section')).toHaveClass('guest-shell-hero');
    expect(screen.getByTestId('body').parentElement).toHaveClass('guest-shell-content');
  });

  it('applies canonical section and surface card variants', () => {
    render(
      <GuestPageSection
        title="Plan your next table"
        description="Everything stays inside the guest shell."
      >
        <GuestSurfaceCard data-testid="surface-card">Card body</GuestSurfaceCard>
      </GuestPageSection>,
    );

    expect(screen.getByText('Plan your next table').closest('section')).toHaveClass('guest-section');
    expect(screen.getByTestId('surface-card')).toHaveClass('guest-surface-card');
  });
});
