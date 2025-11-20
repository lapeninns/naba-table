import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailResponse,
} from "resend";

import config from "@/config";
import { env } from "@/lib/env";

const resendApiKey = env.resend.apiKey;
const resendFrom = env.resend.from;
const resendUseMock = env.resend.useMock;
const configuredSupportEmail = config.email.supportEmail?.trim();
const DEFAULT_MOCK_FROM_ADDRESS = "mock@shipfast.local";

const PLACEHOLDER_EMAIL_REGEX = /@example\.(com|org|net)$/i;

export type ResendErrorCode =
  | "RESEND_NOT_CONFIGURED"
  | "RESEND_FROM_INVALID"
  | "RESEND_VALIDATION_ERROR"
  | "RESEND_PROVIDER_ERROR"
  | "RESEND_MISSING_ID";

export class ResendEmailError extends Error {
  code: ResendErrorCode;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    options: { code: ResendErrorCode; status?: number; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "ResendEmailError";
    this.code = options.code;
    this.status = options.status ?? 500;
    this.details = options.details;
  }
}

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
} else if (!resendUseMock) {
  console.warn(
    "[resend] RESEND_API_KEY is missing and mock transport is disabled. Emails will not be sent.",
  );
}

if (!resendFrom && !resendUseMock) {
  console.warn(
    "[resend] RESEND_FROM is missing and mock transport is disabled. Emails will not be sent.",
  );
}

export type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  type?: string;
};

type EmailBody =
  | { html: string; text?: string }
  | { html?: string; text: string };

export type SendEmailParams = EmailBody & {
  to: string | string[];
  subject: string;
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

type ParsedFromAddress = { email: string; name?: string };

function parseFromAddress(value: string): ParsedFromAddress | null {
  const trimmed = value.trim();
  const angledMatch = trimmed.match(/^(.+?)<([^>]+)>$/);
  if (angledMatch) {
    const name = angledMatch[1].trim();
    const email = angledMatch[2].trim();
    return email.includes("@") ? { email, name: name.length ? name : undefined } : null;
  }
  return trimmed.includes("@") ? { email: trimmed } : null;
}

function sanitizeDisplayName(value?: string | null): string | undefined {
  if (!value) return undefined;
  const withoutAngles = value.replace(/<[^>]*>/g, " ");
  const withoutEmails = withoutAngles.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, " ");
  const normalized = withoutEmails.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildFromAddress(baseFromAddress: string, requestedName?: string) {
  const parsed = parseFromAddress(baseFromAddress);
  if (!parsed) {
    throw new ResendEmailError("Invalid Resend from address configuration.", {
      code: "RESEND_FROM_INVALID",
      details: { from: baseFromAddress },
    });
  }

  const sanitizedName = sanitizeDisplayName(requestedName);
  const displayName = sanitizedName ?? parsed.name;

  return {
    formatted: displayName ? `${displayName} <${parsed.email}>` : parsed.email,
    sanitizedName,
  };
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
  if (!html && !text) {
    throw new Error("Resend email payloads must include HTML or text content.");
  }

  const normalizedTo = normalize(to);
  if (!normalizedTo?.length) {
    throw new Error("At least one recipient is required to send an email.");
  }

  const baseFromAddress = resendFrom ?? (resendUseMock ? DEFAULT_MOCK_FROM_ADDRESS : undefined);

  if (!baseFromAddress) {
    throw new ResendEmailError(
      "Resend is not configured. Set RESEND_API_KEY/RESEND_FROM or enable RESEND_USE_MOCK.",
      { code: "RESEND_NOT_CONFIGURED" },
    );
  }

  const { formatted: fromAddress, sanitizedName } = buildFromAddress(baseFromAddress, fromName);

  if (sanitizedName && sanitizedName !== fromName) {
    console.warn(
      `[resend] Sender name sanitized; using "${sanitizedName}" instead of the provided value.`,
    );
  }

  const replyToResolution = resolveReplyToAddress({
    requested: replyTo,
    configured: configuredSupportEmail,
    fallback: baseFromAddress,
  });

  if (replyToResolution.reason && !replyToWarningLogged) {
    console.warn(
      `[resend] Reply-to fallback applied (${replyToResolution.reason}). ` +
        `Update support email settings to avoid using "${replyToResolution.address}".`,
    );
    replyToWarningLogged = true;
  }

  const logPrefix = resendUseMock ? "[resend] (mock)" : "[resend]";
  console.log(
    `${logPrefix} Sending email to: ${Array.isArray(to) ? to.join(', ') : to}, subject: "${subject}", from: "${fromAddress}"`,
  );

  if (resendUseMock) {
    console.log("[resend] (mock) Email delivery skipped.", {
      to: normalizedTo,
      subject,
      hasHtml: Boolean(html),
      hasText: Boolean(text),
      attachmentCount: attachments?.length ?? 0,
    });
    return;
  }

  if (!resendClient) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY and RESEND_FROM.");
  }

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

    const normalizedCc = normalize(cc);
    const normalizedBcc = normalize(bcc);

    const bodyFields =
      html && text
        ? { html, text }
        : html
          ? { html }
          : { text: text! };

    const payload: CreateEmailOptions = {
      from: fromAddress,
      to: normalizedTo,
      subject,
      replyTo: replyToResolution.address,
      ...bodyFields,
      ...(normalizedCc ? { cc: normalizedCc } : {}),
      ...(normalizedBcc ? { bcc: normalizedBcc } : {}),
      ...(normalizedAttachments?.length ? { attachments: normalizedAttachments } : {}),
    };

    const result = (await resendClient.emails.send(payload)) as CreateEmailResponse;
    const providerError = result.error ?? null;
    const emailId = result.data?.id ?? null;

    if (providerError || !emailId) {
      const normalizedError = providerError ?? {
        name: "missing_id",
        message: "Resend send call succeeded without returning an email id.",
      };

      if (normalizedError.name === "validation_error") {
        throw new ResendEmailError(`Resend API validation error: ${normalizedError.message}`, {
          code: "RESEND_VALIDATION_ERROR",
          status: 400,
          details: { providerError: normalizedError },
        });
      }

      const code: ResendErrorCode =
        normalizedError.name === "missing_id" ? "RESEND_MISSING_ID" : "RESEND_PROVIDER_ERROR";

      throw new ResendEmailError(`Resend API error (${normalizedError.name}): ${normalizedError.message}`, {
        code,
        status: 502,
        details: { providerError: normalizedError },
      });
    }

    console.log(`[resend] Email sent successfully. ID: ${emailId}`);
  } catch (error) {
    const resendError = error instanceof ResendEmailError ? error : null;
    console.error("[resend] Failed to send email:", {
      to: Array.isArray(to) ? to : [to],
      subject,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: resendError?.code,
      details: resendError?.details,
    });
    throw error;
  }
}
