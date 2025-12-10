import Link from "next/link";

export function Footer({ variant: _variant = "marketing" }: { variant?: "marketing" | "guest" }) {
  return (
    <footer className="border-t border-slate-200 bg-white/90 text-slate-700">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Nab a Table</p>
          <p className="text-xs text-slate-500">Live availability • Instant confirmation • Calendar-ready receipts</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/restaurants" className="rounded-full border border-slate-200 px-3 py-1 hover:border-blue-500 hover:text-blue-700">
            Browse restaurants
          </Link>
          <Link href="/guest/bookings" className="rounded-full border border-slate-200 px-3 py-1 hover:border-blue-500 hover:text-blue-700">
            My bookings
          </Link>
          <Link href="/auth/signin" className="rounded-full border border-slate-200 px-3 py-1 hover:border-blue-500 hover:text-blue-700">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
