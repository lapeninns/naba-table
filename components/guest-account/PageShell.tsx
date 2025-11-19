import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidthClassName?: string;
  paddingClassName?: string;
};

export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  maxWidthClassName = "max-w-6xl",
  paddingClassName = "px-6 sm:px-8 lg:px-10",
}: PageShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className={cn("mx-auto flex w-full flex-col gap-6 py-10 sm:py-12 lg:py-16", maxWidthClassName, paddingClassName)}>
        <header className="flex flex-col gap-4 sm:items-start sm:gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="space-y-2 text-left">
            {eyebrow ? <p className="text-sm font-semibold text-primary">{eyebrow}</p> : null}
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
            {description ? <p className="max-w-2xl text-sm text-slate-600 sm:text-base">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

type PrimaryActionLink = {
  href: string;
  label: string;
  variant?: "default" | "secondary" | "outline";
};

type HeaderActionsProps = {
  primary?: PrimaryActionLink;
  secondary?: PrimaryActionLink;
};

export function HeaderActions({ primary, secondary }: HeaderActionsProps) {
  if (!primary && !secondary) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {secondary ? (
        <Link
          href={secondary.href}
          className={cn(buttonVariants({ variant: secondary.variant ?? "outline", size: "default" }), "min-w-[150px]")}
        >
          {secondary.label}
        </Link>
      ) : null}
      {primary ? (
        <Link
          href={primary.href}
          className={cn(buttonVariants({ variant: primary.variant ?? "default", size: "default" }), "min-w-[150px]")}
        >
          {primary.label}
        </Link>
      ) : null}
    </div>
  );
}

