'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

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

type LoadingState = {
  state: 'loading';
};

type ErrorState = {
  state: 'error';
  message: string;
  code?: string;
};

type SuccessState = {
  state: 'success';
  booking: BookingDetails;
};

type IdleState = {
  state: 'idle';
};

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-24">
      <div className="mx-auto max-w-md space-y-4 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-slate-900 border-r-transparent" role="status">
          <span className="sr-only">Loading confirmation...</span>
        </div>
        <p className="text-slate-600">Loading your booking confirmation...</p>
      </div>
    </main>
  );
}

function ThankYouPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get('token') ?? null;

  const [pageState, setPageState] = useState<PageState>({ state: 'loading' });

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const url = token ? `/api/bookings/confirm?token=${encodeURIComponent(token)}` : '/api/bookings/confirm';
        const response = await fetch(url, { credentials: 'same-origin' });

        if (!response.ok) {
          // If no token and cookie/session missing, fall back to idle (generic thank-you)
          if (!token) {
            setPageState({ state: 'idle' });
            return;
          }

          const errorData = await response.json().catch(() => ({}));
          setPageState({
            state: 'error',
            message: errorData.error || 'Unable to load booking confirmation',
            code: errorData.code,
          });
          return;
        }

        const data = await response.json();

        if (data.booking) {
          setPageState({ state: 'success', booking: data.booking });
        } else {
          setPageState({ state: 'idle' });
        }
      } catch (err) {
        console.error('[thank-you] Failed to fetch booking', err);
        setPageState({ state: 'error', message: 'Network error. Please check your connection.' });
      } finally {
        // Strip token from the URL if present to avoid leaking in referrers or history
        if (token) {
          router.replace('/thank-you');
        }
      }
    };

    void fetchBooking();
  }, [token, router]);

  if (pageState.state === 'loading') {
    return <LoadingScreen />;
  }

  // Error state
  if (pageState.state === 'error') {
    const isExpired = pageState.code === 'TOKEN_EXPIRED' || pageState.code === 'TOKEN_USED';

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-24">
        <div className="mx-auto max-w-md space-y-4 text-center">
          <div className="rounded-full bg-red-100 p-3 mx-auto w-fit">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            {isExpired ? 'Confirmation Link Expired' : 'Unable to Load Confirmation'}
          </h1>

          <p className="text-slate-600">{pageState.message}</p>

          {isExpired && (
            <div className="rounded-md bg-blue-50 p-4 text-left">
              <p className="text-sm text-blue-800">
                <strong>Don&apos;t worry!</strong> Your booking is still confirmed. Check your email for booking details, 
                or use the guest lookup below.
              </p>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 pt-4">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Return home
            </Link>
            <Link
              href="/my-bookings"
              className="text-sm text-slate-600 hover:text-slate-900 underline"
            >
              Sign in to view your bookings
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Success state (booking loaded)
  if (pageState.state === 'success') {
    const { booking } = pageState;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-24">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Success header */}
          <div className="text-center space-y-3">
            <div className="rounded-full bg-green-100 p-3 mx-auto w-fit">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-800">Booking Confirmed!</h1>
            <p className="text-lg text-slate-600">
              Reference: <span className="font-mono font-semibold text-slate-900">{booking.reference}</span>
            </p>
          </div>

          {/* Booking details card */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-slate-500">Restaurant</p>
                <p className="text-base font-semibold text-slate-900">{booking.restaurantName}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Date</p>
                <p className="text-base font-semibold text-slate-900">{booking.date}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Time</p>
                <p className="text-base font-semibold text-slate-900">
                  {booking.startTime} - {booking.endTime}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Party Size</p>
                <p className="text-base font-semibold text-slate-900">{booking.partySize} guests</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Booking Type</p>
                <p className="text-base font-semibold text-slate-900 capitalize">{booking.bookingType}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Seating Preference</p>
                <p className="text-base font-semibold text-slate-900 capitalize">{booking.seating}</p>
              </div>
            </div>

            {booking.notes && (
              <div className="pt-2 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-500">Special Requests</p>
                <p className="text-base text-slate-700 mt-1">{booking.notes}</p>
              </div>
            )}
          </div>

          {/* Additional info */}
          <div className="rounded-md bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              <strong>What&apos;s next?</strong> We&apos;ve sent a confirmation email with all the details. 
              Please arrive 5 minutes before your reservation time.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center pt-4">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700 w-full sm:w-auto"
            >
              Return home
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 w-full sm:w-auto"
            >
              Make another booking
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Idle state (no token or no server session, generic thank you)
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-24 text-center">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800">Thanks for booking with SajiloReserveX</h1>
        <p className="text-slate-600">
          Bookings powered by SajiloReserveX keep your favourite tables ready. We&apos;ve sent a confirmation email with
          everything you need to manage your visit.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Return home
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Make another booking
          </Link>
        </div>
      </div>
    </main>
  );
}
