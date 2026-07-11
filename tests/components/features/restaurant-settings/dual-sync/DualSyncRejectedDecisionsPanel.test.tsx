import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncRejectedDecisionsPanel } from '@/components/features/restaurant-settings/dual-sync/DualSyncRejectedDecisionsPanel';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

describe('DualSyncRejectedDecisionsPanel', () => {
  it('@contract renders nothing without rejected decisions', () => {
    const { container } = render(<DualSyncRejectedDecisionsPanel rejected={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract lists rejected decisions with their failure details', () => {
    const rejected = [
      {
        fieldKey: 'profile.website',
        action: 'export',
        failure: { code: 'FIELD_NOT_EXPORTABLE', message: 'This field cannot be exported.' },
      },
    ] as unknown as DualSyncPublishPlan['rejected'];
    render(<DualSyncRejectedDecisionsPanel rejected={rejected} />);

    expect(screen.getByText('Rejected decisions')).toBeInTheDocument();
    expect(screen.getByText('profile.website')).toBeInTheDocument();
    expect(screen.getByText(/FIELD_NOT_EXPORTABLE: This field cannot be exported\./)).toBeInTheDocument();
  });
});
