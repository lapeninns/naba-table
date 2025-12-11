
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
  success: { badge: "bg-emerald-50 text-emerald-700 border-emerald-100", text: "text-emerald-600" },
  warning: { badge: "bg-amber-50 text-amber-700 border-amber-100", text: "text-amber-600" },
  danger: { badge: "bg-red-50 text-red-700 border-red-100", text: "text-red-600" },
  info: { badge: "bg-blue-50 text-blue-700 border-blue-100", text: "text-blue-600" },
};

export function BookingDetailShell({ children }: { children: ReactNode }) {
  return (
    <section className="guest-theme min-h-[calc(100vh-80px)] bg-slate-50/50 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">{children}</div>
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
    <Card className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Link href={backHref} className="inline-flex items-center justify-center rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors">
              <span className="sr-only">Back</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z" /></svg>
            </Link>
            <Badge className={cn("rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border", tone.badge)}>
              <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {status.label}
            </Badge>
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">{title}</h1>
            {description ? <p className="mt-2 text-lg text-slate-500">{description}</p> : null}
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-400 font-mono">
            <span>REF:</span>
            <span className="font-bold text-slate-700">{reference}</span>
          </div>
        </div>
        {actions ? <div className="flex flex-col gap-3 sm:flex-row pt-2">{actions}</div> : null}
      </div>
      {offlineNotice}
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
  // Reusing MetricTile style but adapted for props
  return (
    <div className={cn(
      "relative flex flex-col gap-3 rounded-2xl border p-5 transition-all duration-200",
      "bg-white border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
      "hover:shadow-md hover:-translate-y-0.5"
    )}>
      <div className="flex justify-between items-start">
        <div className="p-2.5 rounded-xl flex items-center justify-center bg-slate-50 text-slate-600">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</div>
        <div className="text-slate-900 text-xl font-bold tracking-tight">{value}</div>
        {subtext ? <div className="text-sm text-slate-500 mt-0.5 font-medium">{subtext}</div> : null}
      </div>
    </div>
  );
}

export function InfoPanel({ title, rows }: { title: string; rows: Array<{ icon: ElementType; label: string; value: ReactNode }> }) {
  return (
    <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
              <row.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{row.label}</p>
              <p className="truncate font-semibold text-slate-900 text-lg">{row.value}</p>
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
  return <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">{children}</Card>;
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
      <div className="space-y-6 p-6">
        <h3 className="font-bold text-slate-900 text-lg">{title}</h3>
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
      <div className="p-8 text-center bg-slate-50/30">
        {children}
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Check-in code</p>
          <p className="font-mono text-3xl font-bold text-slate-900 tracking-wider">{code}</p>
        </div>
      </div>
    </BookingSidebarCard>
  );
}

export function InlineAlert({ tone = "info", children }: { tone?: StatusTone; children: ReactNode }) {
  const palette = toneClasses[tone];
  return <div className={cn("rounded-2xl border px-4 py-3 text-sm font-medium", palette.badge, palette.text)}>{children}</div>;
}

export function SummaryActions({ children }: { children: ReactNode }) {
  return <div className="hidden items-center gap-3 md:flex">{children}</div>;
}

export function PrimaryButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild className="rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function SecondaryButton({ onClick, children, disabled }: { onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <Button variant="outline" className="rounded-full border-slate-200 hover:bg-slate-50 font-medium px-5" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

export function GhostButton({ onClick, children, disabled }: { onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <Button variant="ghost" className="rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
