import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncOperationDirectionCell } from '@/components/features/restaurant-settings/dual-sync/panels/operations/DualSyncOperationDirectionCell';

describe('DualSyncOperationDirectionCell', () => {
  it('@smoke labels exports and imports with their direction icon', () => {
    const { container } = render(
      <>
        <DualSyncOperationDirectionCell direction="export_to_google" />
        <DualSyncOperationDirectionCell direction="import_from_google" />
      </>,
    );

    expect(screen.getByText(/Export/i)).toBeInTheDocument();
    expect(screen.getByText(/Import/i)).toBeInTheDocument();
    expect(container.querySelectorAll('svg').length).toBe(2);
  });
});
