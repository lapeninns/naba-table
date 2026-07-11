import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryTableSortIndicator } from '@/components/features/email-delivery/components/OpsEmailDeliveryTableSortIndicator';

describe('OpsEmailDeliveryTableSortIndicator', () => {
  it('@smoke renders the neutral both-ways arrow when the column is not the active sort', () => {
    const { container } = render(
      <OpsEmailDeliveryTableSortIndicator
        column="status"
        sortState={{ column: 'sentAt', direction: 'desc' }}
      />,
    );

    expect(container.querySelector('svg.lucide-arrow-up-down')).not.toBeNull();
  });

  it('@smoke renders the up arrow for the active ascending column and the down arrow for descending', () => {
    const asc = render(
      <OpsEmailDeliveryTableSortIndicator
        column="sentAt"
        sortState={{ column: 'sentAt', direction: 'asc' }}
      />,
    );
    expect(asc.container.querySelector('svg.lucide-arrow-up')).not.toBeNull();

    const desc = render(
      <OpsEmailDeliveryTableSortIndicator
        column="sentAt"
        sortState={{ column: 'sentAt', direction: 'desc' }}
      />,
    );
    expect(desc.container.querySelector('svg.lucide-arrow-down')).not.toBeNull();
  });
});
