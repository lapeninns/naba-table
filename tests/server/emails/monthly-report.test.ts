import { describe, expect, it } from 'vitest';

import {
  buildMonthlyReportSubject,
  renderMonthlyReportEmail,
  renderMonthlyReportText,
} from '@/server/emails/monthly-report';

import type { MonthlyVenueReport } from '@/server/reports/monthly-venue-report';

const DASHBOARD_URL = 'https://app.example.test/dashboard';

function makeReport(overrides: Partial<MonthlyVenueReport> = {}): MonthlyVenueReport {
  return {
    restaurantId: 'rest-1',
    restaurantName: 'The Golden Fork',
    managerName: 'Priya',
    contactEmail: 'owner@example.com',
    timezone: 'Europe/London',
    month: 'June 2026',
    monthName: 'June',
    covers: { active: 1234, fromBookings: 310 },
    guests: { firstTime: 87, returning: 145 },
    bookings: {
      total: 320,
      onlinePercent: 76,
      completedCount: 280,
      cancelledCount: 12,
      noShowCount: 4,
      noShowPercent: 1.3,
    },
    timing: { afterHoursCount: 41, afterHoursPercent: 13 },
    communications: {
      emailsSent: 900,
      remindersSent: 300,
      reviewRequestsSent: 120,
      changesSentCount: 45,
      smsSent: 100,
    },
    moments: {
      busiestDateLabel: 'Sunday 21 June',
      busiestService: 'Lunch',
      busiestCovers: 96,
      biggestParty: 14,
      repeatGuests: 23,
    },
    quietestDay: { dayName: 'Thursday', avgCoversPerDay: 18.5 },
    lifetime: {
      coversActive: 5400,
      bookingsActive: 1500,
      messagesSent: 4100,
      joinedLabel: 'December 2025',
    },
    ...overrides,
  };
}

function makeZeroReport(): MonthlyVenueReport {
  return makeReport({
    managerName: null,
    covers: { active: 0, fromBookings: 0 },
    guests: { firstTime: 0, returning: 0 },
    bookings: {
      total: 0,
      onlinePercent: 0,
      completedCount: 0,
      cancelledCount: 0,
      noShowCount: 0,
      noShowPercent: 0,
    },
    timing: { afterHoursCount: 0, afterHoursPercent: 0 },
    communications: {
      emailsSent: 0,
      remindersSent: 0,
      reviewRequestsSent: 0,
      changesSentCount: 0,
      smsSent: 0,
    },
    moments: {
      busiestDateLabel: null,
      busiestService: null,
      busiestCovers: 0,
      biggestParty: 0,
      repeatGuests: 0,
    },
    quietestDay: null,
    lifetime: { coversActive: 0, bookingsActive: 0, messagesSent: 0, joinedLabel: null },
  });
}

describe('monthly report email renderer', () => {
  it('@contract subject bakes the month, en-GB formatted covers and venue name', () => {
    const subject = buildMonthlyReportSubject(makeReport());

    expect(subject).toBe('Your June on Nabatable: 1,234 guests seated at The Golden Fork');
  });

  it('@contract renderMonthlyReportEmail returns the exact subject and bakes it (escaped) into the document title', () => {
    const report = makeReport({ restaurantName: 'Fork & Knife' });
    const { subject, html } = renderMonthlyReportEmail({ report, dashboardUrl: DASHBOARD_URL });

    expect(subject).toBe(buildMonthlyReportSubject(report));
    // Subject header stays plain text; the <title> carries the HTML-escaped form.
    expect(subject).toContain('Fork & Knife');
    expect(html).toContain(
      '<title>Your June on Nabatable: 1,234 guests seated at Fork &amp; Knife</title>',
    );
  });

  it('@contract @security escapes venue, manager and dashboard URL so operator input cannot inject markup', () => {
    const report = makeReport({
      restaurantName: '<script>alert(1)</script> & Sons',
      managerName: '<b>Boss</b>',
    });
    const dashboardUrl = 'https://x.test/dash?a=1&b="<q>';
    const { html, text } = renderMonthlyReportEmail({ report, dashboardUrl });

    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; Sons');
    expect(html).toContain('&lt;b&gt;Boss&lt;/b&gt;');
    expect(html).toContain('href="https://x.test/dash?a=1&amp;b=&quot;&lt;q&gt;"');
    expect(html).not.toContain('href="https://x.test/dash?a=1&b="<q>"');
    // The plain-text part is not HTML, so the URL is emitted verbatim there.
    expect(text).toContain('See your full dashboard: https://x.test/dash?a=1&b="<q>');
  });

  it('@contract text part mirrors the headline numbers and the automation receipt', () => {
    const text = renderMonthlyReportText({ report: makeReport(), dashboardUrl: DASHBOARD_URL });

    expect(text).toContain('Nabatable — Monthly Report — June 2026');
    expect(text).toContain(
      "Priya, here's everything Nabatable did for The Golden Fork in June.",
    );
    expect(text).toContain('GUESTS YOU SEATED IN JUNE: 1,234');
    expect(text).toContain('across 320 bookings');
    expect(text).toContain('- 87 were first-time guests');
    expect(text).toContain('New guests discovered you: 87');
    expect(text).toContain('Guests who came back: 145');
    expect(text).toContain('Booked themselves online: 76%');
    expect(text).toContain('No-show rate: 1.3% (just 4 all month)');
    // Messages total is emails + sms (900 + 100).
    expect(text).toContain('- Guest emails & texts sent automatically: 1,000');
    expect(text).toContain('- Arrival reminders that kept no-shows at bay: 300');
    expect(text).toContain('- Review invites sent to grow your reputation: 120');
    expect(text).toContain('- Changes & cancellations sorted for you: 45');
    expect(text).toContain('- 5,400 guests seated');
    expect(text).toContain('- 1,500 bookings taken');
    expect(text).toContain('- 4,100 messages sent for you');
    expect(text).toContain(
      "You're receiving this monthly summary because you manage The Golden Fork on Nabatable.",
    );
  });

  it('@contract renders the after-hours callout, highlights and quiet-day nudge when present', () => {
    const { html, text } = renderMonthlyReportEmail({
      report: makeReport(),
      dashboardUrl: DASHBOARD_URL,
    });

    expect(text).toContain(
      "41 of those bookings (13%) came in while you were closed — tables you'd have lost to voicemail.",
    );
    expect(text).toContain("June's highlights:");
    expect(text).toContain('- Busiest table: Sunday 21 June lunch · 96 covers');
    expect(text).toContain('- Biggest party: 14 guests');
    expect(text).toContain('- 23 guests already came back for seconds');
    expect(text).toContain(
      'Worth a look: Thursdays were your quietest service last month — averaging just 18.5 covers a day.',
    );

    expect(html).toContain('41 of those bookings (13%) came in while you were closed');
    // Busiest service is lowercased for prose ("Lunch" -> "lunch").
    expect(html).toContain('Sunday 21 June lunch &middot; 96 covers');
    expect(html).toContain('Thursdays were your quietest service last month');
    expect(html).toContain('87 were first-time guests');
  });

  it('@contract omits every optional section when its data is zero or missing', () => {
    const { html, text } = renderMonthlyReportEmail({
      report: makeZeroReport(),
      dashboardUrl: DASHBOARD_URL,
    });

    expect(text).not.toContain('were first-time guests');
    expect(text).not.toContain('came in while you were closed');
    expect(text).not.toContain('highlights:');
    expect(text).not.toContain('Worth a look:');
    // The zero stat itself still renders in the grid.
    expect(text).toContain('New guests discovered you: 0');

    expect(html).not.toContain('were first-time guests');
    expect(html).not.toContain('came in while you were closed');
    expect(html).not.toContain('rsquo;s highlights');
    expect(html).not.toContain('Worth a look:');
  });

  it('@contract greets "there" when the manager name is missing or blank', () => {
    const nullName = renderMonthlyReportText({
      report: makeReport({ managerName: null }),
      dashboardUrl: DASHBOARD_URL,
    });
    const blankName = renderMonthlyReportEmail({
      report: makeReport({ managerName: '   ' }),
      dashboardUrl: DASHBOARD_URL,
    });

    expect(nullName).toContain("there, here's everything Nabatable did for");
    expect(blankName.html).toContain('there, here&rsquo;s everything Nabatable did for');
  });

  it('@contract reduces the joined label to its month word and drops it when unknown', () => {
    const withLabel = renderMonthlyReportText({
      report: makeReport(),
      dashboardUrl: DASHBOARD_URL,
    });
    const withoutLabel = renderMonthlyReportText({
      report: makeReport({
        lifetime: { coversActive: 1, bookingsActive: 1, messagesSent: 1, joinedLabel: null },
      }),
      dashboardUrl: DASHBOARD_URL,
    });

    expect(withLabel).toContain('Since you joined in December:');
    expect(withoutLabel).toContain('Since you joined:');
    expect(withoutLabel).not.toContain('Since you joined in');
  });

  it('@contract a zero-activity report still renders without NaN or undefined artifacts', () => {
    const report = makeZeroReport();
    const { subject, html, text } = renderMonthlyReportEmail({
      report,
      dashboardUrl: DASHBOARD_URL,
    });

    expect(subject).toBe('Your June on Nabatable: 0 guests seated at The Golden Fork');
    expect(text).toContain('across 0 bookings');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
  });

  it('@contract omits the busiest-service suffix when the service is unknown', () => {
    const text = renderMonthlyReportText({
      report: makeReport({
        moments: {
          busiestDateLabel: 'Sunday 21 June',
          busiestService: null,
          busiestCovers: 96,
          biggestParty: 0,
          repeatGuests: 0,
        },
      }),
      dashboardUrl: DASHBOARD_URL,
    });

    expect(text).toContain('- Busiest table: Sunday 21 June · 96 covers');
    expect(text).not.toContain('Sunday 21 June lunch');
  });
});
