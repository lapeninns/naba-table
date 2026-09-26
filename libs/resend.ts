import "server-only";

import { createHash } from "node:crypto";
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
import { type EmailCategory, isEssentialCategory } from "@/server/emails/email-categories";
import { getEmailSuppressionStates } from "@/server/emails/email-suppression-list";
import { buildListUnsubscribeHeaders } from "@/server/emails/list-unsubscribe";
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

const MAX_DISPLAY_NAME_LENGTH = 128;
const EMBEDDED_EMAIL_FRAGMENT_REGEX = /<[^<>]*@[^<>]*>/g;

function stripControlCharacters(value: string): string {
  let result = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    // Drop C0 controls (incl. CR/LF/tab) and DEL, replacing each with a space so
    // surrounding words do not run together. Other characters pass through.
    result += code <= 31 || code === 127 ? " " : char;
  }
  return result;
}

/**
 * Sanitizes a free-text display name before it is interpolated into the email
 * `From` header (e.g. `Name <addr@host>`). Restaurant names are operator-supplied
 * and would otherwise allow header/display-name injection: CR/LF could smuggle
 * extra headers, and `<...@...>` fragments could spoof the sending address.
 *
 * Defense in depth: strips control characters (incl. CR/LF), removes embedded
 * email fragments and any angle brackets/`@`, collapses whitespace, and caps
 * length. Returns undefined when nothing usable remains so callers fall back to
 * the bare address.
 */
export function sanitizeDisplayName(value?: string | null): string | undefined {
  if (!value) return undefined;

  const withoutFragments = value.replace(EMBEDDED_EMAIL_FRAGMENT_REGEX, " ");
  const sanitized = stripControlCharacters(withoutFragments)
    .replace(/[<>@]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH)
    .trim();

  return sanitized.length > 0 ? sanitized : undefined;
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

/**
 * A send the provider answered with an error. `providerErrorName` and `statusCode` come from the
 * Resend SDK's error response, so callers can classify failures without parsing the message.
 * The message format ("Resend API error (<name>): <message>") is unchanged for existing logs.
 */
export class ResendSendError extends Error {
  readonly providerErrorName: string;
  readonly statusCode: number | null;

  constructor(params: { name: string; message: string; statusCode?: number | null }) {
    super(`Resend API error (${params.name}): ${params.message}`);
    this.name = "ResendSendError";
    this.providerErrorName = params.name;
    this.statusCode = typeof params.statusCode === "number" ? params.statusCode : null;
  }
}

export function isResendSendError(error: unknown): error is ResendSendError {
  return error instanceof ResendSendError;
}

// Errors Resend returns when it rejected the request before accepting any email. Anything else
// (application_error: the SDK's wrapper for network failures and timeouts, internal_server_error,
// missing_id, concurrent/invalid idempotent request) may hide an accepted send.
const RESEND_NOT_SENT_ERROR_NAMES = new Set([
  "validation_error",
  "invalid_parameter",
  "missing_required_field",
  "invalid_from_address",
  "invalid_idempotency_key",
  "invalid_access",
  "invalid_region",
  "missing_api_key",
  "invalid_api_key",
  "suspended_api_key",
  "rate_limit_exceeded",
  "not_found",
  "method_not_allowed",
]);

/**
 * True only when the provider definitively did not accept the email, so a retry may use a new
 * idempotency key without risking a duplicate. Thrown non-provider errors are not definitive.
 */
export function isDefinitiveResendNotSent(error: unknown): boolean {
  return isResendSendError(error) && RESEND_NOT_SENT_ERROR_NAMES.has(error.providerErrorName);
}

/**
 * The provider rejected the message itself (malformed or invalid recipient/payload): the same
 * send can never succeed. A 403 validation_error (unverified domain, testing-mode recipient
 * restriction) is a sender configuration problem and is not included.
 */
export function isResendRejectedMessageError(error: unknown): boolean {
  return (
    isResendSendError(error) &&
    (error.statusCode === 400 || error.statusCode === 422) &&
    (error.providerErrorName === "validation_error" ||
      error.providerErrorName === "invalid_parameter" ||
      error.providerErrorName === "missing_required_field")
  );
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

/**
 * Idempotency key from a SHA-256 digest of every part, so no part (tenant, recipient, client
 * request key) is ever truncated away and keys from different tenants cannot collide.
 */
export function createHashedEmailIdempotencyKey(params: {
  scope: string;
  parts: Array<string | number | boolean | null | undefined>;
}): string {
  const payload = params.parts.map((part) => String(part ?? "")).join("|");
  const digest = createHash("sha256").update(payload, "utf8").digest("base64url");
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
  /**
   * Drives the transactional/marketing split. Essential categories (the default) are
   * always delivered unless the address is hard-suppressed (bounce/complaint); optional
   * categories additionally honour one-click unsubscribes. Defaults to essential.
   */
  category?: EmailCategory;
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

async function assertRecipientsAreDeliverable(
  recipients: string[],
  essential: boolean,
): Promise<void> {
  const normalizedRecipients = [...new Set(recipients.map((value) => normalizeEmail(value)).filter(Boolean))];

  if (normalizedRecipients.length === 0) {
    return;
  }

  // Profile-bound suppression (set by the bounce/complaint webhook) is always HARD.
  // The email-keyed list distinguishes hard (bounce/complaint/manual) from soft
  // (one-click marketing opt-out).
  const [profileSuppressed, listStates] = await Promise.all([
    getSuppressedRecipientEmails(normalizedRecipients),
    getEmailSuppressionStates(normalizedRecipients),
  ]);

  const hardBlocked = new Set<string>([...profileSuppressed, ...listStates.hard]);

  // Essential mail is blocked only by hard suppression; optional mail additionally
  // honours soft (marketing) opt-outs.
  const blocked = essential ? [...hardBlocked] : [...new Set([...hardBlocked, ...listStates.soft])];

  if (blocked.length === 0) {
    return;
  }

  await recordObservabilityEvent({
    source: "email.send",
    eventType: "recipient_suppressed",
    severity: "warning",
    context: {
      suppressedRecipientCount: blocked.length,
      attemptedRecipientCount: normalizedRecipients.length,
      essential,
    },
  });

  throw new EmailRecipientSuppressedError(blocked);
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
  category,
}: SendEmailParams): Promise<SendEmailResult> {
  if (!html && !text) {
    throw new Error("Resend email payloads must include HTML or text content.");
  }

  const normalizedTo = normalize(to);
  if (!normalizedTo?.length) {
    throw new Error("At least one recipient is required to send an email.");
  }

  // Untagged sends default to essential so a missing category can never drop transactional mail.
  const essential = category ? isEssentialCategory(category) : true;
  await assertRecipientsAreDeliverable(normalizedTo, essential);

  const baseFromAddress = resendFrom ?? (resendUseMock ? DEFAULT_MOCK_FROM_ADDRESS : undefined);

  if (!baseFromAddress) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY/RESEND_FROM or enable RESEND_USE_MOCK.");
  }

  // Format the from address with custom name if provided. The display name is
  // sanitized first to prevent header/display-name injection via untrusted input
  // (e.g. operator-supplied restaurant names).
  const safeFromName = sanitizeDisplayName(fromName);
  const fromAddress = safeFromName ? `${safeFromName} <${baseFromAddress}>` : baseFromAddress;

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
    // Attach one-click List-Unsubscribe headers for single-recipient sends (the
    // transactional norm). The token is per-recipient, so it is only meaningful when
    // there is exactly one `to`. Caller-supplied headers win if they set their own.
    const listUnsubscribeHeaders =
      normalizedTo.length === 1 ? buildListUnsubscribeHeaders(normalizedTo[0]) : {};
    const normalizedHeaders = normalizeHeaders({ ...listUnsubscribeHeaders, ...headers });
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
      throw new ResendSendError(
        providerError
          ? {
              name: providerError.name,
              message: providerError.message,
              statusCode: providerError.statusCode,
            }
          : {
              name: "missing_id",
              message: "Resend send call succeeded without returning an email id.",
            },
      );
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
