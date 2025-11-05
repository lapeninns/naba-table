import config from "@/config";

export const EMAIL_FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export type ButtonOptions = {
  variant?: "primary" | "secondary";
  align?: "left" | "center" | "right";
  widthPx?: number; // Outlook/VML fallback width
};

export function renderButton(label: string, href: string, opts: ButtonOptions = {}): string {
  const { variant = "primary", align = "left", widthPx = 260 } = opts;
  const safeLabel = escapeHtml(label);
  const safeHref = escapeHtml(href);
  const isPrimary = variant === "primary";
  const background = isPrimary ? "#4338ca" : "#ffffff";
  const color = isPrimary ? "#ffffff" : "#111827";
  const border = isPrimary ? "border:0;" : "border:1px solid #dbe4ff;";

  // Bulletproof button with VML fallback for Outlook desktop
  return `
  <div style="text-align:${align};">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:44px;v-text-anchor:middle;width:${widthPx}px;" arcsize="50%" ${isPrimary ? 'strokecolor="#4338ca" fillcolor="#4338ca"' : 'strokecolor="#dbe4ff" fillcolor="#ffffff"'}>
      <w:anchorlock/>
      <center style="color:${color};font-family:${EMAIL_FONT_STACK};font-size:15px;font-weight:600;">${safeLabel}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <a href="${safeHref}" style="${border}display:inline-block;padding:14px 28px;border-radius:999px;background:${background};color:${color};font-family:${EMAIL_FONT_STACK};font-weight:600;font-size:15px;text-decoration:none;min-height:44px;line-height:1.35;">${safeLabel}</a>
    <!--<![endif]-->
  </div>`;
}

export type EmailBaseOptions = {
  title: string;
  preheader?: string;
  contentHtml: string; // inner content only
  backgroundColor?: string;
  containerMaxWidth?: number; // e.g., 600
  headerHtml?: string; // optional brand/header
  footerHtml?: string; // optional footer
};

export function renderEmailBase(options: EmailBaseOptions): string {
  const {
    title,
    preheader = "",
    contentHtml,
    headerHtml,
    footerHtml,
    backgroundColor = "#F5F7FF",
    containerMaxWidth = 600,
  } = options;

  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader);

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${safeTitle}</title>
    <style>
      /* Reset */
      html, body { margin:0; padding:0; height:100%; }
      body { width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; background:${backgroundColor}; }
      img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; max-width:100%; height:auto; display:block; }
      table { border-collapse:collapse; }
      a { color:#4338ca; }

      /* Container */
      .email-shell { padding: 36px 16px; }
      .container { width:100%; max-width:${containerMaxWidth}px; margin:0 auto; }
      .card { background:#ffffff; border-radius:20px; box-shadow:0 1px 0 rgba(2,6,23,.04); overflow:hidden; }

      /* Grid helpers */
      .stack-column, .stack-column table, .stack-column tbody, .stack-column tr, .stack-column td { display:block; width:100% !important; }

      /* Utilities */
      .sm-hidden { display:none !important; }

      @media only screen and (max-width: 600px) {
        .email-shell { padding: 24px 12px !important; }
        .card { border-radius: 16px !important; }
        .text-center-sm { text-align:center !important; }
        .space-y-sm > * + * { margin-top: 16px !important; }
      }
    </style>
  </head>
  <body>
    <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;line-height:1px;">${safePreheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${backgroundColor};">
      <tr>
        <td class="email-shell" align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="container">
            ${headerHtml ? `<tr><td style="padding:0 0 16px 0;">${headerHtml}</td></tr>` : ""}
            <tr>
              <td>
                ${contentHtml}
              </td>
            </tr>
            ${footerHtml ? `<tr><td style="padding-top:16px;">${footerHtml}</td></tr>` : ""}
            <tr>
              <td align="center" style="padding-top:16px;">
                <p style="margin:0;color:#94a3b8;font-size:12px;font-family:${EMAIL_FONT_STACK};line-height:1.6;">
                  ${escapeHtml(config.appName ?? "SajiloReserveX")} · Do not reply to this automated message.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
