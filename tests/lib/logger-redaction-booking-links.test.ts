import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '@/lib/logger';
import { redactUrlQuery } from '@/lib/security/url-redaction';

const LINK =
  'https://www.nabatable.com/bookings/recover?access_token=bk1.aXZpdml2aXZpdml2.Y2lwaGVy.dGFndGFndGFndGFndGFn';

describe('booking link redaction (§48)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never logs the bk1 token in a booking link', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({}, { now: () => new Date('2026-09-26T12:00:00.000Z') });

    logger.info('bookings.recover.visit', { url: LINK, path: '/bookings/recover?access_token=bk1.x' });

    const output = JSON.stringify(logSpy.mock.calls);
    expect(output).not.toContain('bk1.aXZp');
    expect(output).not.toContain('access_token=bk1.x');
  });

  it('blanks the token in analytics/client-error URLs', () => {
    const redacted = redactUrlQuery(LINK);
    expect(redacted).not.toContain('bk1.');
    expect(redacted).toContain('/bookings/recover?access_token=');
  });
});
