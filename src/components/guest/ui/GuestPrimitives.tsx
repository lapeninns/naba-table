import { AlertCircle, CheckCircle2, Info, Sparkles } from "lucide-react";
import Link from "next/link";
import { forwardRef, type CSSProperties, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PaddingSize = "sm" | "md" | "lg";

const paddingMap: Record<PaddingSize, string> = {
  sm: "px-[var(--space-4)] py-[var(--space-4)]",
  md: "px-[var(--space-5)] py-[var(--space-5)]",
  lg: "px-[var(--space-6)] py-[var(--space-6)]",
};

type SectionProps = {
  title?: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: PaddingSize;
};

export function GuestSection({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
  padding = "lg",
}: SectionProps) {
  return (
    <section
      className={cn(
        "relative flex flex-col gap-[var(--space-4)] rounded-[var(--radius-xl)]",
        "border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]",
        paddingMap[padding],
        className,
      )}
    >
      {(eyebrow || title || description || actions) && (
        <div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-[var(--space-2)]">
            {eyebrow ? (
              <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-[var(--space-3)] py-[var(--space-1)] text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--color-text-muted)]">
                {eyebrow}
              </span>
            ) : null}
            {title ? (
              <h2 className="text-[length:var(--font-size-xl)] font-bold leading-[var(--line-height-tight)] text-[color:var(--color-text)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-[length:var(--font-size-md)] text-[color:var(--color-text-muted)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-[var(--space-2)]">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

type GuestCardProps = {
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function GuestCard({ header, footer, className, style, children }: GuestCardProps) {
  return (
    <Card
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)]",
        "shadow-[var(--shadow-sm)] transition-shadow duration-200 hover:shadow-[var(--shadow-md)]",
        className,
      )}
      style={style}
    >
      {header ? <CardHeader className="pb-[var(--space-3)] text-[color:var(--color-text)]">{header}</CardHeader> : null}
      <CardContent className="px-[var(--space-5)] pb-[var(--space-5)] text-[color:var(--color-text)]">{children}</CardContent>
      {footer ? <CardFooter className="px-[var(--space-5)] pb-[var(--space-5)] pt-[var(--space-3)]">{footer}</CardFooter> : null}
    </Card>
  );
}

type GuestStatusProps = {
  title: string;
  description?: string;
  tone?: "info" | "success" | "warning" | "danger";
  icon?: React.ElementType;
  actions?: ReactNode;
  className?: string;
  "aria-live"?: "polite" | "assertive";
} & ComponentPropsWithoutRef<"div">;

const toneMap: Record<NonNullable<GuestStatusProps["tone"]>, { bg: string; text: string; icon: React.ElementType }> = {
  info: { bg: "bg-[var(--color-info-surface)]", text: "text-[var(--color-info)]", icon: Info },
  success: { bg: "bg-[var(--color-success-surface)]", text: "text-[var(--color-success)]", icon: CheckCircle2 },
  warning: { bg: "bg-[var(--color-warning-surface)]", text: "text-[var(--color-warning)]", icon: AlertCircle },
  danger: { bg: "bg-[var(--color-danger-surface)]", text: "text-[var(--color-danger)]", icon: AlertCircle },
};

export const GuestStatus = forwardRef<HTMLDivElement, GuestStatusProps>(function GuestStatus(
  { title, description, tone = "info", icon, actions, className, ...rest },
  ref,
) {
  const palette = toneMap[tone];
  const Icon = icon ?? palette.icon;
  return (
    <div
      ref={ref}
      role="status"
      tabIndex={-1}
      className={cn(
        "flex items-start gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-3)]",
        palette.bg,
        palette.text,
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className="mt-0.5 h-5 w-5" />
      <div className="flex-1 space-y-[var(--space-1)]">
        <p className="text-[length:var(--font-size-md)] font-semibold leading-[var(--line-height-tight)]">{title}</p>
        {description ? <p className="text-[length:var(--font-size-sm)] leading-[var(--line-height-md)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-[var(--space-2)]">{actions}</div> : null}
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
  secondaryAction?: ReactNode;
  className?: string;
};

export function GuestEmpty({ icon: Icon = Sparkles, title, description, actionLabel, actionHref, actionProps, secondaryAction, className }: GuestEmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-[var(--radius-xl)] border border-[var(--color-border)]",
        "bg-[var(--color-surface-muted)]/60 px-[var(--space-6)] py-[var(--space-8)] text-center",
        className,
      )}
    >
      <div className="mb-[var(--space-4)] flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
        <Icon className="h-7 w-7 text-[color:var(--color-text-muted)]" aria-hidden />
      </div>
      <h3 className="text-[length:var(--font-size-xl)] font-bold text-[color:var(--color-text)]">{title}</h3>
      <p className="mt-[var(--space-2)] max-w-md text-[length:var(--font-size-md)] text-[color:var(--color-text-muted)]">{description}</p>
      <div className="mt-[var(--space-4)] flex flex-wrap items-center justify-center gap-[var(--space-3)]">
        {actionLabel && actionHref ? (
          <Button asChild className="rounded-full px-[var(--space-5)]">
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

export function GuestError({ title = "Something went wrong", description = "Please try again in a moment.", onRetry, redirectHref, redirectLabel = "Go back" }: GuestErrorProps) {
  return (
    <GuestCard
      header={
        <div className="flex flex-col items-center gap-[var(--space-3)] text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger-surface)] text-[color:var(--color-danger)]">
            <AlertCircle className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="text-[length:var(--font-size-xl)] font-semibold">{title}</h3>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-center gap-[var(--space-3)]">
          {onRetry ? (
            <Button onClick={onRetry} className="rounded-full px-[var(--space-5)]">
              Try again
            </Button>
          ) : null}
          {redirectHref ? (
            <Button variant="outline" asChild className="rounded-full px-[var(--space-5)]">
              <Link href={redirectHref}>{redirectLabel}</Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <p className="text-[length:var(--font-size-md)] text-[color:var(--color-text-muted)]">{description}</p>
    </GuestCard>
  );
}
