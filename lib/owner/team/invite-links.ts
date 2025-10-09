import config from "@/config";
import { env } from "@/lib/env";

export function buildInviteUrl(token: string): string {
  const appUrl = env.app.url ?? config.domainName ?? "http://localhost:3000";
  const base = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
  const url = new URL(`/invite/${token}`, base);
  return url.toString();
}
