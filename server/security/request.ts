import type { NextRequest } from "next/server";

export function extractClientIp(req: NextRequest): string {
  const anyRequest = req as { ip?: string };
  const direct = typeof anyRequest.ip === "string" ? anyRequest.ip.trim() : "";
  if (direct) {
    return direct;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) {
    return "unknown";
  }

  const first = forwarded.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

export function anonymizeIp(ip: string | null | undefined): string {
  if (!ip || ip === "unknown") {
    return "unknown";
  }

  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts.slice(0, 2).join(":")}::`;
    }
    return `${parts[0] ?? ""}::`;
  }

  const segments = ip.split(".");
  if (segments.length >= 2) {
    return `${segments[0]}.${segments[1]}.x.x`;
  }

  return `${ip.slice(0, 3)}***`;
}
