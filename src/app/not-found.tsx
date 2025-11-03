export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-24 text-center">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800">Page not found</h1>
        <p className="text-slate-600">The page you’re looking for doesn’t exist or has moved.</p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Go to Home
        </a>
      </div>
    </main>
  );
}

