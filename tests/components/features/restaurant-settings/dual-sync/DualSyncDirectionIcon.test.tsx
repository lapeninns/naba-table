import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncDirectionIcon } from '@/components/features/restaurant-settings/dual-sync/DualSyncDirectionIcon';

describe('DualSyncDirectionIcon', () => {
  it('@smoke renders the export arrow for exports and the import arrow otherwise', () => {
    const { container: exportContainer } = render(
      <DualSyncDirectionIcon iconKey="export" className="size-3" />,
    );
    const { container: importContainer } = render(<DualSyncDirectionIcon iconKey="import" />);

    expect(exportContainer.querySelector('svg.lucide-arrow-up-from-line')).not.toBeNull();
    expect(exportContainer.querySelector('svg')).toHaveClass('size-3');
    expect(importContainer.querySelector('svg.lucide-arrow-down-to-line')).not.toBeNull();
  });
});
