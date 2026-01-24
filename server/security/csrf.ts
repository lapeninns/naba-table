import { randomBytes, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";


import { env } from "@/lib/env";
import { buildCsrfCookieOptions, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/security/csrf";

import type { NextRequest } from "next/server";

const TOKEN_LENGTH_BYTES = 32;

async function shouldUseSecureCookie() {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  if (rootDomain === "localhost") {
    return false;
  }
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto");
  if (proto) {
    return proto.split(",")[0]?.trim().toLowerCase() === "https";
  }
  return env.node.appEnv !== "development";
}

export async function ensureCsrfCookie(): Promise<string> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const token = existingToken ?? randomBytes(TOKEN_LENGTH_BYTES).toString("hex");
  const secure = await shouldUseSecureCookie();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const cookieOptions = buildCsrfCookieOptions({ rootDomain, secure });

  if (!existingToken && typeof (cookieStore as { set?: unknown }).set === "function") {
    cookieStore.set({
      name: CSRF_COOKIE_NAME,
      value: token,
      ...cookieOptions,
      priority: "high",
    });
  }

  return token;
}

export function validateCsrfToken(req: NextRequest): boolean {
  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!headerToken || !cookieToken) {
    return false;
  }

  const headerBuffer = Buffer.from(headerToken);
  const cookieBuffer = Buffer.from(cookieToken);

  if (headerBuffer.length !== cookieBuffer.length) {
    return false;
  }

  try {
    return timingSafeEqual(headerBuffer, cookieBuffer);
  } catch {
    return false;
  }
}
