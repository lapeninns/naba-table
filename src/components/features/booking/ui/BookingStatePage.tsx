
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

type BookingStateAction = {
  href: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
};

const toneClasses = {
  success: {
    iconWrap: 'bg-[var(--luminous-primary-tint)] text-primary',
    label: 'text-primary',
  },
  warning: {
    iconWrap: 'bg-[var(--luminous-tone-warning-bg)] text-[var(--luminous-tone-warning-text)]',
    label: 'text-[var(--luminous-tone-warning-text)]',
  },
  danger: {
    iconWrap: 'bg-[var(--luminous-tone-danger-bg)] text-[var(--luminous-tone-danger-text)]',
    label: 'text-[var(--luminous-tone-danger-text)]',
  },
  info: {
    iconWrap: 'bg-[var(--luminous-primary-tint)] text-primary',
    label: 'text-primary',
  },
} as const;

export function BookingStatePage({
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = 'info',
  primaryAction,
  secondaryAction,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone?: keyof typeof toneClasses;
  primaryAction: BookingStateAction;
  secondaryAction?: BookingStateAction;
  aside?: React.ReactNode;
}) {
  const palette = toneClasses[tone];

  return (
    <main className="flex min-h-[calc(100svh-9rem)] items-center justify-center py-10 sm:py-16">
      <div className="w-full max-w-3xl">
        <section className="luminous-panel relative overflow-hidden px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
          <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--luminous-primary-container)_14%,transparent),transparent_56%)]" />
          <div className="absolute -right-12 top-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--luminous-primary)_8%,transparent),transparent_68%)] blur-3xl" />

          <div className="relative space-y-10">
            {/* Emotional center */}
            <div className="space-y-6 text-center sm:text-left">
              <div
                className={cn(
                  'mx-auto sm:mx-0 inline-flex h-20 w-20 items-center justify-center rounded-[1.5rem] animate-fade-in-up',
                  palette.iconWrap,
                )}
              >
                <Icon className="h-10 w-10" aria-hidden />
              </div>

              <div className="space-y-3 animate-fade-in-up [animation-delay:60ms]">
                <p className={cn('luminous-kicker', palette.label)}>{eyebrow}</p>
                <h1 className="heading-hero luminous-balance max-w-[20ch] mx-auto sm:mx-0">{title}</h1>
              </div>

              <p className="text-body-warm luminous-copy-measure text-[1.05rem] leading-relaxed mx-auto sm:mx-0 animate-fade-in-up [animation-delay:120ms]">
                {description}
              </p>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap justify-center sm:justify-start animate-fade-in-up [animation-delay:180ms]">
                <StateActionButton action={primaryAction} />
                {secondaryAction ? <StateActionButton action={secondaryAction} /> : null}
              </div>
            </div>

            {/* Aside — integrated glass strip */}
            <div className="luminous-glass rounded-[var(--luminous-radius-panel)] px-6 py-5 animate-fade-in-up [animation-delay:260ms]">
              <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
                {aside ?? (
                  <>
                    <div className="space-y-2">
                      <p className="luminous-kicker">What happens next</p>
                      <p className="text-sm font-semibold text-foreground">Stay on the canonical path</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Use the primary action to return to the most reliable route for your next step.
                      </p>
                    </div>
                    <div className="luminous-card-soft rounded-[var(--luminous-radius)] px-4 py-4">
                      <p className="text-sm font-semibold text-foreground">Need help?</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Sign in if you have an account, or return home and start again with a fresh link.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StateActionButton({ action }: { action: BookingStateAction }) {
  const className =
    action.variant === 'secondary'
      ? 'luminous-secondary btn-tactile text-foreground'
      : action.variant === 'ghost'
        ? 'luminous-ghost'
        : 'luminous-cta btn-tactile text-white';

  return (
    <Button
      asChild
      size="lg"
      variant={action.variant === 'ghost' ? 'ghost' : action.variant === 'secondary' ? 'secondary' : 'default'}
      className={cn(
        'min-h-[48px] rounded-[var(--luminous-radius)] px-6',
        className,
      )}
    >
      <Link href={action.href}>{action.label}</Link>
    </Button>
  );
}
