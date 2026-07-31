import { COLORS, EMAIL_FONT_STACK, escapeHtml } from '@/server/emails/base';

import type { MonthlyVenueReport } from '@/server/reports/monthly-venue-report';

const FONT = EMAIL_FONT_STACK;

/**
 * Single source of truth for the subject line. Used both as the sent Subject header
 * (plain text) and, HTML-escaped, as the document <title>, so the two never drift.
 */
export function buildMonthlyReportSubject(report: MonthlyVenueReport): string {
  return `Your ${report.monthName} performance: ${report.metrics.bookedCovers.toLocaleString('en-GB')} booked covers at ${report.restaurantName}`;
}

function fmt(n: number): string {
  return n.toLocaleString('en-GB');
}

function calloutRow(icon: string, innerHtml: string, bg: string, color: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:22px;">
      <tr>
        <td style="background-color:${bg};padding:14px 18px;border-radius:10px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="28" valign="top" style="font-size:17px;line-height:1.4;">${icon}</td>
              <td style="font-size:13px;color:${color};line-height:1.55;padding-left:11px;font-family:${FONT};">${innerHtml}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function receiptRow(
  label: string,
  value: string,
  opts?: { emphasis?: boolean; last?: boolean },
): string {
  const valueStyle = opts?.emphasis
    ? 'font-size:16px;color:#047857;font-weight:800'
    : 'font-size:14px;color:#111827;font-weight:700';
  const labelStyle = opts?.emphasis ? 'color:#111827;font-weight:600' : 'color:#4B5563';
  return `
    <tr>
      <td style="padding:12px 0${opts?.last ? '' : ';border-bottom:1px solid #E5E7EB'};">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="font-size:13px;${labelStyle};font-family:${FONT};">${escapeHtml(label)}</td>
            <td align="right" style="${valueStyle};font-family:${FONT};">${escapeHtml(value)}</td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function lifetimeStat(value: string, label: string, pad: string): string {
  return `
    <td width="33%" align="center" valign="top" style="padding:${pad};">
      <p style="margin:0 0 2px;font-size:24px;font-weight:800;color:#065f46;letter-spacing:-0.02em;line-height:1;font-family:${FONT};">${escapeHtml(value)}</p>
      <p style="margin:0;font-size:11px;color:#059669;font-weight:600;font-family:${FONT};">${escapeHtml(label)}</p>
    </td>
  `;
}

type MetricFormat = 'count' | 'decimal' | 'percent';

type ScorecardMetric = {
  label: string;
  current: number;
  previous: number | null;
  format: MetricFormat;
  lowerIsBetter?: boolean;
};

function metricValue(value: number, format: MetricFormat): string {
  if (format === 'percent') return `${value.toFixed(1)}%`;
  if (format === 'decimal') return value.toFixed(1);
  return fmt(value);
}

function signed(value: number, suffix: string): string {
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  return `${normalized > 0 ? '+' : ''}${normalized.toFixed(1)}${suffix}`;
}

function metricChange(metric: ScorecardMetric): string {
  if (metric.previous === null) return 'First month baseline';
  if (metric.format === 'percent') {
    return signed(metric.current - metric.previous, 'pp');
  }
  if (metric.previous === 0) return metric.current === 0 ? 'No change' : 'New this month';
  return signed(((metric.current - metric.previous) / Math.abs(metric.previous)) * 100, '%');
}

function metricTone(metric: ScorecardMetric): string {
  if (metric.previous === null || metric.current === metric.previous) return '#6B7280';
  const improved = metric.lowerIsBetter
    ? metric.current < metric.previous
    : metric.current > metric.previous;
  return improved ? '#047857' : '#B91C1C';
}

function scorecardCell(metric: ScorecardMetric, options: { right: boolean; top: boolean }): string {
  const borderTop = options.top ? '' : 'border-top:1px solid #EEF0F2;';
  const borderLeft = options.right ? 'border-left:1px solid #EEF0F2;' : '';
  return `
    <td width="50%" valign="top" style="padding:16px 14px;${borderTop}${borderLeft}">
      <p style="margin:0 0 4px;font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;font-family:${FONT};">${escapeHtml(metric.label)}</p>
      <p style="margin:0 0 3px;font-size:20px;color:${COLORS.brand};font-weight:800;letter-spacing:-0.02em;font-family:${FONT};">${escapeHtml(metricValue(metric.current, metric.format))}</p>
      <p style="margin:0;font-size:11px;color:${metricTone(metric)};font-weight:700;font-family:${FONT};">${escapeHtml(metricChange(metric))}</p>
    </td>`;
}

function buildScorecardMetrics(report: MonthlyVenueReport): ScorecardMetric[] {
  const previous = report.comparison?.metrics ?? null;
  return [
    {
      label: 'Active bookings',
      current: report.metrics.activeBookings,
      previous: previous?.activeBookings ?? null,
      format: 'count',
    },
    {
      label: 'Unique guests',
      current: report.metrics.uniqueGuests,
      previous: previous?.uniqueGuests ?? null,
      format: 'count',
    },
    {
      label: 'New guests',
      current: report.metrics.firstTimeGuests,
      previous: previous?.firstTimeGuests ?? null,
      format: 'count',
    },
    {
      label: 'Average party size',
      current: report.metrics.averagePartySize,
      previous: previous?.averagePartySize ?? null,
      format: 'decimal',
    },
    {
      label: 'Returning guest share',
      current: report.metrics.returningGuestShare,
      previous: previous?.returningGuestShare ?? null,
      format: 'percent',
    },
    {
      label: 'Cancellation rate',
      current: report.metrics.cancellationRate,
      previous: previous?.cancellationRate ?? null,
      format: 'percent',
      lowerIsBetter: true,
    },
    {
      label: 'No-show rate',
      current: report.metrics.noShowRate,
      previous: previous?.noShowRate ?? null,
      format: 'percent',
      lowerIsBetter: true,
    },
    {
      label: 'Online booking share',
      current: report.metrics.onlineShare,
      previous: previous?.onlineShare ?? null,
      format: 'percent',
    },
    {
      label: 'Lunch covers',
      current: report.metrics.lunchCovers,
      previous: previous?.lunchCovers ?? null,
      format: 'count',
    },
    {
      label: 'Dinner covers',
      current: report.metrics.dinnerCovers,
      previous: previous?.dinnerCovers ?? null,
      format: 'count',
    },
  ];
}

/**
 * Plain-text alternative part. Every HTML-only email is a deliverability liability:
 * spam filters score multipart/alternative (HTML + text) higher, and some clients
 * show the text part. Mirrors the same numbers as the HTML so the two never diverge.
 */
export function renderMonthlyReportText(params: {
  report: MonthlyVenueReport;
  dashboardUrl: string;
}): string {
  const { report, dashboardUrl } = params;
  const greetingName = report.managerName?.trim() || 'there';
  const messagesTotal = report.communications.emailsSent + report.communications.smsSent;

  const lines: string[] = [];
  lines.push(`Nabatable — Monthly Report — ${report.month}`);
  lines.push('');
  lines.push(
    `${greetingName}, here's everything Nabatable did for ${report.restaurantName} in ${report.monthName}.`,
  );
  lines.push('');
  lines.push(
    `BOOKED COVERS FOR ${report.monthName.toUpperCase()}: ${fmt(report.metrics.bookedCovers)}`,
  );
  lines.push(`across ${fmt(report.metrics.activeBookings)} active bookings`);
  if (report.guests.firstTime > 0) {
    lines.push(`- ${fmt(report.guests.firstTime)} were first-time guests`);
  }
  lines.push('');
  lines.push(
    report.comparison
      ? `Performance versus ${report.comparison.month}:`
      : `${report.monthName} performance baseline:`,
  );
  const scorecardMetrics = buildScorecardMetrics(report);
  lines.push(
    `- Booked covers: ${fmt(report.metrics.bookedCovers)} (${metricChange({ label: 'Booked covers', current: report.metrics.bookedCovers, previous: report.comparison?.metrics.bookedCovers ?? null, format: 'count' })})`,
  );
  for (const metric of scorecardMetrics) {
    lines.push(
      `- ${metric.label}: ${metricValue(metric.current, metric.format)} (${metricChange(metric)})`,
    );
  }

  if (report.timing.afterHoursCount > 0) {
    lines.push('');
    lines.push(
      `${fmt(report.timing.afterHoursCount)} bookings (${report.timing.afterHoursPercent}%) came in while you were closed — your booking page stayed available outside opening hours.`,
    );
  }

  lines.push('');
  lines.push("Work Nabatable handled, so your team didn't have to:");
  lines.push(`- Guest emails & texts sent automatically: ${fmt(messagesTotal)}`);
  lines.push(
    `- Arrival reminders that kept no-shows at bay: ${fmt(report.communications.remindersSent)}`,
  );
  lines.push(
    `- Review invites sent to grow your reputation: ${fmt(report.communications.reviewRequestsSent)}`,
  );
  lines.push(
    `- Changes & cancellations sorted for you: ${fmt(report.communications.changesSentCount)}`,
  );

  const moments: string[] = [];
  if (report.moments.busiestDateLabel) {
    const service = report.moments.busiestService
      ? ` ${report.moments.busiestService.toLowerCase()}`
      : '';
    moments.push(
      `Busiest service: ${report.moments.busiestDateLabel}${service} · ${fmt(report.moments.busiestCovers)} covers`,
    );
  }
  if (report.moments.biggestParty > 0) {
    moments.push(`Biggest party: ${fmt(report.moments.biggestParty)} guests`);
  }
  if (report.moments.repeatGuests > 0) {
    moments.push(`${fmt(report.moments.repeatGuests)} guests already came back for seconds`);
  }
  if (moments.length) {
    lines.push('');
    lines.push(`${report.monthName}'s highlights:`);
    for (const m of moments) lines.push(`- ${m}`);
  }

  lines.push('');
  lines.push(
    `Since you joined${report.lifetime.joinedLabel ? ` in ${report.lifetime.joinedLabel.split(' ')[0]}` : ''}:`,
  );
  lines.push(`- ${fmt(report.lifetime.coversActive)} booked covers`);
  lines.push(`- ${fmt(report.lifetime.bookingsActive)} bookings taken`);
  lines.push(`- ${fmt(report.lifetime.messagesSent)} messages sent for you`);

  if (report.quietestDay) {
    lines.push('');
    lines.push(
      `Worth a look: ${report.quietestDay.dayName}s were your quietest service last month — averaging just ${report.quietestDay.avgCoversPerDay} covers a day.`,
    );
  }

  lines.push('');
  lines.push(`See your full dashboard: ${dashboardUrl}`);
  lines.push('');
  lines.push('Every number above happened in the background — while you ran the floor.');
  lines.push('See you next month — the Nabatable team');
  lines.push('');
  lines.push(
    `You're receiving this monthly summary because you manage ${report.restaurantName} on Nabatable.`,
  );

  return lines.join('\n');
}

/**
 * Renders the monthly venue report. Returns the subject alongside the HTML and a
 * plain-text alternative so the caller sends exactly the subject baked into the
 * document title and a multipart/alternative (HTML + text) message.
 */
export function renderMonthlyReportEmail(params: {
  report: MonthlyVenueReport;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const { report, dashboardUrl } = params;
  const subject = buildMonthlyReportSubject(report);
  const safeVenue = escapeHtml(report.restaurantName);
  const greetingName = escapeHtml(report.managerName?.trim() || 'there');
  const messagesTotal = report.communications.emailsSent + report.communications.smsSent;
  const remindersTotal = report.communications.remindersSent;
  const scorecardMetrics = buildScorecardMetrics(report);
  const scorecardRows = Array.from(
    { length: Math.ceil(scorecardMetrics.length / 2) },
    (_, index) => {
      const left = scorecardMetrics[index * 2]!;
      const right = scorecardMetrics[index * 2 + 1]!;
      return `<tr>${scorecardCell(left, { right: false, top: index === 0 })}${scorecardCell(right, { right: true, top: index === 0 })}</tr>`;
    },
  ).join('');
  const heroMetric: ScorecardMetric = {
    label: 'Booked covers',
    current: report.metrics.bookedCovers,
    previous: report.comparison?.metrics.bookedCovers ?? null,
    format: 'count',
  };
  const heroTrend = report.comparison
    ? `<span style="display:inline-block;background-color:#ffffff;color:${metricTone(heroMetric)};font-size:12px;font-weight:800;border:1px solid #D1FAE5;border-radius:999px;padding:5px 12px;font-family:${FONT};">${escapeHtml(metricChange(heroMetric))} vs ${escapeHtml(report.comparison.monthName)}</span>`
    : `<span style="display:inline-block;background-color:#ffffff;color:#6B7280;font-size:12px;font-weight:700;border:1px solid #E5E7EB;border-radius:999px;padding:5px 12px;font-family:${FONT};">First month baseline</span>`;

  const preheaderComparison = report.comparison
    ? `${metricChange(heroMetric)} versus ${report.comparison.monthName}`
    : 'first month baseline';
  const preheader = `${fmt(report.metrics.bookedCovers)} booked covers, ${preheaderComparison}, and ${fmt(messagesTotal)} guest messages sent automatically.`;

  const heroPill =
    report.guests.firstTime > 0
      ? `<span style="display:inline-block;background-color:#ecfdf5;color:#047857;font-size:13px;font-weight:700;border-radius:999px;padding:6px 16px;font-family:${FONT};">&#10024;&nbsp; ${fmt(report.guests.firstTime)} were first-time guests</span>`
      : '';

  const afterHoursCallout =
    report.timing.afterHoursCount > 0
      ? calloutRow(
          '&#127769;',
          `<strong>${fmt(report.timing.afterHoursCount)} bookings (${report.timing.afterHoursPercent}%) came in while you were closed</strong> &mdash; your booking page stayed available outside opening hours.`,
          COLORS.arrivalBg,
          '#9A3412',
        )
      : '';

  const momentsParts: string[] = [];
  if (report.moments.busiestDateLabel) {
    const service = report.moments.busiestService
      ? ` ${escapeHtml(report.moments.busiestService.toLowerCase())}`
      : '';
    momentsParts.push(
      `Your busiest service was <strong style="color:#111827;">${escapeHtml(report.moments.busiestDateLabel)}${service} &middot; ${fmt(report.moments.busiestCovers)} covers</strong>`,
    );
  }
  if (report.moments.biggestParty > 0) {
    momentsParts.push(
      `biggest party of the month was <strong style="color:#111827;">${fmt(report.moments.biggestParty)} guests</strong>`,
    );
  }
  if (report.moments.repeatGuests > 0) {
    momentsParts.push(
      `<strong style="color:#111827;">${fmt(report.moments.repeatGuests)}</strong> guests already came back for seconds`,
    );
  }
  const momentsHtml = momentsParts.length
    ? `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${COLORS.gridBg};border:1px solid ${COLORS.border};border-radius:12px;margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:13px 18px;">
          <p style="margin:0;font-size:12px;color:#4B5563;line-height:1.85;font-family:${FONT};">
            <span style="color:#6B7280;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:0.06em;">${escapeHtml(report.monthName)}&rsquo;s highlights&nbsp;&nbsp;</span>
            ${momentsParts.join(' &nbsp;&bull;&nbsp; ')}
          </p>
        </td>
      </tr>
    </table>`
    : '';

  const lifetimeHtml = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;margin-bottom:24px;">
      <tr>
        <td style="padding:18px 24px 16px;">
          <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#047857;font-family:${FONT};">Since you joined${report.lifetime.joinedLabel ? ` in ${escapeHtml(report.lifetime.joinedLabel.split(' ')[0])}` : ''}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              ${lifetimeStat(fmt(report.lifetime.coversActive), 'booked covers', '0 12px 0 0')}
              ${lifetimeStat(fmt(report.lifetime.bookingsActive), 'bookings taken', '0 12px')}
              ${lifetimeStat(fmt(report.lifetime.messagesSent), 'messages sent for you', '0 0 0 12px')}
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const nudgeHtml = report.quietestDay
    ? calloutRow(
        '&#128161;',
        `<strong>Worth a look:</strong> ${escapeHtml(report.quietestDay.dayName)}s were your quietest service last month &mdash; averaging just ${report.quietestDay.avgCoversPerDay} covers a day.`,
        COLORS.pendingBg,
        '#92400E',
      )
    : '';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>table { border-collapse: collapse; } td, th { mso-line-height-rule: exactly; }</style>
  <![endif]-->
  <style>
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding-left: 22px !important; padding-right: 22px !important; }
      .hero-number { font-size: 52px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bodyBg};font-family:${FONT};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(preheader)}
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${COLORS.bodyBg};">
    <tr>
      <td align="center" style="padding:32px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-container" style="max-width:560px;margin:0 auto;">
          <tr>
            <td style="background-color:${COLORS.cardBg};border-radius:14px;overflow:hidden;box-shadow:0 6px 20px -6px rgba(16,24,40,0.12);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr><td style="height:5px;background-color:${COLORS.success};font-size:5px;line-height:5px;">&nbsp;</td></tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td class="mobile-padding" style="padding:28px 32px 30px;">

                    <!-- Header row -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:22px;">
                      <tr>
                        <td align="left" style="font-size:16px;font-weight:800;color:${COLORS.brand};letter-spacing:-0.02em;font-family:${FONT};">Nabatable</td>
                        <td align="right" style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};font-family:${FONT};">Monthly Report &bull; ${escapeHtml(report.month)}</td>
                      </tr>
                    </table>

                    <!-- Title -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:22px;">
                      <tr>
                        <td align="left">
                          <h1 style="margin:0;color:${COLORS.brand};font-size:21px;font-weight:800;line-height:1.35;letter-spacing:-0.02em;font-family:${FONT};">${greetingName}, here&rsquo;s everything Nabatable did for ${safeVenue} in ${escapeHtml(report.monthName)}.</h1>
                        </td>
                      </tr>
                    </table>

                    <!-- Hero -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${COLORS.gridBg};border:1px solid ${COLORS.border};border-radius:14px;margin-bottom:14px;">
                      <tr>
                        <td align="center" style="padding:26px 24px 24px;">
                          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;font-family:${FONT};">Booked covers for ${escapeHtml(report.monthName)}</p>
                          <p class="hero-number" style="margin:0 0 4px;color:${COLORS.brand};font-size:60px;font-weight:800;line-height:1;letter-spacing:-0.035em;font-family:${FONT};">${fmt(report.metrics.bookedCovers)}</p>
                          <p style="margin:0 0 12px;color:#4B5563;font-size:14px;font-family:${FONT};">across ${fmt(report.metrics.activeBookings)} active bookings</p>
                          <p style="margin:0 0 ${heroPill ? '12' : '0'}px;">${heroTrend}</p>
                          ${heroPill}
                        </td>
                      </tr>
                    </table>

                    <!-- Comparative performance scorecard -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:6px;">
                      <tr><td align="left"><p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.brand};font-family:${FONT};">Performance scorecard${report.comparison ? ` &bull; versus ${escapeHtml(report.comparison.month)}` : ''}</p></td></tr>
                    </table>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${COLORS.gridBg};border:1px solid ${COLORS.border};border-radius:14px;margin-bottom:22px;">
                      ${scorecardRows}
                    </table>

                    ${afterHoursCallout}

                    <!-- Receipt -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:6px;">
                      <tr><td align="left"><p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.brand};font-family:${FONT};"><span style="color:${COLORS.success};">&#9679;</span>&nbsp; Work Nabatable handled, so your team didn&rsquo;t have to</p></td></tr>
                    </table>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
                      ${receiptRow('Guest emails & texts sent automatically', fmt(messagesTotal), { emphasis: true })}
                      ${receiptRow('Arrival reminders that kept no-shows at bay', fmt(remindersTotal))}
                      ${receiptRow('Review invites sent to grow your reputation', fmt(report.communications.reviewRequestsSent))}
                      ${receiptRow('Changes & cancellations sorted for you', fmt(report.communications.changesSentCount), { last: true })}
                    </table>

                    ${momentsHtml}

                    ${lifetimeHtml}

                    ${nudgeHtml}

                    <!-- CTA -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:22px;">
                      <tr>
                        <td align="center">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
                            <tr>
                              <td align="center" style="border-radius:9px;background-color:${COLORS.brand};">
                                <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(dashboardUrl)}" style="height:48px;v-text-anchor:middle;width:250px;" arcsize="18%" stroke="f" fillcolor="${COLORS.brand}"><w:anchorlock/><center><![endif]-->
                                <a href="${escapeHtml(dashboardUrl)}" style="background-color:${COLORS.brand};color:#ffffff;display:inline-block;font-family:${FONT};font-size:15px;font-weight:600;line-height:48px;text-align:center;text-decoration:none;padding:0 34px;border-radius:9px;-webkit-text-size-adjust:none;mso-hide:all;">See your full dashboard</a>
                                <!--[if mso]></center></v:roundrect><![endif]-->
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Close -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="border-top:1px solid #F0F1F3;padding-top:20px;">
                          <p style="margin:0 0 4px;font-size:13px;color:#4B5563;line-height:1.6;font-family:${FONT};">Every number above happened in the background &mdash; while you ran the floor.</p>
                          <p style="margin:0;font-size:13px;color:${COLORS.muted};font-family:${FONT};">See you next month &mdash; the Nabatable team</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:18px 20px;">
              <p style="margin:0 0 6px;font-size:11px;color:${COLORS.muted};font-family:${FONT};">You&rsquo;re receiving this monthly summary because you manage ${safeVenue} on Nabatable.</p>
              <p style="margin:0;font-size:11px;font-family:${FONT};">
                <a href="${escapeHtml(dashboardUrl)}" style="color:${COLORS.text};text-decoration:underline;margin:0 6px;">Dashboard</a>
                <span style="color:#D1D5DB;">&bull;</span>
                <a href="${escapeHtml(dashboardUrl)}" style="color:${COLORS.text};text-decoration:underline;margin:0 6px;">Email preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = renderMonthlyReportText({ report, dashboardUrl });

  return { subject, html, text };
}
