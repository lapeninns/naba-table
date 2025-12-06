import { AlertCircle, CheckCircle2, Info, Sparkles } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type GuestSectionProps = {
  title?: string;
  description?: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
};

export function GuestSection({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
  padding = "lg",
}: GuestSectionProps) {
  const paddingClasses = {
    sm: "p-4 sm:p-5",
    md: "p-5 sm:p-6",
    lg: "p-6 sm:p-8",
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm",
        "transition-shadow duration-200 hover:shadow-md",
        paddingClasses[padding],
        className,
      )}
    >
      {(eyebrow || title || description || actions) && (
        <div className="mb-5 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            {eyebrow ? (
              <Badge variant="secondary" className="guest-badge mb-1">
                {eyebrow}
              </Badge>
            ) : null}
            {title ? (
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-sm text-slate-500 sm:text-base">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">{actions}</div>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}

type GuestHeroProps = {
  title: string;
  description?: string;
  badge?: string;
  ctas?: React.ReactNode;
  className?: string;
};

export function GuestHero({ title, description, badge, ctas, className }: GuestHeroProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-blue-100",
        "bg-gradient-to-br from-blue-50 via-white to-blue-100/40",
        "p-8 sm:p-10 shadow-lg",
        className,
      )}
    >
      {/* Decorative gradient orbs */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 25% 35%, rgba(59,130,246,0.12), transparent 35%), radial-gradient(circle at 75% 25%, rgba(251,191,36,0.15), transparent 30%)",
        }}
      />
      <div className="relative space-y-3 text-center sm:space-y-4">
        {badge ? (
          <span className="inline-flex items-center justify-center rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-700 shadow-sm ring-1 ring-blue-100/80">
            {badge}
          </span>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mx-auto max-w-2xl text-sm text-slate-600 sm:text-base md:text-lg">
            {description}
          </p>
        ) : null}
        {ctas ? (
          <div className="mt-5 flex flex-col items-center gap-3 sm:mt-6 sm:flex-row sm:justify-center">
            {ctas}
          </div>
        ) : null}
      </div>
    </div>
  );
}


type GuestCardProps = React.ComponentProps<typeof Card> & {
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export function GuestCard({ header, footer, className, children, ...rest }: GuestCardProps) {
  return (
    <Card
      className={cn(
        "border-slate-100 shadow-sm rounded-xl group",
        "transition-shadow duration-200 hover:shadow-md",
        className
      )}
      {...rest}
    >
      {header ? <CardHeader className="pb-3">{header}</CardHeader> : null}
      <CardContent className="p-5">{children}</CardContent>
      {footer ? <CardFooter className="pt-3 pb-5 px-5">{footer}</CardFooter> : null}
    </Card>
  );
}

type GuestStatusProps = {
  title: string;
  description?: string;
  tone?: "info" | "success" | "warning" | "error";
  icon?: React.ElementType;
  actions?: React.ReactNode;
  className?: string;
  "aria-live"?: "polite" | "assertive";
};

const TONES: Record<
  NonNullable<GuestStatusProps["tone"]>,
  { bg: string; text: string; icon: React.ElementType }
> = {
  info: { bg: "bg-blue-50", text: "text-blue-900", icon: Info },
  success: { bg: "bg-emerald-50", text: "text-emerald-900", icon: CheckCircle2 },
  warning: { bg: "bg-amber-50", text: "text-amber-900", icon: AlertCircle },
  error: { bg: "bg-red-50", text: "text-red-900", icon: AlertCircle },
};

export const GuestStatus = React.forwardRef<HTMLDivElement, GuestStatusProps>(function GuestStatus(
  { title, description, tone = "info", icon, actions, className, ...rest },
  ref,
) {
  const toneConfig = TONES[tone];
  const Icon = icon ?? toneConfig.icon;
  return (
    <div
      ref={ref}
      role="status"
      tabIndex={-1}
      className={cn(
        "flex items-start gap-3 rounded-xl border border-transparent px-4 py-3 text-sm",
        toneConfig.bg,
        toneConfig.text,
        className,
      )}
      {...rest}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1 space-y-0.5">
        <p className="font-semibold">{title}</p>
        {description ? <p className="text-sm opacity-90">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
});

type GuestEmptyProps = {
  icon?: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionProps?: React.ComponentProps<typeof Button>;
  secondaryAction?: React.ReactNode;
  className?: string;
};

export function GuestEmpty({
  icon: Icon = Sparkles,
  title,
  description,
  actionLabel,
  actionHref,
  actionProps,
  secondaryAction,
  className,
}: GuestEmptyProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-dashed border-slate-200",
        "bg-gradient-to-b from-slate-50/80 to-white",
        "px-6 py-10 sm:px-8 sm:py-12 text-center",
        className
      )}
    >
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
        <Icon className="h-7 w-7 text-slate-400" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      <div className="mt-5 flex justify-center gap-3">
        {actionLabel && actionHref ? (
          <Button
            asChild
            size="sm"
            className="rounded-full px-5 shadow-sm"
          >
            <Link href={actionHref} {...(actionProps as object)}>
              {actionLabel}
            </Link>
          </Button>
        ) : null}
        {secondaryAction}
      </div>
    </div>
  );
}


type GuestErrorProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  redirectHref?: string;
  redirectLabel?: string;
};

export function GuestError({
  title = "Something went wrong",
  description = "Please try again in a moment.",
  onRetry,
  redirectHref,
  redirectLabel = "Go home",
}: GuestErrorProps) {
  return (
    <GuestCard
      className="text-center"
      header={
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700">
            <AlertCircle className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetry ? (
            <Button onClick={onRetry} className="rounded-full">
              Try again
            </Button>
          ) : null}
          {redirectHref ? (
            <Button variant="outline" asChild className="rounded-full">
              <Link href={redirectHref}>{redirectLabel}</Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <p className="text-sm text-slate-500">{description}</p>
      <Separator className="my-6" />
      <p className="text-xs text-slate-400">If this keeps happening, please contact support.</p>
    </GuestCard>
  );
}
