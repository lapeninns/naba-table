import { cookies } from "next/headers";

import { buildBookingsSearchParams } from "../bookings-params";

import type { BookingsPort } from "../ports";

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const siteUrl = rawSiteUrl.endsWith("/") ? rawSiteUrl.slice(0, -1) : rawSiteUrl;

const buildCookieHeader = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const serialized = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  return serialized.length > 0 ? serialized : null;
};

export const createServerBookingsPort = (): BookingsPort => {
  const list: BookingsPort["list"] = async (filters = {}) => {
    const params = buildBookingsSearchParams(filters);
    const base = siteUrl || "";
    const url = `${base}/api/bookings?${params.toString()}`;
    const cookieHeader = await buildCookieHeader();

    const response = await fetch(url, {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Bookings fetch failed (${response.status})`);
    }

    return (await response.json()) as unknown as Awaited<ReturnType<BookingsPort["list"]>>;
  };

  return { list };
};
