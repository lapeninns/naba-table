import { describe, expect, it } from 'vitest';

import {
  describeGbpPublishOutcome,
  hasUnknownGbpPublishOutcome,
} from '@/components/features/restaurant-settings/dual-sync/gbpPublishOutcomeDomain';

describe('gbpPublishOutcomeDomain', () => {
  it('describes each exact publish outcome in plain language', () => {
    expect(describeGbpPublishOutcome('consumed')).toMatchObject({
      label: 'Confirmed by Google',
      tone: 'success',
    });
    expect(describeGbpPublishOutcome('failed')).toMatchObject({ label: 'Failed', tone: 'danger' });
    expect(describeGbpPublishOutcome('cancelled_before_dispatch')).toMatchObject({
      label: 'Not sent',
      tone: 'muted',
    });
    expect(describeGbpPublishOutcome('cancelled_after_bundle_failure')).toMatchObject({
      label: 'Not sent',
      tone: 'muted',
    });
  });

  it('never describes an unknown provider outcome as success', () => {
    const unknown = describeGbpPublishOutcome('outcome_unknown');

    expect(unknown.label).toBe('Outcome unknown');
    expect(unknown.tone).toBe('warning');
    expect(unknown.detail).toMatch(/don’t assume it worked/i);
    expect(unknown.detail).toMatch(/stay listed/i);
  });

  it('detects an unknown outcome only in immediate results', () => {
    expect(hasUnknownGbpPublishOutcome(null)).toBe(false);
    expect(
      hasUnknownGbpPublishOutcome({
        mode: 'queued',
        bundleId: 'bundle_1',
        grantIds: ['grant_1'],
        jobId: 'job_1',
        status: 'queued',
      }),
    ).toBe(false);
    expect(
      hasUnknownGbpPublishOutcome({
        mode: 'immediate',
        bundleId: 'bundle_1',
        grantIds: ['grant_1'],
        outcomes: [
          { groupId: 'group_1', status: 'consumed', reasonCode: 'provider_succeeded' },
          { groupId: 'group_2', status: 'outcome_unknown', reasonCode: 'provider_timeout' },
        ],
      }),
    ).toBe(true);
  });
});
