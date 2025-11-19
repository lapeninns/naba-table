export default function GuestAccountNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center bg-slate-50 px-6 py-16 text-center">
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-sm font-semibold text-primary">Page missing</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          We couldn’t find that account page
        </h1>
        <p className="text-base text-slate-600">
          The link may be out of date or you might not have access. Head back to your bookings to continue.
        </p>
        <a
          href="/my-bookings"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          View my bookings
        </a>
      </div>
    </main>
  );
}
