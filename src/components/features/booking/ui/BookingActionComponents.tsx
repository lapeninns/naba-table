import Link from 'next/link';

import { Button } from '@/components/ui/button';

import type { ReactNode } from 'react';

export function ActionButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row md:hidden">{children}</div>;
}

export function SummaryActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

export function PrimaryButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      asChild
      className="pg-action pg-focus-ring pg-touch rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90"
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function SecondaryButton({
  onClick,
  children,
  disabled,
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      className="pg-action pg-focus-ring pg-touch w-full justify-center rounded-full border-border px-5 font-medium hover:bg-muted"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

export function GhostButton({
  onClick,
  children,
  disabled,
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      className="pg-action pg-focus-ring pg-touch w-full justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
