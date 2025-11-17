'use client';

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type BookingDetails = {
  id: string;
  reference: string;
  restaurantName: string;
  date: string;
  startTime: string;
  endTime: string;
  partySize: number;
  bookingType: string;
  seating: string;
  notes: string | null;
  status: string;
};

type LoadingState = { state: "loading" };
type ErrorState = { state: "error"; message: string; code?: string };
type SuccessState = { state: "success"; booking: BookingDetails };
type IdleState = { state: "idle" };
type PageState = LoadingState | ErrorState | SuccessState | IdleState;

export default function ThankYouPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ThankYouPageContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-24">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <div
          className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-slate-900 border-r-transparent"
          role="status"
        >
          <span className="sr-only">Loading confirmation...</span>
        </div>
        <p className="text-slate-600">Loading your booking confirmation...</p>
      </div>
    </section>
  );
}

function ThankYouPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawToken = searchParams?.get("token")?.trim() ?? null;
  const token = rawToken && rawToken.length > 0 ? rawToken : null;

  const [pageState, setPageState] = useState<PageState>(() => (token ? { state: "loading" } : { state: "idle" }));

  useEffect(() => {
    if (!token) {
      setPageState((prev) => (prev.state === "idle" ? prev : { state: "idle" }));
      return;
    }

    const fetchBooking = async () => {
      try {
        const url = `/api/v1/bookings/confirm?token=${encodeURIComponent(token)}`;
        const response = await fetch(url, { credentials: "same-origin" });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          setPageState({
            state: "error",
            message: errorData.error || "Unable to load booking confirmation",
            code: errorData.code,
          });
          return;
        }

        const data = await response.json();

        if (data.booking) {
          setPageState({ state: "success", booking: data.booking });
        } else {
          setPageState({ state: "idle" });
        }
      } catch (err) {
        console.error("[thank-you] Failed to fetch booking", err);
        setPageState({ state: "error", message: "Network error. Please check your connection." });
      } finally {
        router.replace("/thank-you");
      }
    };

    void fetchBooking();
  }, [token, router]);

  if (pageState.state === "loading") return <LoadingScreen />;

  if (pageState.state === "error") {
    const isExpired = pageState.code === "TOKEN_EXPIRED" || pageState.code === "TOKEN_USED";
    return (
      <PageShell>
        <div className="mx-auto max-w-xl space-y-4 rounded-3xl border border-red-100 bg-red-50 p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto w-fit rounded-full bg-red-100 p-3">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-red-900">
            {isExpired ? "Confirmation link expired" : "Unable to load confirmation"}
          </h1>
          <p className="text-sm text-red-800">{pageState.message}</p>
          {isExpired ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-left">
              <p className="text-sm text-blue-800">
                <strong>Don&apos;t worry!</strong> Your booking is still confirmed. Check your email for booking details or
                sign in to view your history.
              </p>
            </div>
          ) : null}
          <div className="flex flex-col items-center gap-3 pt-4 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 sm:w-auto"
            >
              Return home
            </Link>
            <Link
              href="/my-bookings"
              className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
            >
              View my bookings
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (pageState.state === "success") {
    const { booking } = pageState;
    const isPending = booking.status === "pending" || booking.status === "pending_allocation";

    return (
      <PageShell>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div className="space-y-3 text-center">
            <div className={`mx-auto w-fit rounded-full p-3 ${isPending ? "bg-blue-100" : "bg-green-100"}`}>
              {isPending ? (
                <svg className="h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="9" className="opacity-20" strokeWidth="2" />
                  <path d="M12 7v5l3 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {isPending ? "Booking pending" : "Booking confirmed"}
            </h1>
            <p className="text-lg text-slate-700">
              Reference: <span className="font-mono font-semibold text-slate-900">{booking.reference}</span>
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoField label="Restaurant" value={booking.restaurantName} />
              <InfoField label="Date" value={booking.date} />
              <InfoField label="Time" value={`${booking.startTime} - ${booking.endTime}`} />
              <InfoField label="Party size" value={`${booking.partySize} guests`} />
              <InfoField label="Booking type" value={booking.bookingType} />
              <InfoField label="Seating preference" value={booking.seating} />
            </div>
            {booking.notes ? (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-sm font-medium text-slate-600">Special requests</p>
                <p className="mt-1 text-base text-slate-800">{booking.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left">
            <p className="text-sm text-blue-800">
              <strong>What’s next?</strong>{" "}
              {isPending
                ? "You’ll receive a confirmation email once the venue finalizes your booking."
                : "We’ve emailed your confirmation and reference. Please arrive 5 minutes early."}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800 sm:w-auto"
            >
              Return home
            </Link>
            <Link
              href="/reserve"
              className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
            >
              Make another booking
            </Link>
            <Link
              href="/my-bookings"
              className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
            >
              View my bookings
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Thanks for booking with SajiloReserveX
        </h1>
        <p className="text-base text-slate-700">
          Your confirmation email is on its way. Keep your reference handy to update or cancel if plans change.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 sm:w-auto"
          >
            Return home
          </Link>
          <Link
            href="/reserve"
            className="inline-flex w-full items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
          >
            Make another booking
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-h-screen flex-col items-center bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-14">
      <div className="w-full">{children}</div>
    </section>
  );
}
