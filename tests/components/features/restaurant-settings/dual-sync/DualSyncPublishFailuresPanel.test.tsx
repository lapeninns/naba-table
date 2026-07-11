import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishFailuresPanel } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishFailuresPanel';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

describe('DualSyncPublishFailuresPanel', () => {
  it('@contract renders nothing without failures', () => {
    const { container } = render(<DualSyncPublishFailuresPanel failures={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract lists field failure codes with messages', () => {
    const failures = [
      {
        fieldKey: 'profile.phone',
        failure: { code: 'GBP_WRITE_REJECTED', message: 'Google rejected the phone format.' },
      },
    ] as unknown as DualSyncPublishResponse['failures'];
    render(<DualSyncPublishFailuresPanel failures={failures} />);

    expect(screen.getByText('Failure codes')).toBeInTheDocument();
    expect(screen.getByText('profile.phone')).toBeInTheDocument();
    expect(screen.getByText(/GBP_WRITE_REJECTED: Google rejected the phone format\./)).toBeInTheDocument();
  });
});
