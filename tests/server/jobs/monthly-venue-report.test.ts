import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  SuppressedRecipientError,
  sendEmailMock,
  isEmailRecipientSuppressedErrorMock,
  recordEmailDeliveryLogMock,
  recordObservabilityEventMock,
  renderMonthlyReportEmailMock,
  computeMonthlyVenueReportMock,
  getTrustedAppOriginMock,
  getServiceSupabaseClientMock,
} = vi.hoisted(() => {
  class SuppressedRecipientError extends Error {}
  return {
    SuppressedRecipientError,
    sendEmailMock: vi.fn(async () => ({ provider: 'mock' as const, messageId: 'msg-1' })),
    isEmailRecipientSuppressedErrorMock: vi.fn(
      (error: unknown) => error instanceof SuppressedRecipientError,
    ),
    recordEmailDeliveryLogMock: vi.fn(async () => ({ id: 'log-1' })),
    recordObservabilityEventMock: vi.fn(async () => undefined),
    renderMonthlyReportEmailMock: vi.fn(() => ({
      subject: 'Rendered subject',
      html: '<p>html</p>',
      text: 'plain text',
    })),
    computeMonthlyVenueReportMock: vi.fn(),
    getTrustedAppOriginMock: vi.fn(() => 'https://app.example.test'),
    getServiceSupabaseClientMock: vi.fn(),
  };
});

vi.mock('@/lib/site-url', () => ({
  getTrustedAppOrigin: getTrustedAppOriginMock,
}));

vi.mock('@/libs/resend', () => ({
  sendEmail: sendEmailMock,
  isEmailRecipientSuppressedError: isEmailRecipientSuppressedErrorMock,
}));

vi.mock('@/server/emails/email-delivery-log', () => ({
  recordEmailDeliveryLog: recordEmailDeliveryLogMock,
}));

vi.mock('@/server/emails/monthly-report', () => ({
  renderMonthlyReportEmail: renderMonthlyReportEmailMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/reports/monthly-venue-report', () => ({
  computeMonthlyVenueReport: computeMonthlyVenueReportMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { sendMonthlyVenueReports } from '@/server/jobs/monthly-venue-report';

type QueryCall = { method: string; args: unknown[] };
type RecordedQuery = { table: string; calls: QueryCall[] };

function installVenues(result: { data: unknown; error?: unknown }) {
  const queries: RecordedQuery[] = [];
  const from = vi.fn((table: string) => {
    const query: RecordedQuery = { table, calls: [] };
    queries.push(query);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'not', 'eq']) {
      builder[method] = (...args: unknown[]) => {
        query.calls.push({ method, args });
        return builder;
      };
    }
    builder.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve()
        .then(() => ({ error: null, ...result }))
        .then(onFulfilled, onRejected);
    return builder;
  });
  getServiceSupabaseClientMock.mockReturnValue({ from });
  return { queries };
}

function venue(id: string, overrides: Record<string, unknown> = {}) {
  return { id, contact_email: `owner@${id}.test`, monthly_report_enabled: true, ...overrides };
}

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    month: 'July 2026',
    covers: { active: 42 },
    guests: { firstTime: 7 },
    ...overrides,
  };
}

describe('sendMonthlyVenueReports', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mid-month noon UTC: the calendar month is July in every possible host timezone.
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    computeMonthlyVenueReportMock.mockImplementation(async () => makeReport());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@worker @contract sends a rendered report per eligible venue using fromName (not from) and logs delivery', async () => {
    installVenues({ data: [venue('v1'), venue('v2')] });

    const summary = await sendMonthlyVenueReports();

    expect(summary).toEqual({ totalVenues: 2, sent: 2, skipped: 0, failed: 0, errors: [] });

    expect(computeMonthlyVenueReportMock).toHaveBeenCalledTimes(2);
    // The report month comes from the frozen clock.
    expect(computeMonthlyVenueReportMock).toHaveBeenCalledWith('v1', { year: 2026, month: 7 });
    expect(computeMonthlyVenueReportMock).toHaveBeenCalledWith('v2', { year: 2026, month: 7 });

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(sendEmailMock).toHaveBeenCalledWith({
      fromName: 'Team Nabatable',
      to: 'owner@v1.test',
      subject: 'Rendered subject',
      html: '<p>html</p>',
      text: 'plain text',
      category: 'marketing',
      tags: [
        { name: 'email_type', value: 'monthly_report' },
        { name: 'restaurant_id', value: 'v1' },
      ],
    });
    // sendEmail's sender API is fromName; the job must never pass a raw `from`.
    expect(sendEmailMock.mock.calls[0]![0]).not.toHaveProperty('from');

    expect(recordEmailDeliveryLogMock).toHaveBeenCalledWith({
      restaurantId: 'v1',
      recipientEmail: 'owner@v1.test',
      messageId: 'msg-1',
      emailType: 'monthly_report',
      templateType: 'monthly_report',
      status: 'sent',
      provider: 'mock',
      metadata: { month: 'July 2026', covers: 42, guests: 7 },
    });
  });

  it('@worker @contract renders with the trusted dashboard origin and the computed report', async () => {
    installVenues({ data: [venue('v1')] });
    const report = makeReport({ month: 'July 2026' });
    computeMonthlyVenueReportMock.mockResolvedValue(report);

    await sendMonthlyVenueReports();

    expect(renderMonthlyReportEmailMock).toHaveBeenCalledWith({
      report,
      dashboardUrl: 'https://app.example.test/dashboard',
    });
  });

  it('@worker @contract filters null contact emails at the query and re-checks rows defensively', async () => {
    const { queries } = installVenues({
      data: [venue('v1', { contact_email: null })],
    });

    const summary = await sendMonthlyVenueReports();

    const venuesQuery = queries.find((q) => q.table === 'restaurants')!;
    expect(venuesQuery.calls).toContainEqual({
      method: 'not',
      args: ['contact_email', 'is', null],
    });
    // A null-email row that slips through is skipped without computing a report.
    expect(summary).toEqual({ totalVenues: 1, sent: 0, skipped: 1, failed: 0, errors: [] });
    expect(computeMonthlyVenueReportMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('@worker @contract skips venues whose report is null (no activity that month)', async () => {
    installVenues({ data: [venue('v1'), venue('v2')] });
    computeMonthlyVenueReportMock.mockImplementation(async (id: string) =>
      id === 'v1' ? null : makeReport(),
    );

    const summary = await sendMonthlyVenueReports();

    expect(summary).toEqual({ totalVenues: 2, sent: 1, skipped: 1, failed: 0, errors: [] });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('@worker @dry-run-only computes but never sends or logs in dry-run mode', async () => {
    installVenues({ data: [venue('v1')] });

    const summary = await sendMonthlyVenueReports({ dryRun: true });

    expect(summary).toEqual({ totalVenues: 1, sent: 0, skipped: 1, failed: 0, errors: [] });
    expect(computeMonthlyVenueReportMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(recordEmailDeliveryLogMock).not.toHaveBeenCalled();
  });

  it('@worker @contract excludes venues that disabled the monthly report', async () => {
    installVenues({
      data: [
        venue('v1', { monthly_report_enabled: false }),
        venue('v2', { monthly_report_enabled: null }),
        venue('v3'),
      ],
    });

    const summary = await sendMonthlyVenueReports();

    // Only an explicit false opts out; null/undefined stays enabled.
    expect(summary.totalVenues).toBe(2);
    expect(summary.sent).toBe(2);
    expect(computeMonthlyVenueReportMock).not.toHaveBeenCalledWith('v1', expect.anything());
  });

  it('@worker @contract an explicit restaurant filter scopes the query and overrides the opt-out', async () => {
    const { queries } = installVenues({
      data: [venue('v9', { monthly_report_enabled: false })],
    });

    const summary = await sendMonthlyVenueReports({ restaurantIdFilter: 'v9' });

    const venuesQuery = queries.find((q) => q.table === 'restaurants')!;
    expect(venuesQuery.calls).toContainEqual({ method: 'eq', args: ['id', 'v9'] });
    // Pinned: the manual-test filter deliberately bypasses monthly_report_enabled=false.
    expect(summary).toEqual({ totalVenues: 1, sent: 1, skipped: 0, failed: 0, errors: [] });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('@worker @contract suppressed recipients are skipped, not failed, with no failure telemetry', async () => {
    installVenues({ data: [venue('v1')] });
    sendEmailMock.mockRejectedValueOnce(new SuppressedRecipientError('suppressed'));

    const summary = await sendMonthlyVenueReports();

    expect(summary).toEqual({ totalVenues: 1, sent: 0, skipped: 1, failed: 0, errors: [] });
    expect(recordEmailDeliveryLogMock).not.toHaveBeenCalled();
    expect(recordObservabilityEventMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'send_failed' }),
    );
  });

  it('@worker @contract @observability a send failure is isolated per venue and reported to observability', async () => {
    installVenues({ data: [venue('v1'), venue('v2')] });
    sendEmailMock.mockImplementation(async (params: { to: string | string[] }) => {
      if (params.to === 'owner@v1.test') throw new Error('smtp down');
      return { provider: 'mock' as const, messageId: 'msg-2' };
    });

    const summary = await sendMonthlyVenueReports();

    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toEqual([{ restaurantId: 'v1', reason: 'smtp down' }]);
    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'monthly_reports',
      eventType: 'send_failed',
      severity: 'warning',
      context: { restaurantId: 'v1', error: 'smtp down' },
      restaurantId: 'v1',
    });
    // The healthy venue still got its report and delivery log.
    expect(recordEmailDeliveryLogMock).toHaveBeenCalledTimes(1);
    expect(recordEmailDeliveryLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: 'v2', messageId: 'msg-2' }),
    );
  });

  it('@worker @contract @observability throws and records observability when the venue query fails', async () => {
    installVenues({ data: null, error: { message: 'db offline' } });

    await expect(sendMonthlyVenueReports()).rejects.toThrow(
      'Failed to fetch venues: db offline',
    );
    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'monthly_reports',
      eventType: 'fetch_venues_failed',
      severity: 'error',
      context: { error: 'db offline' },
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('@worker @contract a null delivery-log result still counts the venue as sent', async () => {
    installVenues({ data: [venue('v1')] });
    recordEmailDeliveryLogMock.mockResolvedValueOnce(null as never);

    const summary = await sendMonthlyVenueReports();

    expect(summary).toEqual({ totalVenues: 1, sent: 1, skipped: 0, failed: 0, errors: [] });
  });

  it('@worker @contract processes more venues than one concurrency batch', async () => {
    const venues = Array.from({ length: 7 }, (_, i) => venue(`v${i + 1}`));
    installVenues({ data: venues });
    let counter = 0;
    sendEmailMock.mockImplementation(async () => ({
      provider: 'mock' as const,
      messageId: `msg-${++counter}`,
    }));

    const summary = await sendMonthlyVenueReports();

    expect(summary).toEqual({ totalVenues: 7, sent: 7, skipped: 0, failed: 0, errors: [] });
    expect(sendEmailMock).toHaveBeenCalledTimes(7);
    expect(recordEmailDeliveryLogMock).toHaveBeenCalledTimes(7);
  });
});
