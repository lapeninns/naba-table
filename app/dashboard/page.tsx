import ButtonAccount from "@/components/ButtonAccount";
import { DEFAULT_RESTAURANT_ID } from "@/lib/venue";
import { BOOKING_TYPES_UI, type BookingStatus } from "@/lib/enums";
import { bookingHelpers } from "@/components/reserve/helpers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

import type { Database } from "@/types/supabase";

export const dynamic = "force-dynamic";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

type DashboardBooking = BookingRow & { dateTime: Date };

type StatusChip = {
  label: string;
  className: string;
};

const STATUS_STYLES: Record<BookingStatus, StatusChip> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-900 border border-amber-200",
  },
  pending_allocation: {
    label: "Allocation pending",
    className: "bg-sky-100 text-sky-900 border border-sky-200",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-100 text-emerald-900 border border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-rose-100 text-rose-900 border border-rose-200",
  },
};

function buildDateTime(booking: BookingRow): Date {
  return new Date(`${booking.booking_date}T${booking.start_time}`);
}

function describeStatus(status: BookingStatus): StatusChip {
  return STATUS_STYLES[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-900 border border-slate-200",
  };
}

function formatBookingType(value: BookingRow["booking_type"]): string {
  if ((BOOKING_TYPES_UI as readonly string[]).includes(value as string)) {
    return bookingHelpers.formatBookingLabel(value as (typeof BOOKING_TYPES_UI)[number]);
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderEmptyState(message: string) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">No bookings yet</h3>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <a
        href="/reserve"
        className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Start a reservation
      </a>
    </div>
  );
}

function BookingCard({ booking }: { booking: DashboardBooking }) {
  const status = describeStatus(booking.status as BookingStatus);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {format(booking.dateTime, "EEEE d MMMM yyyy")}
          </h3>
          <p className="text-sm text-slate-600">
            {bookingHelpers.formatTime(booking.start_time)} · Party of {booking.party_size}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
            status.className,
          )}
        >
          {status.label}
        </span>
      </div>

      <dl className="mt-4 grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Booking type</dt>
          <dd className="mt-1 font-medium">
            {formatBookingType(booking.booking_type)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Reference</dt>
          <dd className="mt-1 font-medium">{booking.reference}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Seating preference</dt>
          <dd className="mt-1 font-medium capitalize">{booking.seating_preference}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Created</dt>
          <dd className="mt-1">
            {format(new Date(booking.created_at), "d MMM yyyy, HH:mm")}
          </dd>
        </div>
      </dl>

      {booking.notes ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <span className="font-medium text-slate-900">Notes:</span> {booking.notes}
        </p>
      ) : null}
    </article>
  );
}

function BookingHistory({ bookings }: { bookings: DashboardBooking[] }) {
  if (bookings.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-slate-900">Past bookings</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((booking) => {
              const status = describeStatus(booking.status as BookingStatus);
              return (
                <tr key={booking.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">
                    <div className="font-medium text-slate-900">
                      {format(booking.dateTime, "d MMM yyyy")}
                    </div>
                    <div className="text-xs text-slate-500">
                      {bookingHelpers.formatTime(booking.start_time)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{booking.party_size}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatBookingType(booking.booking_type)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">{booking.reference}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function Dashboard() {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const email = session?.user?.email;

  if (!email) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <section className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ButtonAccount />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Your reservations</h1>
              <p className="text-sm text-slate-600">Sign in to view and manage your bookings.</p>
            </div>
          </div>
          {renderEmptyState("Sign in to access your dashboard and upcoming reservations.")}
        </section>
      </main>
    );
  }

  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("*")
    .eq("restaurant_id", DEFAULT_RESTAURANT_ID)
    .eq("customer_email", email)
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true });

  const safeRows = (bookingRows ?? []) as BookingRow[];

  const bookings: DashboardBooking[] = safeRows.map((entry) => ({
    ...entry,
    dateTime: buildDateTime(entry),
  }));

  const now = new Date();
  const upcoming = bookings.filter((booking) => booking.dateTime.getTime() >= now.getTime());
  const past = bookings
    .filter((booking) => booking.dateTime.getTime() < now.getTime())
    .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <section className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ButtonAccount />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Your reservations</h1>
            <p className="text-sm text-slate-600">
              Track upcoming visits and revisit past bookings in one place.
            </p>
          </div>
        </div>

        {upcoming.length === 0 ? (
          renderEmptyState("You haven’t booked a table yet. Plan your next visit in seconds.")
        ) : (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Upcoming bookings</h2>
            <div className="grid gap-4">
              {upcoming.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          </section>
        )}

        <BookingHistory bookings={past} />
      </section>
    </main>
  );
}
