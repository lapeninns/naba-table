import { env } from "@/lib/env";
import { getCanonicalSiteUrl } from "@/lib/site-url";

export function buildInviteUrl(token: string): string {
  const base = env.app.url ?? getCanonicalSiteUrl();
  const url = new URL(`/invite/${token}`, base);
  return url.toString();
}
