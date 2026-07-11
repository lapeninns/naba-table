import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncFieldBlockedReasons } from '@/components/features/restaurant-settings/dual-sync/DualSyncFieldBlockedReasons';

describe('DualSyncFieldBlockedReasons', () => {
  it('@smoke renders nothing when there are no reasons', () => {
    const { container } = render(<DualSyncFieldBlockedReasons reasons={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@smoke lists each blocked reason', () => {
    render(
      <DualSyncFieldBlockedReasons
        reasons={['Google-owned metadata is not writable.', 'Export requires manual review.']}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Google-owned metadata is not writable.');
  });
});
