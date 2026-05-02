'use client';

import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 text-center text-foreground">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-md text-base text-muted-foreground">
        We couldn’t find the page you were looking for. Head back to the reservation flow to
        continue.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Return to reservations
      </Link>
    </main>
  );
}
