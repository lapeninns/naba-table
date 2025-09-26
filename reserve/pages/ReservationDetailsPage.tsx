'use client';

import { useParams } from 'react-router-dom';

export default function ReservationDetailsPage() {
  const { reservationId } = useParams();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-16 text-srx-ink-strong">
      <div>
        <h1 className="text-3xl font-semibold">Reservation {reservationId}</h1>
        <p className="mt-2 text-slate-600">
          Details view coming soon. Use the back button in your browser to return to the booking
          flow.
        </p>
      </div>
    </main>
  );
}
