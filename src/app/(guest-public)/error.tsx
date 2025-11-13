"use client";

import { useEffect } from "react";

type GuestPublicErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GuestPublicError({ error, reset }: GuestPublicErrorProps) {
  useEffect(() => {
    console.error("[guest-public] rendering error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 bg-slate-50 px-6 py-16 text-center">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">Something went wrong</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          We couldn’t load this page
        </h1>
        <p className="text-base text-slate-600">
          Please try again in a moment. If the issue continues, contact support so we can help.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Try again
        </button>
        <a
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          href="/"
        >
          Go home
        </a>
      </div>
      {process.env.NODE_ENV !== "production" && error?.digest ? (
        <p className="text-xs text-slate-500">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
