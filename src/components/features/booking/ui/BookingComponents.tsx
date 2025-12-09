
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { ElementType, ReactNode } from "react";

type StatusTone = "default" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<StatusTone, { badge: string; text: string }> = {
  default: { badge: "bg-slate-100 text-slate-700", text: "text-slate-600" },
  success: { badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-600" },
  warning: { badge: "bg-amber-100 text-amber-700", text: "text-amber-600" },
  danger: { badge: "bg-red-100 text-red-700", text: "text-red-600" },
  info: { badge: "bg-blue-100 text-blue-700", text: "text-blue-600" },
};

export function BookingDetailShell({ children }: { children: ReactNode }) {
  return (
    <section className="guest-theme bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">{children}</div>
    </section>
  );
}

export function BookingSummaryCard({
  title,
  reference,
  description,
  backHref = "/guest/dashboard",
  status,
  offlineNotice,
  actions,
}: {
  title: ReactNode;
  reference: ReactNode;
  description?: ReactNode;
  backHref?: string;
  status: { icon: ElementType; label: string; tone?: StatusTone };
  offlineNotice?: ReactNode;
  actions?: ReactNode;
}) {
  const Icon = status.icon;
  const tone = toneClasses[status.tone ?? "default"];
  return (
    <Card className="space-y-6 rounded-[var(--guest-radius-2xl)] border-slate-100 bg-white/95 p-6 shadow-[var(--guest-shadow-xl)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <Badge className={cn("w-fit rounded-full px-4 py-1.5 text-sm font-semibold", tone.badge)}>
            <Icon className="mr-1.5 h-4 w-4" aria-hidden />
            {status.label}
          </Badge>
          <div>
            <h1 className="guest-heading-page text-[length:var(--guest-text-page)] font-semibold text-slate-900">{title}</h1>
            {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          </div>
          <p className="text-sm text-slate-500">
            Confirmation <span className="font-mono font-semibold text-slate-800">{reference}</span>
          </p>
        </div>
        {actions ? <div className="flex flex-col gap-3 sm:flex-row">{actions}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <Link href={backHref} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-slate-600 hover:text-slate-900">
          ← Back to dashboard
        </Link>
        {offlineNotice}
      </div>
    </Card>
  );
}

export function DetailStatCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: ElementType;
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
}) {
  return (
    <Card className="rounded-[var(--guest-radius-xl)] border-slate-100 bg-white p-5 shadow-[var(--guest-shadow-sm)]">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
          {subtext ? <p className="text-sm text-slate-500">{subtext}</p> : null}
        </div>
      </div>
    </Card>
  );
}

export function InfoPanel({ title, rows }: { title: string; rows: Array<{ icon: ElementType; label: string; value: ReactNode }> }) {
  return (
    <Card className="overflow-hidden rounded-[var(--guest-radius-xl)] border-slate-100 bg-white shadow-[var(--guest-shadow-sm)]">
      <div className="border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="divide-y divide-slate-50">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
              <row.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{row.label}</p>
              <p className="truncate font-medium text-slate-900">{row.value}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ActionButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 md:hidden">{children}</div>;
}

export function BookingSidebarCard({ children }: { children: ReactNode }) {
  return <Card className="rounded-[var(--guest-radius-2xl)] border-slate-100 bg-white shadow-[var(--guest-shadow-lg)]">{children}</Card>;
}

export function ManageBookingPanel({
  title,
  actions,
  footer,
}: {
  title: ReactNode;
  actions: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <BookingSidebarCard>
      <div className="space-y-4 p-6">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {actions}
        {footer ? <Separator className="my-2" /> : null}
        {footer}
      </div>
    </BookingSidebarCard>
  );
}

export function QRCodePanel({ children, code }: { children: ReactNode; code: string }) {
  return (
    <BookingSidebarCard>
      <div className="p-6 text-center">
        {children}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Check-in code</p>
          <p className="font-mono text-xl font-bold text-slate-900">{code}</p>
        </div>
      </div>
    </BookingSidebarCard>
  );
}

export function InlineAlert({ tone = "info", children }: { tone?: StatusTone; children: ReactNode }) {
  const palette = toneClasses[tone];
  return <div className={cn("rounded-[var(--guest-radius-xl)] border px-4 py-3 text-sm", palette.badge, palette.text)}>{children}</div>;
}

export function SummaryActions({ children }: { children: ReactNode }) {
  return <div className="hidden items-center gap-3 md:flex">{children}</div>;
}

export function PrimaryButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild className="rounded-full bg-slate-900 hover:bg-slate-800">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function SecondaryButton({ onClick, children, disabled }: { onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <Button variant="outline" className="rounded-full border-slate-200" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

export function GhostButton({ onClick, children, disabled }: { onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <Button variant="ghost" className="rounded-xl text-slate-500 hover:text-slate-900" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
