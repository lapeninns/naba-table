import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncFailureCodesPanel } from '@/components/features/restaurant-settings/dual-sync/panels/health/DualSyncFailureCodesPanel';

describe('DualSyncFailureCodesPanel', () => {
  it('@smoke shows the empty message without failure codes', () => {
    render(<DualSyncFailureCodesPanel failureCounts={[]} />);

    expect(screen.getByText('No failure codes in this window.')).toBeInTheDocument();
  });

  it('@smoke renders a badge per failure code with its count', () => {
    render(
      <DualSyncFailureCodesPanel
        failureCounts={[
          ['QUOTA_LIMITED', 3],
          ['REAUTH_REQUIRED', 1],
        ]}
      />,
    );

    expect(screen.getByText('QUOTA_LIMITED: 3')).toBeInTheDocument();
    expect(screen.getByText('REAUTH_REQUIRED: 1')).toBeInTheDocument();
  });
});
