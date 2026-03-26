import "server-only";

import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse,
  type Tag,
} from "resend";

import config from "@/config";
import { env } from "@/lib/env";
import { normalizeEmail } from "@/server/customers";
import { getSuppressedRecipientEmails } from "@/server/emails/recipient-suppression";
import { recordObservabilityEvent } from "@/server/observability";

const resendApiKey = env.resend.apiKey;
const resendFrom = env.resend.from;
const resendUseMock = env.resend.useMock;
const configuredSupportEmail = config.email.supportEmail?.trim();
const DEFAULT_MOCK_FROM_ADDRESS = "mock@nabatable.local";

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
  contentType?: string;
  type?: string;
};

type EmailBody =
  | { html: string; text?: string }
  | { html?: string; text: string };

export class EmailRecipientSuppressedError extends Error {
  readonly recipients: string[];

  constructor(recipients: string[]) {
    const recipientLabel =
      recipients.length === 1 ? "recipient is suppressed" : "recipients are suppressed";
    super(`Email delivery blocked because ${recipientLabel}.`);
    this.name = "EmailRecipientSuppressedError";
    this.recipients = recipients;
  }
}

export function isEmailRecipientSuppressedError(
  error: unknown,
): error is EmailRecipientSuppressedError {
  return error instanceof EmailRecipientSuppressedError;
}

export function createEmailIdempotencyKey(params: {
  scope: string;
  parts: Array<string | number | boolean | null | undefined>;
}): string {
  const payload = params.parts
    .map((part) => String(part ?? ""))
    .join("|");

  const digest = Buffer.from(payload, "utf-8").toString("base64url").slice(0, 180);
  return `${params.scope}:${digest}`;
}

export type SendEmailParams = EmailBody & {
  to: string | string[];
  subject: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  fromName?: string; // Optional custom name for the sender
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  tags?: Tag[];
  topicId?: string | null;
  idempotencyKey?: string;
};

function normalize(value?: string | string[]) {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

function normalizeHeaders(
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) return undefined;

  const normalizedEntries = Object.entries(headers)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0);

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries);
}

function normalizeTags(tags?: Tag[]): Tag[] | undefined {
  if (!tags?.length) return undefined;

  const normalized = tags
    .map((tag) => ({
      name: tag.name.trim(),
      value: tag.value.trim(),
    }))
    .filter((tag) => tag.name.length > 0 && tag.value.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

async function assertRecipientsAreDeliverable(recipients: string[]): Promise<void> {
  const normalizedRecipients = [...new Set(recipients.map((value) => normalizeEmail(value)).filter(Boolean))];

  if (normalizedRecipients.length === 0) {
    return;
  }

  const suppressedRecipients = await getSuppressedRecipientEmails(normalizedRecipients);

  if (suppressedRecipients.length === 0) {
    return;
  }

  await recordObservabilityEvent({
    source: "email.send",
    eventType: "recipient_suppressed",
    severity: "warning",
    context: {
      suppressedRecipientCount: suppressedRecipients.length,
      attemptedRecipientCount: normalizedRecipients.length,
    },
  });

  throw new EmailRecipientSuppressedError(suppressedRecipients);
}

let replyToWarningLogged = false;

export type SendEmailResult = {
  provider: "resend" | "mock";
  messageId: string;
};

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
  headers,
  tags,
  topicId,
  idempotencyKey,
}: SendEmailParams): Promise<SendEmailResult> {
  if (!html && !text) {
    throw new Error("Resend email payloads must include HTML or text content.");
  }

  const normalizedTo = normalize(to);
  if (!normalizedTo?.length) {
    throw new Error("At least one recipient is required to send an email.");
  }

  await assertRecipientsAreDeliverable(normalizedTo);

  const baseFromAddress = resendFrom ?? (resendUseMock ? DEFAULT_MOCK_FROM_ADDRESS : undefined);

  if (!baseFromAddress) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY/RESEND_FROM or enable RESEND_USE_MOCK.");
  }

  // Format the from address with custom name if provided
  const fromAddress = fromName ? `${fromName} <${baseFromAddress}>` : baseFromAddress;

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
  console.log(`${logPrefix} Sending email`, {
    toCount: normalizedTo.length,
    subject,
    from: fromAddress,
    hasHtml: Boolean(html),
    hasText: Boolean(text),
    attachmentCount: attachments?.length ?? 0,
    tagCount: tags?.length ?? 0,
    hasHeaders: Boolean(headers && Object.keys(headers).length > 0),
    hasTopicId: Boolean(topicId),
    hasIdempotencyKey: Boolean(idempotencyKey),
  });

  if (resendUseMock) {
    const messageId = `mock_${Date.now().toString(36)}`;
    return { provider: "mock", messageId };
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
        ...(attachment.contentType || attachment.type
          ? { contentType: attachment.contentType ?? attachment.type }
          : {}),
      };
    });

    const normalizedCc = normalize(cc);
    const normalizedBcc = normalize(bcc);
    const normalizedHeaders = normalizeHeaders(headers);
    const normalizedTags = normalizeTags(tags);

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
      ...(normalizedHeaders ? { headers: normalizedHeaders } : {}),
      ...(normalizedTags ? { tags: normalizedTags } : {}),
      ...(typeof topicId === "string" ? { topicId } : topicId === null ? { topicId: null } : {}),
    };

    const requestOptions: CreateEmailRequestOptions | undefined = idempotencyKey
      ? { idempotencyKey }
      : undefined;

    const result = (await resendClient.emails.send(payload, requestOptions)) as CreateEmailResponse;
    const providerError = result.error ?? null;
    const emailId = result.data?.id ?? null;

    if (providerError || !emailId) {
      const normalizedError = providerError ?? {
        name: "missing_id",
        message: "Resend send call succeeded without returning an email id.",
      };
      throw new Error(`Resend API error (${normalizedError.name}): ${normalizedError.message}`);
    }

    console.log(`[resend] Email sent successfully. ID: ${emailId}`);
    return { provider: "resend", messageId: emailId };
  } catch (error) {
    console.error("[resend] Failed to send email:", {
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
