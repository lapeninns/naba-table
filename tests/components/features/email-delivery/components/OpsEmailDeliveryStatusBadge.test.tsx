import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryStatusBadge } from '@/components/features/email-delivery/components/OpsEmailDeliveryStatusBadge';
import { EMAIL_DELIVERY_STATUS_VALUES } from '@/types/emailDelivery';
import { EMAIL_DELIVERY_STATUS_LABELS } from '@src/lib/email-delivery/presentation';

describe('OpsEmailDeliveryStatusBadge', () => {
  it('@smoke renders the centralized label for every delivery status', () => {
    for (const status of EMAIL_DELIVERY_STATUS_VALUES) {
      const { unmount } = render(<OpsEmailDeliveryStatusBadge status={status} />);
      expect(screen.getByText(EMAIL_DELIVERY_STATUS_LABELS[status])).toBeInTheDocument();
      unmount();
    }
  });

  it('@smoke maps terminal failure statuses to the destructive badge treatment', () => {
    render(<OpsEmailDeliveryStatusBadge status="failed" />);
    const failedBadge = screen.getByText(EMAIL_DELIVERY_STATUS_LABELS.failed);
    render(<OpsEmailDeliveryStatusBadge status="delivered" />);
    const deliveredBadge = screen.getByText(EMAIL_DELIVERY_STATUS_LABELS.delivered);

    // Delivered uses the outline+primary tone, failures the destructive variant;
    // the two must not share the same class treatment.
    expect(failedBadge.className).not.toEqual(deliveredBadge.className);
  });
});
