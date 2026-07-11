import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  StatusBadge,
  connectionStatusBadge,
} from '@/components/features/restaurant-settings/google-business-profile/components/StatusBadge';

describe('StatusBadge', () => {
  it('@smoke renders the label for a tone', () => {
    render(<StatusBadge tone="verified" label="Linked" />);

    expect(screen.getByText('Linked')).toBeInTheDocument();
  });

  it('@contract maps connection statuses to tones and labels', () => {
    expect(connectionStatusBadge('linked')).toEqual({ tone: 'verified', label: 'Linked' });
    expect(connectionStatusBadge('sync_error')).toEqual({ tone: 'error', label: 'Sync issue' });
    expect(connectionStatusBadge('reauth_required')).toEqual({
      tone: 'error',
      label: 'Reconnect needed',
    });
    expect(connectionStatusBadge('authorized')).toEqual({
      tone: 'pending',
      label: 'Choose location',
    });
    expect(connectionStatusBadge('unlinked')).toEqual({ tone: 'muted', label: 'Not connected' });
  });

  it('@contract can hide the tone icon', () => {
    const { container } = render(<StatusBadge tone="muted" label="Not connected" showIcon={false} />);

    expect(container.querySelector('svg')).toBeNull();
  });
});
