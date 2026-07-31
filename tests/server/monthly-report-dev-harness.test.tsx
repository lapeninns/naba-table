import { render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/(public)/dev/monthly-report/email/route';
import MonthlyReportDevPage from '@/app/(public)/dev/monthly-report/page';

const enforceDevOnlyMock = vi.hoisted(() => vi.fn());
const computeMonthlyVenueReportMock = vi.hoisted(() => vi.fn());
const renderMonthlyReportEmailMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/(public)/dev/_shared/enforceDevOnly', () => ({
  enforceDevOnly: enforceDevOnlyMock,
}));

vi.mock('@/server/reports/monthly-venue-report', () => ({
  computeMonthlyVenueReport: computeMonthlyVenueReportMock,
}));

vi.mock('@/server/emails/monthly-report', () => ({
  renderMonthlyReportEmail: renderMonthlyReportEmailMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: maybeSingleMock }),
      }),
    }),
  }),
}));

describe('monthly report dev harness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockResolvedValue({ data: { id: 'old-crown-id' }, error: null });
    computeMonthlyVenueReportMock.mockResolvedValue({
      restaurantName: 'Old Crown Girton',
      month: 'July 2026',
    });
    renderMonthlyReportEmailMock.mockReturnValue({
      subject: 'Your July performance: 2,400 booked covers at Old Crown Girton',
      html: '<html><body>July scorecard</body></html>',
      text: 'July scorecard',
    });
  });

  it('@contract renders Old Crown July through the production monthly email renderer', async () => {
    render(await MonthlyReportDevPage({ searchParams: Promise.resolve({}) }));

    expect(enforceDevOnlyMock).toHaveBeenCalledOnce();
    expect(computeMonthlyVenueReportMock).toHaveBeenCalledWith('old-crown-id', {
      year: 2026,
      month: 7,
    });
    expect(screen.getByRole('heading', { name: 'Monthly report dev harness' })).toBeVisible();
    expect(screen.getByText('Old Crown Girton · July 2026')).toBeVisible();
    expect(screen.getByText(/Your July performance/)).toBeVisible();
    expect(screen.getByTitle('Old Crown Girton monthly report for July 2026')).toHaveAttribute(
      'srcdoc',
      '<html><body>July scorecard</body></html>',
    );
  });

  it('@contract exposes the exact email HTML without the app shell', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/dev/monthly-report/email?venue=the-old-crown-girton&year=2026&month=7',
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await response.text()).toBe('<html><body>July scorecard</body></html>');
  });
});
