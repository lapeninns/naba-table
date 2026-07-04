import { COLORS, EMAIL_FONT_STACK, escapeHtml } from '@/server/emails/base';

import type { MonthlyVenueReport } from '@/server/reports/monthly-venue-report';

const FONT = EMAIL_FONT_STACK;

/**
 * Single source of truth for the subject line. Used both as the sent Subject header
 * (plain text) and, HTML-escaped, as the document <title>, so the two never drift.
 */
export function buildMonthlyReportSubject(report: MonthlyVenueReport): string {
  return `Your ${report.monthName} on Nabatable: ${report.covers.active.toLocaleString('en-GB')} guests seated at ${report.restaurantName}`;
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

function receiptRow(label: string, value: string, opts?: { emphasis?: boolean; last?: boolean }): string {
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

/**
 * Renders the monthly venue report. Returns the subject alongside the HTML so the
 * caller sends exactly the subject baked into the document title.
 */
export function renderMonthlyReportEmail(params: {
  report: MonthlyVenueReport;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const { report, dashboardUrl } = params;
  const subject = buildMonthlyReportSubject(report);
  const safeVenue = escapeHtml(report.restaurantName);
  const greetingName = escapeHtml(report.managerName?.trim() || 'there');
  const messagesTotal = report.communications.emailsSent + report.communications.smsSent;
  const remindersTotal = report.communications.remindersSent;

  const preheader = `${fmt(report.covers.active)} guests seated, ${fmt(report.guests.firstTime)} of them brand-new to you, and ${fmt(messagesTotal)} guest messages sent automatically.`;

  const heroPill =
    report.guests.firstTime > 0
      ? `<span style="display:inline-block;background-color:#ecfdf5;color:#047857;font-size:13px;font-weight:700;border-radius:999px;padding:6px 16px;font-family:${FONT};">&#10024;&nbsp; ${fmt(report.guests.firstTime)} were first-time guests</span>`
      : '';

  const afterHoursCallout =
    report.timing.afterHoursCount > 0
      ? calloutRow(
          '&#127769;',
          `<strong>${fmt(report.timing.afterHoursCount)} of those bookings (${report.timing.afterHoursPercent}%) came in while you were closed</strong> &mdash; tables you&rsquo;d have lost to voicemail. Your booking page never clocks off.`,
          COLORS.arrivalBg,
          '#9A3412',
        )
      : '';

  const momentsParts: string[] = [];
  if (report.moments.busiestDateLabel) {
    const service = report.moments.busiestService ? ` ${escapeHtml(report.moments.busiestService.toLowerCase())}` : '';
    momentsParts.push(
      `Your busiest table was <strong style="color:#111827;">${escapeHtml(report.moments.busiestDateLabel)}${service} &middot; ${fmt(report.moments.busiestCovers)} covers</strong>`,
    );
  }
  if (report.moments.biggestParty > 0) {
    momentsParts.push(`biggest party of the month was <strong style="color:#111827;">${fmt(report.moments.biggestParty)} guests</strong>`);
  }
  if (report.moments.repeatGuests > 0) {
    momentsParts.push(`<strong style="color:#111827;">${fmt(report.moments.repeatGuests)}</strong> guests already came back for seconds`);
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
              ${lifetimeStat(fmt(report.lifetime.coversActive), 'guests seated', '0 12px 0 0')}
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
                          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;font-family:${FONT};">Guests you seated in ${escapeHtml(report.monthName)}</p>
                          <p class="hero-number" style="margin:0 0 4px;color:${COLORS.brand};font-size:60px;font-weight:800;line-height:1;letter-spacing:-0.035em;font-family:${FONT};">${fmt(report.covers.active)}</p>
                          <p style="margin:0 0 ${heroPill ? '16' : '0'}px;color:#4B5563;font-size:14px;font-family:${FONT};">across ${fmt(report.bookings.total)} bookings</p>
                          ${heroPill}
                        </td>
                      </tr>
                    </table>

                    <!-- Stat grid 2x2 -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${COLORS.gridBg};border:1px solid ${COLORS.border};border-radius:14px;margin-bottom:22px;">
                      <tr>
                        <td style="padding:18px 24px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="50%" valign="top" style="padding:0 12px 16px 0;">
                                <p style="margin:0 0 3px;font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;font-family:${FONT};">New guests discovered you</p>
                                <p style="margin:0;font-size:20px;color:${COLORS.brand};font-weight:800;letter-spacing:-0.02em;font-family:${FONT};">${fmt(report.guests.firstTime)}</p>
                              </td>
                              <td width="50%" valign="top" style="padding:0 0 16px 12px;">
                                <p style="margin:0 0 3px;font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;font-family:${FONT};">Guests who came back</p>
                                <p style="margin:0;font-size:20px;color:${COLORS.brand};font-weight:800;letter-spacing:-0.02em;font-family:${FONT};">${fmt(report.guests.returning)}</p>
                              </td>
                            </tr>
                            <tr>
                              <td width="50%" valign="top" style="padding:16px 12px 0 0;border-top:1px solid #EEF0F2;">
                                <p style="margin:0 0 3px;font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;font-family:${FONT};">Booked themselves online</p>
                                <p style="margin:0;font-size:20px;color:${COLORS.brand};font-weight:800;letter-spacing:-0.02em;font-family:${FONT};">${report.bookings.onlinePercent}%</p>
                              </td>
                              <td width="50%" valign="top" style="padding:16px 0 0 12px;border-top:1px solid #EEF0F2;">
                                <p style="margin:0 0 3px;font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;font-family:${FONT};">No-show rate</p>
                                <p style="margin:0;font-size:20px;color:#047857;font-weight:800;letter-spacing:-0.02em;font-family:${FONT};">${report.bookings.noShowPercent}% <span style="color:#6B7280;font-size:11px;font-weight:600;">just ${fmt(report.bookings.noShowCount)} all month</span></p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
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

  return { subject, html };
}
