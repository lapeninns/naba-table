import config from "@/config";
import { env } from "@/lib/env";
import { Resend } from "resend";

const resendApiKey = env.resend.apiKey;
const resendFrom = env.resend.from;
const configuredSupportEmail = config.email.supportEmail?.trim();

const PLACEHOLDER_EMAIL_REGEX = /@example\.(com|org|net)$/i;

function normalizeAddress(value?: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isLikelyPlaceholderEmail(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_EMAIL_REGEX.test(lower);
}

function isValidSupportLikeEmail(value: string): boolean {
  if (!value.includes("@")) return false;
  return !isLikelyPlaceholderEmail(value);
}

type ReplyToResolution = {
  address: string;
  usedFallback: boolean;
  reason?: "requested_invalid" | "configured_invalid" | "missing";
};

export function resolveReplyToAddress(options: {
  requested?: string | null;
  configured?: string | null;
  fallback: string;
}): ReplyToResolution {
  const requested = normalizeAddress(options.requested);
  if (requested && isValidSupportLikeEmail(requested)) {
    return { address: requested, usedFallback: false };
  }

  const configured = normalizeAddress(options.configured);
  if (configured && isValidSupportLikeEmail(configured)) {
    return { address: configured, usedFallback: false };
  }

  const reason: ReplyToResolution["reason"] = requested
    ? "requested_invalid"
    : configured
      ? "configured_invalid"
      : "missing";

  return {
    address: options.fallback,
    usedFallback: true,
    reason,
  };
}

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

let replyToWarningLogged = false;

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

  const replyToResolution = resolveReplyToAddress({
    requested: replyTo,
    configured: configuredSupportEmail,
    fallback: resendFrom,
  });

  if (replyToResolution.reason && !replyToWarningLogged) {
    console.warn(
      `[resend] Reply-to fallback applied (${replyToResolution.reason}). ` +
        `Update support email settings to avoid using "${replyToResolution.address}".`,
    );
    replyToWarningLogged = true;
  }

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
      replyTo: replyToResolution.address,
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
