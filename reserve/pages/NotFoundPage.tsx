'use client';

import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-16 text-center text-slate-700">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-md text-base text-slate-600">
        We couldn’t find the page you were looking for. Head back to the reservation flow to
        continue.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-srx-ink-strong px-4 py-2 text-white hover:bg-srx-ink-strong/90"
      >
        Return to reservations
      </Link>
    </main>
  );
}
