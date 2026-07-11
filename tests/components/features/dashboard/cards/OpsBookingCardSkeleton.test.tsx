import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsBookingCardSkeleton } from '@/components/features/dashboard/cards/OpsBookingCardSkeleton';

describe('OpsBookingCardSkeleton', () => {
  it('@smoke renders a card of loading placeholders without throwing', () => {
    const { container } = render(<OpsBookingCardSkeleton />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(10);
    expect(container.textContent).toBe('');
  });
});
