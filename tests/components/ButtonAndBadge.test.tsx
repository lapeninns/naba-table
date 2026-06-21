import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BookingStatusBadge } from '@/components/features/booking-state-machine/BookingStatusBadge';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('defaults native buttons to type=button', () => {
    render(<Button>Open dialog</Button>);

    expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveAttribute('type', 'button');
  });

  it('preserves an explicit submit type', () => {
    render(<Button type="submit">Save form</Button>);

    expect(screen.getByRole('button', { name: 'Save form' })).toHaveAttribute('type', 'submit');
  });

  it('does not force a type attribute when rendered asChild', () => {
    render(
      <Button asChild>
        <a href="/app/dashboard">Go to dashboard</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Go to dashboard' })).not.toHaveAttribute('type');
  });
});

describe('BookingStatusBadge', () => {
  it('does not create an extra keyboard stop for non-actionable badges', () => {
    render(<BookingStatusBadge status="confirmed" showTooltip={false} />);

    expect(screen.getByRole('status', { name: 'Confirmed status' })).not.toHaveAttribute(
      'tabindex',
    );
  });
});
