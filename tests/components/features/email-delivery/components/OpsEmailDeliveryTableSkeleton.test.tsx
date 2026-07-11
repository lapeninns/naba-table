import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryTableSkeleton } from '@/components/features/email-delivery/components/OpsEmailDeliveryTableSkeleton';

describe('OpsEmailDeliveryTableSkeleton', () => {
  it('@smoke @a11y renders a labeled loading placeholder with skeleton rows', () => {
    render(<OpsEmailDeliveryTableSkeleton />);

    const wrapper = screen.getByLabelText('Loading email delivery attempts');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.childElementCount).toBe(5);
  });
});
