import config from "@/config";

export const EMAIL_FONT_STACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";

export const COLORS = {
  primary: "#4f46e5", // Indigo 600
  primaryDark: "#4338ca", // Indigo 700
  background: "#f1f5f9", // Slate 100
  card: "#ffffff",
  text: {
    main: "#0f172a", // Slate 900
    secondary: "#334155", // Slate 700
    muted: "#64748b", // Slate 500
    light: "#94a3b8", // Slate 400
  },
  border: "#e2e8f0", // Slate 200
  success: {
    bg: "#dcfce7",
    text: "#166534",
    border: "#22c55e",
  },
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export type ButtonOptions = {
  variant?: "primary" | "secondary" | "outline";
  align?: "left" | "center" | "right";
  widthPx?: number;
  fullWidth?: boolean;
};

export function renderButton(label: string, href: string, opts: ButtonOptions = {}): string {
  const { variant = "primary", align = "center", widthPx = 240, fullWidth = false } = opts;
  const safeLabel = escapeHtml(label);
  const safeHref = escapeHtml(href);

  let bg = COLORS.primary;
  let color = "#ffffff";
  let border = `1px solid ${COLORS.primary}`;

  if (variant === "secondary") {
    bg = "#f8fafc";
    color = COLORS.text.main;
    border = `1px solid ${COLORS.border}`;
  } else if (variant === "outline") {
    bg = "transparent";
    color = COLORS.primary;
    border = `1px solid ${COLORS.primary}`;
  }

  const widthStyle = fullWidth ? "width:100%;" : `width:${widthPx}px;`;
  const alignStyle = align === "center" ? "margin:0 auto;" : align === "right" ? "margin-left:auto;" : "";

  return `
  <div style="text-align:${align};width:100%;">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;${widthStyle}" arcsize="100%" strokecolor="${variant === 'outline' ? COLORS.primary : bg}" fillcolor="${variant === 'outline' ? '#ffffff' : bg}">
      <w:anchorlock/>
      <center style="color:${color};font-family:${EMAIL_FONT_STACK};font-size:16px;font-weight:600;">${safeLabel}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${safeHref}" style="display:inline-block;padding:14px 24px;border-radius:9999px;background:${bg};color:${color};${border};font-family:${EMAIL_FONT_STACK};font-weight:600;font-size:16px;text-decoration:none;text-align:center;box-sizing:border-box;${widthStyle}${alignStyle}">${safeLabel}</a>
    <!--<![endif]-->
  </div>`;
}

export function renderDivider(margin: string = "24px 0"): string {
  return `<hr style="border:none;border-top:1px solid ${COLORS.border};margin:${margin};" />`;
}

export function renderBadge(label: string, color: string = COLORS.primary, bg: string = "#eef2ff"): string {
  return `<span style="display:inline-block;padding:6px 12px;border-radius:9999px;background:${bg};color:${color};font-family:${EMAIL_FONT_STACK};font-size:12px;font-weight:600;letter-spacing:0.025em;text-transform:uppercase;">${escapeHtml(label)}</span>`;
}

export type QuickAction = {
  label: string;
  href: string;
  icon: string; // Emoji or simple character
};

export function renderQuickActions(actions: QuickAction[]): string {
  const actionHtml = actions.map(action => `
    <td align="center" style="padding:0 8px;width:${100 / actions.length}%;">
      <a href="${escapeHtml(action.href)}" style="display:block;text-decoration:none;color:${COLORS.text.secondary};">
        <div style="width:48px;height:48px;margin:0 auto 8px;background:#f1f5f9;border-radius:12px;line-height:48px;font-size:24px;">${action.icon}</div>
        <span style="display:block;font-family:${EMAIL_FONT_STACK};font-size:12px;font-weight:500;color:${COLORS.text.secondary};">${escapeHtml(action.label)}</span>
      </a>
    </td>
  `).join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;margin-bottom:24px;">
      <tr>${actionHtml}</tr>
    </table>
  `;
}

export type KeyValueItem = {
  label: string;
  value: string;
  isLink?: boolean;
  href?: string;
};

export function renderKeyValueGrid(items: KeyValueItem[]): string {
  const rows = items.map(item => {
    const valueHtml = item.isLink && item.href
      ? `<a href="${escapeHtml(item.href)}" style="color:${COLORS.primary};text-decoration:none;">${escapeHtml(item.value)}</a>`
      : `<span style="color:${COLORS.text.main};">${escapeHtml(item.value)}</span>`;

    return `
      <tr>
        <td style="padding-bottom:16px;vertical-align:top;width:35%;">
          <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:13px;color:${COLORS.text.muted};font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(item.label)}</p>
        </td>
        <td style="padding-bottom:16px;vertical-align:top;">
          <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:15px;color:${COLORS.text.main};font-weight:500;">${valueHtml}</p>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${rows}
    </table>
  `;
}

export type EmailBaseOptions = {
  title: string;
  preheader?: string;
  contentHtml: string;
  backgroundColor?: string;
  containerMaxWidth?: number;
  headerHtml?: string;
  footerHtml?: string;
};

export function renderEmailBase(options: EmailBaseOptions): string {
  const {
    title,
    preheader = "",
    contentHtml,
    headerHtml,
    footerHtml,
    backgroundColor = COLORS.background,
    containerMaxWidth = 600,
  } = options;

  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);

  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${safeTitle}</title>
    <!--[if mso]>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
    <![endif]-->
    <style>
      /* Reset */
      html, body { margin:0; padding:0; height:100% !important; width:100% !important; }
      body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background-color:${backgroundColor}; }
      img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; display:block; }
      table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
      td { vertical-align:top; }
      a { color:${COLORS.primary}; text-decoration:none; }
      
      /* Typography */
      h1, h2, h3, p { margin:0; }
      
      /* Mobile */
      @media only screen and (max-width: 600px) {
        .email-shell { padding: 16px 12px !important; }
        .container { width: 100% !important; max-width: 100% !important; }
        .card { border-radius: 12px !important; padding: 24px 20px !important; }
        .mobile-stack { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
        .mobile-center { text-align: center !important; }
        .mobile-hidden { display: none !important; }
        .mobile-mt { margin-top: 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${backgroundColor};">
    <div style="display:none;font-size:1px;color:${backgroundColor};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${safePreheader}
      &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${backgroundColor};">
      <tr>
        <td align="center" class="email-shell" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="container" style="max-width:${containerMaxWidth}px;margin:0 auto;">
            
            <!-- Header -->
            ${headerHtml ? `<tr><td align="center" style="padding-bottom:24px;">${headerHtml}</td></tr>` : ""}
            
            <!-- Content -->
            <tr>
              <td class="card" style="background-color:${COLORS.card};border-radius:24px;padding:40px;box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
                ${contentHtml}
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top:32px;padding-bottom:32px;">
                ${footerHtml || `
                  <p style="margin:0 0 12px;font-family:${EMAIL_FONT_STACK};font-size:12px;color:${COLORS.text.light};text-align:center;">
                    ${escapeHtml(config.appName ?? "Nab a Table")}
                  </p>
                  <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:12px;color:${COLORS.text.light};text-align:center;">
                    &copy; ${new Date().getFullYear()} All rights reserved.
                  </p>
                `}
              </td>
            </tr>
            
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
