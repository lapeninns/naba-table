import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishJobsContent } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobsContent';

import { makeDualSyncPublishJobRollup } from '../../../testUtils';

import type { DualSyncPublishJobRollup } from '@/server/dual-sync/publish/operations';

describe('DualSyncPublishJobsContent', () => {
  it('@smoke wraps the publish jobs table in the bordered panel', () => {
    render(
      <DualSyncPublishJobsContent
        jobs={[makeDualSyncPublishJobRollup()] as unknown as ReadonlyArray<DualSyncPublishJobRollup>}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Sections')).toBeInTheDocument();
  });
});
