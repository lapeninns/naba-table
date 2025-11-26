import { randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";


import { env } from "@/lib/env";
import { CSRF_COOKIE_MAX_AGE_SECONDS, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/security/csrf";

import type { NextRequest } from "next/server";

const TOKEN_LENGTH_BYTES = 32;

export function ensureCsrfCookie(): string {
  const cookieStore = cookies();
  const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const token = existingToken ?? randomBytes(TOKEN_LENGTH_BYTES).toString("hex");

  if (!existingToken) {
    cookieStore.set({
      name: CSRF_COOKIE_NAME,
      value: token,
      httpOnly: false, // must be readable by the browser to echo in headers
      secure: env.node.appEnv !== "development",
      sameSite: "lax",
      path: "/",
      maxAge: CSRF_COOKIE_MAX_AGE_SECONDS,
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
