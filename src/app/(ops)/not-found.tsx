export default function OpsNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center bg-slate-100 px-6 py-16 text-center">
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Ops console
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Page not available
        </h1>
        <p className="text-base text-slate-600">
          The requested operations view doesn’t exist or you might not have permissions.
        </p>
        <a
          href="/ops"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Return to Ops
        </a>
      </div>
    </main>
  );
}
