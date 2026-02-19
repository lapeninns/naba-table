import { createHmac } from "node:crypto";

import { env } from "@/lib/env";
import { normalizeEmail } from "@/server/customers";
import {
  recordObservabilityEvent,
  type ObservabilitySeverity,
} from "@/server/observability";

import type { SigninSurface } from "@/server/auth/signin-surface";
import type { MagicLinkThrottleScope } from "@/server/auth/signin-throttle";
import type { Json } from "@/types/supabase";

export type MagicLinkSigninAuditOutcome =
  | "blocked_rate_limit_ip"
  | "blocked_rate_limit_global"
  | "blocked_captcha_missing"
  | "blocked_captcha_invalid"
  | "suppressed_unknown_email"
  | "sent"
  | "send_error"
  | "lookup_error"
  | "captcha_verify_unavailable";

type MagicLinkSigninAuditParams = {
  email: string;
  clientIp: string;
  userAgent?: string | null;
  surface: SigninSurface;
  outcome: MagicLinkSigninAuditOutcome;
  redirectedFrom?: string | null;
  throttleScope?: MagicLinkThrottleScope;
  throttleLimit?: number;
  throttleRemaining?: number;
  throttleResetAt?: number;
  captchaErrorCodes?: string[];
  severity?: ObservabilitySeverity;
  sendErrorReason?: string;
};

function defaultSeverityForOutcome(
  outcome: MagicLinkSigninAuditOutcome,
): ObservabilitySeverity {
  switch (outcome) {
    case "send_error":
      return "error";
    case "lookup_error":
    case "captcha_verify_unavailable":
      return "warning";
    default:
      return "info";
  }
}

function hashValue(value: string | null | undefined, secret: string | null): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || !secret) {
    return null;
  }

  return createHmac("sha256", secret).update(normalized).digest("hex");
}

function categorizeRedirectedFrom(redirectedFrom: string | null | undefined): string {
  if (!redirectedFrom) return "none";
  if (!redirectedFrom.startsWith("/")) return "external";
  if (
    redirectedFrom === "/guest" ||
    redirectedFrom.startsWith("/guest/") ||
    redirectedFrom === "/bookings" ||
    redirectedFrom.startsWith("/bookings/") ||
    redirectedFrom === "/restaurants" ||
    redirectedFrom.startsWith("/restaurants/")
  ) {
    return "guest";
  }
  if (
    redirectedFrom === "/app" ||
    redirectedFrom.startsWith("/app/") ||
    redirectedFrom === "/dashboard" ||
    redirectedFrom.startsWith("/dashboard/") ||
    redirectedFrom === "/customers" ||
    redirectedFrom.startsWith("/customers/") ||
    redirectedFrom === "/seating" ||
    redirectedFrom.startsWith("/seating/") ||
    redirectedFrom === "/settings" ||
    redirectedFrom.startsWith("/settings/")
  ) {
    return "ops";
  }
  return "other";
}

export async function recordMagicLinkSigninAudit(
  params: MagicLinkSigninAuditParams,
): Promise<void> {
  const secret = env.security.authAuditHashSecret;
  const normalizedEmail = normalizeEmail(params.email);
  const context: Record<string, Json> = {
    mode: "magic_link",
    surface: params.surface,
    outcome: params.outcome,
    redirected_from_category: categorizeRedirectedFrom(params.redirectedFrom),
    email_hash: hashValue(normalizedEmail, secret),
    ip_hash: hashValue(params.clientIp, secret),
    ua_hash: hashValue(params.userAgent, secret),
  };

  if (params.throttleScope) {
    context.throttle_scope = params.throttleScope;
  }
  if (typeof params.throttleLimit === "number") {
    context.throttle_limit = params.throttleLimit;
  }
  if (typeof params.throttleRemaining === "number") {
    context.throttle_remaining = params.throttleRemaining;
  }
  if (typeof params.throttleResetAt === "number") {
    context.throttle_reset_at = params.throttleResetAt;
  }
  if (params.captchaErrorCodes?.length) {
    context.captcha_error_codes = params.captchaErrorCodes;
  }
  if (params.sendErrorReason) {
    context.send_error_reason = params.sendErrorReason;
  }

  await recordObservabilityEvent({
    source: "auth.signin",
    eventType: "magic_link.send_attempt",
    severity: params.severity ?? defaultSeverityForOutcome(params.outcome),
    context,
  });
}
