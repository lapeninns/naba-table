"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[dashboard] render error", error);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-background px-4 py-16 text-center">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          We couldn’t load your dashboard. Try again or go back to home.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Retry</Button>
        <Link href="/"><Button variant="outline">Go home</Button></Link>
      </div>
      {process.env.NODE_ENV !== "production" && error?.digest ? (
        <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
      ) : null}
    </div>
  );
}
