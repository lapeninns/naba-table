import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishOperationGroupsTable } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishOperationGroupsTable';

import type { DualSyncPublishOperationGroup } from '@/server/dual-sync';

const group = {
  id: 'group-1',
  restaurantId: 'restaurant-1',
  publishBatchId: 'batch-1',
  groupKey: 'profile:export',
  sectionKey: 'profile',
  direction: 'export_to_google',
  writeGroup: 'location.profile',
  status: 'succeeded',
  riskLevel: 'high',
  requiresPreflight: true,
  requiresManualConfirmation: true,
  destructiveWritePossible: false,
  googleUpdateMasks: ['title'],
  decisionCount: 2,
  preflightStatus: 'passed',
  preflightResult: null,
  requestSummary: null,
  responseSummary: null,
  errorCode: null,
  errorMessage: null,
  startedAt: '2026-05-09T12:00:00.000Z',
  finishedAt: '2026-05-09T12:00:01.000Z',
} as unknown as DualSyncPublishOperationGroup;

describe('DualSyncPublishOperationGroupsTable', () => {
  it('@contract renders nothing without groups', () => {
    const { container } = render(<DualSyncPublishOperationGroupsTable groups={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract renders a row per operation group with write group and counts', () => {
    render(<DualSyncPublishOperationGroupsTable groups={[group]} />);

    expect(screen.getByText('location.profile')).toBeInTheDocument();
    expect(screen.getByText('succeeded')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
