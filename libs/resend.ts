import config from "@/config";
import { env } from "@/lib/env";
import { Resend } from "resend";

const resendApiKey = env.resend.apiKey;
const resendFrom = env.resend.from;

let resendClient: Resend | null = null;

if (resendApiKey) {
  resendClient = new Resend(resendApiKey);
} else if (env.node.env === "development") {
  console.warn("[resend] RESEND_API_KEY is missing. Emails will not be sent.");
}

if (!resendFrom && env.node.env === "development") {
  console.warn("[resend] RESEND_FROM is missing. Emails will not be sent.");
}

export type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  type?: string;
};

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  fromName?: string; // Optional custom name for the sender
  attachments?: EmailAttachment[];
};

function normalize(value?: string | string[]) {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
  bcc,
  fromName,
  attachments,
}: SendEmailParams): Promise<void> {
  if (!resendClient || !resendFrom) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY and RESEND_FROM.");
  }

  // Format the from address with custom name if provided
  const fromAddress = fromName ? `${fromName} <${resendFrom}>` : resendFrom;

  console.log(`[resend] Sending email to: ${Array.isArray(to) ? to.join(', ') : to}, subject: "${subject}", from: "${fromAddress}"`);

  try {
    const normalizedAttachments = attachments?.map((attachment) => {
      const base64Content =
        typeof attachment.content === "string"
          ? Buffer.from(attachment.content, "utf-8").toString("base64")
          : attachment.content.toString("base64");

      return {
        filename: attachment.filename,
        content: base64Content,
        ...(attachment.type ? { type: attachment.type } : {}),
      };
    });

    const payload = {
      from: fromAddress,
      to: normalize(to)!,
      subject,
      html,
      text,
      cc: normalize(cc),
      bcc: normalize(bcc),
      replyTo: replyTo ?? config.mailgun.supportEmail ?? undefined,
      attachments: normalizedAttachments,
    } satisfies Record<string, unknown>;

    const sendEmail = resendClient.emails.send.bind(resendClient.emails) as unknown as (
      body: Record<string, unknown>,
    ) => Promise<{ data?: { id?: string } | null }>; 

    const result = await sendEmail(payload);

    console.log(`[resend] Email sent successfully. ID: ${result.data?.id}`);
  } catch (error) {
    console.error("[resend] Failed to send email:", {
      to: Array.isArray(to) ? to : [to],
      subject,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
