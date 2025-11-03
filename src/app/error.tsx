"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-24 text-center">
          <div className="mx-auto max-w-md space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">Something went wrong</h1>
            <p className="text-slate-600">We couldn’t load this page. Please try again.</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => reset()}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Try again
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Go to Home
              </a>
            </div>
            {process.env.NODE_ENV !== 'production' && error?.digest && (
              <p className="text-xs text-slate-400">Error ID: {error.digest}</p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}

