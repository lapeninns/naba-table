export default function GuestPublicNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center bg-slate-50 px-6 py-16 text-center">
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Page not found
        </h1>
        <p className="text-base text-slate-600">
          The page you’re looking for doesn’t exist or might have moved. Check the URL or return to the guest homepage.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Go to homepage
        </a>
      </div>
    </main>
  );
}
