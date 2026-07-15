import { describe, expect, it } from 'vitest';

import { resolveDueDispatch } from '../src/scheduling';

describe('SMS summary scheduling contract', () => {
  it('resolves the local 10:00 window across British Summer Time', () => {
    expect(
      resolveDueDispatch({
        now: '2026-07-15T09:05:00.000Z',
        timezone: 'Europe/London',
      }),
    ).toMatchObject({
      dueNow: true,
      localDate: '2026-07-15',
    });
  });
});
