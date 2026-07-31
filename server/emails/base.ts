import config from '@/config';
import { safePublicHref } from '@/lib/security/safe-url';
import { safeJsonForHtmlScript } from '@/lib/security/script-json';

// ============================================================================
// NAB A TABLE EMAIL DESIGN SYSTEM
// A UX-first email framework for hospitality interactions.
// ============================================================================

export const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const COLORS = {
  // Brand
  brand: '#111827', // Dark Gray (Logo/Title)
  text: '#4B5563', // Cool Gray 600 (Body)
  muted: '#9CA3AF', // Cool Gray 400 (Footer)

  // Status Palette (Unified)
  success: '#10b981', // Emerald
  successBg: '#ecfdf5',

  pending: '#f59e0b', // Amber
  pendingBg: '#fffbeb',

  error: '#ef4444', // Red
  errorBg: '#fef2f2',

  info: '#3b82f6', // Blue
  infoBg: '#eff6ff',

  arrival: '#f97316', // Orange
  arrivalBg: '#fff7ed',

  review: '#8b5cf6', // Violet
  reviewBg: '#f5f3ff',

  cancel: '#64748b', // Slate
  cancelBg: '#f8fafc',

  // Structure
  bodyBg: '#F3F4F6', // Cool Gray 100
  cardBg: '#ffffff',
  border: '#E5E7EB',
  gridBg: '#F9FAFB',
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* --- Schema.org / Email Annotations --- */

export type EmailAnnotation = {
  actionName?: string;
  actionUrl?: string;
  reservation?: {
    confirmationNumber: string;
    status:
      | 'ReservationConfirmed'
      | 'ReservationCancelled'
      | 'ReservationPending'
      | 'ReservationHold';
    startTime: string;
    partySize: number;
    venue: {
      name: string;
      address: string;
    };
  };
};

export function renderAnnotationScript(annotation: EmailAnnotation): string {
  if (!annotation.reservation) return '';

  const schema = {
    '@context': 'http://schema.org',
    '@type': 'FoodEstablishmentReservation',
    reservationNumber: annotation.reservation.confirmationNumber,
    reservationStatus: `http://schema.org/${annotation.reservation.status}`,
    underName: { '@type': 'Person', name: 'Guest' },
    reservationFor: {
      '@type': 'FoodEstablishment',
      name: annotation.reservation.venue.name,
      address: { '@type': 'PostalAddress', streetAddress: annotation.reservation.venue.address },
    },
    startTime: annotation.reservation.startTime,
    partySize: annotation.reservation.partySize,
    potentialAction:
      annotation.actionName && annotation.actionUrl
        ? {
            '@type': 'ViewAction',
            target: safePublicHref(annotation.actionUrl, `https://${config.domainName}/`),
            name: annotation.actionName,
          }
        : undefined,
  };

  return `<script type="application/ld+json">${safeJsonForHtmlScript(schema)}</script>`;
}

/* --- Components --- */

export function renderButton(label: string, href: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        <td align="center" style="border-radius:8px;background-color:#111827;">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(href)}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="17%" stroke="f" fillcolor="#111827">
            <w:anchorlock/>
            <center>
          <![endif]-->
          <a href="${escapeHtml(href)}" style="background-color:#111827;color:#ffffff;display:inline-block;font-family:${EMAIL_FONT_STACK};font-size:16px;font-weight:600;line-height:48px;text-align:center;text-decoration:none;padding:0 32px;border-radius:8px;-webkit-text-size-adjust:none;mso-hide:all;">${escapeHtml(label)}</a>
          <!--[if mso]>
            </center>
          </v:roundrect>
          <![endif]-->
        </td>
      </tr>
    </table>
  `;
}

export function renderStarRow(href: string): string {
  const starLink = (count: number) =>
    `<td align="center" style="padding:0 2px;"><a href="${escapeHtml(href)}" aria-label="Rate ${count} star${count === 1 ? '' : 's'}" style="display:inline-block;min-width:44px;font-family:${EMAIL_FONT_STACK};font-size:32px;line-height:44px;color:#F59E0B;text-decoration:none;">&#9733;</a></td>`;

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        ${[1, 2, 3, 4, 5].map(starLink).join('')}
      </tr>
      <tr>
        <td colspan="5" align="center" style="padding:4px 0 20px;">
          <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:13px;color:#6B7280;">Tap a star to rate your visit</p>
        </td>
      </tr>
    </table>`;
}

export type GridItem = { label: string; value: string };

export function renderGridBox(items: GridItem[]): string {
  const safeItems = [...items];
  while (safeItems.length < 4) safeItems.push({ label: '', value: '' });

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${COLORS.gridBg};border:1px solid ${COLORS.border};border-radius:12px;margin-bottom:24px;">
      <tr>
        <td style="padding:20px 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="50%" valign="top" style="padding:0 12px 16px 0;">
                <p style="margin:0 0 4px;font-family:${EMAIL_FONT_STACK};font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${escapeHtml(safeItems[0].label)}</p>
                <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:15px;color:#111827;font-weight:600;">${escapeHtml(safeItems[0].value)}</p>
              </td>
              <td width="50%" valign="top" style="padding:0 0 16px 12px;">
                <p style="margin:0 0 4px;font-family:${EMAIL_FONT_STACK};font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${escapeHtml(safeItems[1].label)}</p>
                <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:15px;color:#111827;font-weight:600;">${escapeHtml(safeItems[1].value)}</p>
              </td>
            </tr>
            <tr>
              <td width="50%" valign="top" style="padding:0 12px 0 0;">
                <p style="margin:0 0 4px;font-family:${EMAIL_FONT_STACK};font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${escapeHtml(safeItems[2].label)}</p>
                <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:15px;color:#111827;font-weight:600;">${escapeHtml(safeItems[2].value)}</p>
              </td>
              <td width="50%" valign="top" style="padding:0 0 0 12px;">
                <p style="margin:0 0 4px;font-family:${EMAIL_FONT_STACK};font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">${escapeHtml(safeItems[3].label)}</p>
                <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:15px;color:#111827;font-weight:600;">${escapeHtml(safeItems[3].value)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function renderDivider(margin: string = '24px 0'): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:${margin};">
      <tr>
        <td style="height:1px;background-color:${COLORS.border};font-size:1px;line-height:1px;">&nbsp;</td>
      </tr>
    </table>
  `;
}

export function renderNote(
  icon: string,
  text: string,
  bgColor: string = COLORS.pendingBg,
  textColor: string = '#92400E',
): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:${bgColor};padding:16px 20px;border-radius:8px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="28" valign="top" style="font-size:18px;line-height:1;">${icon}</td>
              <td style="font-family:${EMAIL_FONT_STACK};font-size:14px;color:${textColor};line-height:1.5;padding-left:12px;">
                ${escapeHtml(text)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/* --- Base Wrapper --- */

export type EmailBaseOptions = {
  title: string;
  preheader?: string;
  contentHtml: string;
  annotation?: EmailAnnotation;
  manageUrl?: string;
  helpUrl?: string;
};

export function renderEmailBase(options: EmailBaseOptions): string {
  const {
    title,
    preheader = '',
    contentHtml,
    annotation,
    manageUrl = '#',
    helpUrl = '#',
  } = options;
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);
  const annotationScript = annotation ? renderAnnotationScript(annotation) : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${safeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    table { border-collapse: collapse; }
    td, th { mso-line-height-rule: exactly; }
  </style>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    
    /* iOS BLUE LINKS */
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    
    /* Mobile Responsive */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-center { text-align: center !important; }
      .mobile-full-width { width: 100% !important; }
    }
  </style>
  ${annotationScript}
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bodyBg};font-family:${EMAIL_FONT_STACK};">
  
  <!-- Preheader -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${safePreheader}
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>
  
  <!-- Email Body -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${COLORS.bodyBg};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        
        <!-- Email Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-container" style="max-width:560px;margin:0 auto;">
          
          <!-- Main Card -->
          <tr>
            <td style="background-color:${COLORS.cardBg};border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
              ${contentHtml}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 20px;">
              <p style="margin:0 0 8px;font-family:${EMAIL_FONT_STACK};font-size:12px;color:${COLORS.muted};">
                ${escapeHtml(config.appName ?? 'Nab a Table')}
              </p>
              <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:12px;">
                <a href="${escapeHtml(helpUrl)}" style="color:${COLORS.text};text-decoration:underline;margin:0 8px;">Help</a>
                <span style="color:${COLORS.muted};">•</span>
                <a href="${escapeHtml(manageUrl)}" style="color:${COLORS.text};text-decoration:underline;margin:0 8px;">Manage Booking</a>
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>

</body>
</html>`.trim();
}
