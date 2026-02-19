export type SigninSurface = "public_guest" | "app_ops";

function normalizeRootDomain(rootDomain: string): string {
  return rootDomain.toLowerCase().replace(/^www\./, "");
}

export function classifySigninSurface(hostname: string, rootDomain: string): SigninSurface {
  const normalizedHost = hostname.toLowerCase();
  const normalizedRoot = normalizeRootDomain(rootDomain);

  if (normalizedRoot === "localhost") {
    return normalizedHost.startsWith("app.localhost") ? "app_ops" : "public_guest";
  }

  return normalizedHost === `app.${normalizedRoot}` ? "app_ops" : "public_guest";
}
