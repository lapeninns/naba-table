import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailQueueLoadingTable } from '@/components/features/email-delivery/components/OpsEmailQueueLoadingTable';

describe('OpsEmailQueueLoadingTable', () => {
  it('@smoke @a11y renders a labeled loading placeholder for the queue table', () => {
    render(<OpsEmailQueueLoadingTable />);

    expect(screen.getByLabelText('Loading email queue')).toBeInTheDocument();
  });
});
