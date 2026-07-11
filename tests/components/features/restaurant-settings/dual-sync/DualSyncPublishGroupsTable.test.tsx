import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishGroupsTable } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishGroupsTable';

import type { DualSyncPublishGroup } from '@/server/dual-sync/publish/types';

const groups = [
  {
    groupId: 'group-1',
    sectionKey: 'profile',
    writeGroup: 'location.profile',
    direction: 'export',
    riskLevel: 'critical',
    googleUpdateMasks: ['title'],
    fields: [{ fieldKey: 'profile.name' }],
  },
] as unknown as ReadonlyArray<DualSyncPublishGroup>;

describe('DualSyncPublishGroupsTable', () => {
  it('@contract renders nothing without groups', () => {
    const { container } = render(<DualSyncPublishGroupsTable groups={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract renders one row per publish group with direction and risk', () => {
    render(<DualSyncPublishGroupsTable groups={groups} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('location.profile')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
