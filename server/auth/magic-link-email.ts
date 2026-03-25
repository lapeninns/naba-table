import { createHash } from "node:crypto";

import config from "@/config";
import { env } from "@/lib/env";
import { createEmailIdempotencyKey, sendEmail } from "@/libs/resend";
import { escapeHtml, renderButton, renderEmailBase } from "@/server/emails/base";
import { getServiceSupabaseClient } from "@/server/supabase";

type MagicLinkIntent = "signin" | "signup";
type MagicLinkMetadata = Record<string, string | number | boolean | null>;

export type SendAuthMagicLinkParams = {
  email: string;
  emailRedirectTo: string;
  intent: MagicLinkIntent;
  data?: MagicLinkMetadata;
};

type MagicLinkDeliveryReason =
  | "generate_link_failed"
  | "invalid_link_payload"
  | "email_delivery_failed";

type MagicLinkGenerateResult = {
  properties?: {
    action_link?: unknown;
    verification_type?: unknown;
  } | null;
};

const MAGIC_LINK_FAILURE_MESSAGE = "We couldn't send a magic link right now. Please try again shortly.";

function normalizeHttpStatus(status: number | undefined, fallback: number): number {
  if (typeof status !== "number" || !Number.isFinite(status)) {
    return fallback;
  }
  const parsed = Math.trunc(status);
  if (parsed < 400 || parsed > 599) {
    return fallback;
  }
  return parsed;
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function extractActionLink(data: MagicLinkGenerateResult | null): string {
  const actionLink = data?.properties?.action_link;
  if (typeof actionLink !== "string" || actionLink.trim().length === 0) {
    throw new MagicLinkDeliveryError(
      "Supabase generateLink response did not include a usable action link.",
      500,
      "invalid_link_payload",
    );
  }

  const verificationType = data?.properties?.verification_type;
  if (typeof verificationType === "string" && verificationType.toLowerCase() !== "magiclink") {
    throw new MagicLinkDeliveryError(
      `Unexpected verification type from Supabase generateLink: ${verificationType}`,
      500,
      "invalid_link_payload",
    );
  }

  return actionLink;
}

function buildMagicLinkContent(params: {
  magicLink: string;
  intent: MagicLinkIntent;
  loginUrl: string;
  helpUrl: string;
}) {
  const { magicLink, intent, loginUrl, helpUrl } = params;
  const isSignup = intent === "signup";
  const appName = config.appName ?? "Nab a Table";
  const actionLabel = isSignup ? "Complete sign up" : "Sign in now";
  const title = isSignup ? `Complete your ${appName} sign up` : `Your ${appName} magic sign-in link`;
  const preheader = isSignup
    ? "Use this one-time secure link to finish creating your account."
    : "Use this one-time secure link to sign in instantly.";
  const bodyCopy = isSignup
    ? "Tap the button below to finish creating your account. This link is one-time and expires shortly."
    : "Tap the button below to sign in. This link is one-time and expires shortly.";

  const contentHtml = `
    <div style="font-family:Arial,sans-serif;">
      <p style="margin:0 0 16px;color:#111827;font-size:16px;">Hi,</p>
      <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.6;">${escapeHtml(bodyCopy)}</p>
      ${renderButton(actionLabel, magicLink)}
      <p style="margin:24px 0 0;color:#4b5563;font-size:13px;line-height:1.6;">
        If the button does not work, copy this link into your browser:
      </p>
      <p style="margin:8px 0 0;color:#111827;font-size:13px;word-break:break-all;">
        <a href="${escapeHtml(magicLink)}" style="color:#111827;text-decoration:underline;">${escapeHtml(magicLink)}</a>
      </p>
    </div>
  `;

  const html = renderEmailBase({
    title,
    preheader,
    contentHtml,
    manageUrl: loginUrl,
    helpUrl,
  });

  const text = [
    `Hi,`,
    ``,
    bodyCopy,
    ``,
    `${actionLabel}: ${magicLink}`,
    ``,
    `If you did not request this email, you can ignore it.`,
  ].join("\n");

  return {
    subject: title,
    html,
    text,
  };
}

function buildMagicLinkIdempotencyKey(params: {
  email: string;
  intent: MagicLinkIntent;
  actionLink: string;
  redirectTo: string;
}) {
  const digest = createHash("sha256")
    .update([params.email, params.intent, params.actionLink, params.redirectTo].join("|"))
    .digest("hex")
    .slice(0, 16);

  return createEmailIdempotencyKey({
    scope: "auth-magic-link",
    parts: [params.email, params.intent, digest],
  });
}

export class MagicLinkDeliveryError extends Error {
  readonly status: number;
  readonly reason: MagicLinkDeliveryReason;

  constructor(message: string, status: number, reason: MagicLinkDeliveryReason) {
    super(message);
    this.name = "MagicLinkDeliveryError";
    this.status = normalizeHttpStatus(status, 500);
    this.reason = reason;
  }
}

export function isMagicLinkDeliveryError(error: unknown): error is MagicLinkDeliveryError {
  return error instanceof MagicLinkDeliveryError;
}

export function getMagicLinkFailure(error: unknown, fallbackMessage: string) {
  if (isMagicLinkDeliveryError(error)) {
    return { status: error.status, message: fallbackMessage };
  }

  return { status: 500, message: fallbackMessage };
}

export async function sendAuthMagicLink(params: SendAuthMagicLinkParams): Promise<void> {
  const { email, emailRedirectTo, intent, data } = params;
  const serviceSupabase = getServiceSupabaseClient();
  const options = data ? { redirectTo: emailRedirectTo, data } : { redirectTo: emailRedirectTo };

  const { data: generatedLink, error } = await serviceSupabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options,
  });

  if (error) {
    throw new MagicLinkDeliveryError(
      error.message ?? "Supabase failed to generate a magic link.",
      normalizeHttpStatus(error.status, 400),
      "generate_link_failed",
    );
  }

  const actionLink = extractActionLink(generatedLink as MagicLinkGenerateResult | null);

  const loginUrl = new URL(config.auth.loginUrl, env.app.url).toString();
  const supportEmail = config.email.supportEmail?.trim();
  const helpUrl = supportEmail ? `mailto:${supportEmail}` : loginUrl;
  const message = buildMagicLinkContent({
    magicLink: actionLink,
    intent,
    loginUrl,
    helpUrl,
  });

  try {
    await sendEmail({
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      fromName: config.appName,
      tags: [
        { name: "email_type", value: "auth_magic_link" },
        { name: "template_type", value: intent },
      ],
      idempotencyKey: buildMagicLinkIdempotencyKey({
        email,
        intent,
        actionLink,
        redirectTo: emailRedirectTo,
      }),
    });
  } catch (error) {
    throw new MagicLinkDeliveryError(
      `Resend delivery failed: ${asErrorMessage(error)}`,
      500,
      "email_delivery_failed",
    );
  }
}

export { MAGIC_LINK_FAILURE_MESSAGE };
