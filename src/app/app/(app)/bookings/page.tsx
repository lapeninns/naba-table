import { BookingErrorBoundary } from "@/components/features/booking-state-machine";
import { OpsBookingsClient } from "@/components/features/bookings";
import { BookingOfflineQueueProvider } from "@/contexts/booking-offline-queue";
import { DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES, sanitizeTimeParam } from "@/utils/ops/bookings";
import { sanitizeDateParam } from "@/utils/ops/dashboard";

import type { OpsStatusFilter } from "@/hooks";
import type { OpsBookingStatus } from "@/types/ops";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage bookings · Nab a Table Ops",
  description: "Review and update upcoming reservations for your restaurant team.",
};

type OpsBookingsSearchParams = {
  restaurantId?: string;
  filter?: string;
  page?: string;
  pageSize?: string;
  status?: string;
  query?: string;
  statuses?: string;
  date?: string;
  tableId?: string;
  tableLabel?: string;
  time?: string;
  windowMode?: string;
  windowMinutes?: string;
};

const VALID_FILTERS: OpsStatusFilter[] = [
  "all",
  "upcoming",
  "past",
  "cancelled",
  "recent",
];

const VALID_STATUSES: OpsBookingStatus[] = [
  "pending",
  "pending_allocation",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
];

function parseStatusFilter(raw: string | undefined): OpsStatusFilter | null {
  if (!raw) return null;
  return VALID_FILTERS.includes(raw as OpsStatusFilter) ? (raw as OpsStatusFilter) : null;
}

function parseStatuses(raw: string | undefined): OpsBookingStatus[] {
  if (!raw) return [];
  const parts = raw.split(",").map((value) => value.trim()).filter((value) => value.length > 0);
  const valid = new Set<OpsBookingStatus>();
  parts.forEach((value) => {
    if (VALID_STATUSES.includes(value as OpsBookingStatus)) {
      valid.add(value as OpsBookingStatus);
    }
  });
  return Array.from(valid);
}

function parseWindowMode(raw: string | undefined, fallback: "day" | "window"): "day" | "window" {
  if (raw === "day" || raw === "window") return raw;
  return fallback;
}

function parseWindowMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return null;
  if (parsed < 15 || parsed > 240) return null;
  return parsed;
}

function parseTableId(raw: string | undefined): string | null {
  if (!raw) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
    ? raw
    : null;
}

export default async function OpsBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<OpsBookingsSearchParams>;
}) {
  const resolvedParams = (await searchParams) ?? {};

  const initialFilter = parseStatusFilter(resolvedParams.filter ?? resolvedParams.status);
  const parsedPage = resolvedParams.page ? Number.parseInt(resolvedParams.page, 10) : NaN;
  const initialPage = Number.isNaN(parsedPage) || parsedPage <= 0 ? null : parsedPage;
  const initialRestaurantId = resolvedParams.restaurantId ?? null;
  const rawQuery = resolvedParams.query?.trim() ?? "";
  const initialQuery = rawQuery.length > 0 ? rawQuery : null;
  const initialStatuses = parseStatuses(resolvedParams.statuses);
  const initialDate = sanitizeDateParam(resolvedParams.date);
  const initialTableId = parseTableId(resolvedParams.tableId);
  const initialTableLabel = resolvedParams.tableLabel?.trim() || null;
  const initialTime = sanitizeTimeParam(resolvedParams.time);
  const fallbackMode = initialTableId && initialTime ? "window" : "day";
  const initialWindowMode = parseWindowMode(resolvedParams.windowMode, fallbackMode);
  const initialWindowMinutes =
    parseWindowMinutes(resolvedParams.windowMinutes) ?? DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES;

  return (
    <BookingErrorBoundary>
      <BookingOfflineQueueProvider>
        <OpsBookingsClient
          initialFilter={initialFilter}
          initialPage={initialPage}
          initialRestaurantId={initialRestaurantId}
          initialQuery={initialQuery}
          initialStatuses={initialStatuses}
          initialDate={initialDate}
          initialTableId={initialTableId}
          initialTableLabel={initialTableLabel}
          initialTime={initialTime}
          initialWindowMode={initialWindowMode}
          initialWindowMinutes={initialWindowMinutes}
        />
      </BookingOfflineQueueProvider>
    </BookingErrorBoundary>
  );
}
