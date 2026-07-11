import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncOperationsContent } from '@/components/features/restaurant-settings/dual-sync/panels/operations/DualSyncOperationsContent';

import { makeDualSyncPublishOperation } from '../../../testUtils';

import type { DualSyncPublishOperation } from '@/server/dual-sync';

describe('DualSyncOperationsContent', () => {
  it('@smoke renders the operations table with one row per operation', () => {
    const operations = [
      makeDualSyncPublishOperation(),
      makeDualSyncPublishOperation({ id: 'op-2', fieldKey: 'profile.phone' }),
    ] as unknown as ReadonlyArray<DualSyncPublishOperation>;
    render(<DualSyncOperationsContent operations={operations} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('profile.name')).toBeInTheDocument();
    expect(screen.getByText('profile.phone')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
  });
});
