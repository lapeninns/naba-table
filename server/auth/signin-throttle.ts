import { consumeRateLimit } from "@/server/security/rate-limit";

import type { RateLimitResult } from "@/server/security/rate-limit";

const MAGIC_LINK_RATE_LIMITS = {
  ip: { limit: 5, windowMs: 10 * 60 * 1000 },
  global: { limit: 120, windowMs: 10 * 60 * 1000 },
} as const;

export type MagicLinkThrottleScope = keyof typeof MAGIC_LINK_RATE_LIMITS;

export type MagicLinkThrottleCheck = {
  scope: MagicLinkThrottleScope;
  result: RateLimitResult;
};

export type MagicLinkThrottleOutcome =
  | {
      ok: true;
      checks: MagicLinkThrottleCheck[];
    }
  | {
      ok: false;
      checks: MagicLinkThrottleCheck[];
      blocked: MagicLinkThrottleCheck;
    };

function buildRateIdentifier(scope: MagicLinkThrottleScope, clientIp: string): string {
  if (scope === "ip") {
    return `auth:signin:magic_link:ip:${clientIp}`;
  }

  return "auth:signin:magic_link:global";
}

export async function consumeMagicLinkSigninThrottle(params: {
  clientIp: string;
}): Promise<MagicLinkThrottleOutcome> {
  const checks: MagicLinkThrottleCheck[] = [];

  const ipResult = await consumeRateLimit({
    identifier: buildRateIdentifier("ip", params.clientIp),
    limit: MAGIC_LINK_RATE_LIMITS.ip.limit,
    windowMs: MAGIC_LINK_RATE_LIMITS.ip.windowMs,
  });
  checks.push({ scope: "ip", result: ipResult });

  if (!ipResult.ok) {
    return {
      ok: false,
      checks,
      blocked: checks[checks.length - 1],
    };
  }

  const globalResult = await consumeRateLimit({
    identifier: buildRateIdentifier("global", params.clientIp),
    limit: MAGIC_LINK_RATE_LIMITS.global.limit,
    windowMs: MAGIC_LINK_RATE_LIMITS.global.windowMs,
  });
  checks.push({ scope: "global", result: globalResult });

  if (!globalResult.ok) {
    return {
      ok: false,
      checks,
      blocked: checks[checks.length - 1],
    };
  }

  return {
    ok: true,
    checks,
  };
}
