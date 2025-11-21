"use client";

import { useEffect } from "react";

type GuestAccountErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GuestAccountError({ error, reset }: GuestAccountErrorProps) {
  useEffect(() => {
    console.error("[guest-account] rendering error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 bg-slate-50 px-6 py-16 text-center">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">We hit a snag</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Account details didn’t load
        </h1>
        <p className="text-base text-slate-600">
          Refresh the page or sign in again. If that doesn’t help, reach out so we can investigate.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Retry
        </button>
        <a
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          href="/signin"
        >
          Go to sign in
        </a>
      </div>
      {process.env.NODE_ENV !== "production" && error?.digest ? (
        <p className="text-xs text-slate-500">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
