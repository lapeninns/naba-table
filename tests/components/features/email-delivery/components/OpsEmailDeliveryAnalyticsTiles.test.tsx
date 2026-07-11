import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryAnalyticsTiles } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalyticsTiles';

import type { OpsEmailAnalyticsTile } from '@/components/features/email-delivery/opsEmailDeliveryAnalyticsDomain';

const tiles: OpsEmailAnalyticsTile[] = [
  {
    key: 'total',
    label: 'Total Attempts',
    value: '42',
    hint: 'Across the selected analytics window',
    toneClass: 'border-border bg-muted/40',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    value: '40',
    hint: '95% delivery rate',
    toneClass: 'border-primary/20 bg-primary/10',
  },
];

describe('OpsEmailDeliveryAnalyticsTiles', () => {
  it('@smoke renders one tile per model entry with label, value, and hint', () => {
    render(<OpsEmailDeliveryAnalyticsTiles tiles={tiles} />);

    expect(screen.getByText('Total Attempts')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Across the selected analytics window')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('95% delivery rate')).toBeInTheDocument();
  });

  it('@smoke renders an empty grid without throwing when there are no tiles', () => {
    const { container } = render(<OpsEmailDeliveryAnalyticsTiles tiles={[]} />);

    expect(container.firstElementChild).not.toBeNull();
    expect(container.firstElementChild?.childElementCount).toBe(0);
  });
});
