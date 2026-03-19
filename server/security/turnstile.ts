import { env } from "@/lib/env";

type TurnstileVerifyApiResponse = {
  success?: unknown;
  action?: unknown;
  hostname?: unknown;
  ["error-codes"]?: unknown;
};

export type TurnstileVerifyFailureReason =
  | "missing_secret"
  | "verification_failed"
  | "action_mismatch"
  | "hostname_mismatch"
  | "verify_unavailable";

export type TurnstileVerifyResult =
  | {
      ok: true;
      action: string | null;
      hostname: string | null;
      errorCodes: string[];
    }
  | {
      ok: false;
      reason: TurnstileVerifyFailureReason;
      action: string | null;
      hostname: string | null;
      errorCodes: string[];
    };

type VerifyTurnstileTokenParams = {
  token: string;
  remoteIp?: string;
  expectedAction?: string;
  expectedHostname?: string;
};

function normalizeErrorCodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toFailure(
  reason: TurnstileVerifyFailureReason,
  errorCodes: string[],
  action: string | null,
  hostname: string | null,
): TurnstileVerifyResult {
  return {
    ok: false,
    reason,
    errorCodes,
    action,
    hostname,
  };
}

export async function verifyTurnstileToken(
  params: VerifyTurnstileTokenParams,
): Promise<TurnstileVerifyResult> {
  const secret = env.security.turnstileSecretKey;
  if (!secret) {
    return toFailure("missing_secret", ["missing-secret"], null, null);
  }

  const payload = new URLSearchParams();
  payload.set("secret", secret);
  payload.set("response", params.token);

  if (params.remoteIp && params.remoteIp !== "unknown") {
    payload.set("remoteip", params.remoteIp);
  }

  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
      cache: "no-store",
    });
  } catch {
    return toFailure("verify_unavailable", ["verification-request-failed"], null, null);
  }

  if (!response.ok) {
    return toFailure(
      "verify_unavailable",
      [`verification-http-${response.status}`],
      null,
      null,
    );
  }

  let verifyBody: TurnstileVerifyApiResponse;
  try {
    verifyBody = (await response.json()) as TurnstileVerifyApiResponse;
  } catch {
    return toFailure("verify_unavailable", ["verification-invalid-json"], null, null);
  }

  const errorCodes = normalizeErrorCodes(verifyBody["error-codes"]);
  const action = typeof verifyBody.action === "string" ? verifyBody.action : null;
  const hostname = typeof verifyBody.hostname === "string" ? verifyBody.hostname : null;
  const success = verifyBody.success === true;

  if (!success) {
    return toFailure("verification_failed", errorCodes, action, hostname);
  }

  if (params.expectedAction && action && action !== params.expectedAction) {
    return toFailure("action_mismatch", errorCodes, action, hostname);
  }

  const expectedHostname = params.expectedHostname ?? env.security.turnstileExpectedHostname;
  if (expectedHostname) {
    const normalizedExpected = expectedHostname.toLowerCase();
    const normalizedReceived = hostname?.toLowerCase() ?? null;
    if (normalizedReceived && normalizedExpected !== normalizedReceived) {
      return toFailure("hostname_mismatch", errorCodes, action, hostname);
    }
  }

  return {
    ok: true,
    action,
    hostname,
    errorCodes,
  };
}
