"use client";

import { useEffect } from "react";

type OpsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function OpsError({ error, reset }: OpsErrorProps) {
  useEffect(() => {
    console.error("[ops] rendering error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 bg-slate-100 px-6 py-16 text-center">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Ops console
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">We hit an ops snag</h1>
        <p className="text-base text-slate-600">
          Retry the action. If the issue persists, contact support so we can restore service quickly.
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
          href="/ops"
          className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
        >
          Back to dashboard
        </a>
      </div>
      {process.env.NODE_ENV !== "production" && error?.digest ? (
        <p className="text-xs text-slate-500">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
