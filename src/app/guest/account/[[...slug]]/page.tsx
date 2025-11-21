"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const FALLBACK_TARGET = "/account/bookings";

function buildTarget(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const stripped = normalized.replace(/^\/guest\/account\/?/, "");
  return stripped.length > 0 ? `/account/${stripped}` : FALLBACK_TARGET;
}

export default function GuestAccountRedirectPage() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  useEffect(() => {
    const target = buildTarget(pathname);
    const query = searchParams.toString();
    const destination = query.length > 0 ? `${target}?${query}` : target;
    router.replace(destination);
  }, [pathname, searchParams, router]);

  return null;
}
