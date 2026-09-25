import { AlertTriangle, Check, CheckCircle2, Circle, Minus, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { statusLabel, type SetupCard, type SetupStatus } from './buildSetupCards';

type SetupChecklistCardProps = {
  card: SetupCard;
  /** The single next required step gets the page's primary action; every other row is secondary. */
  isNextStep?: boolean;
  /** Refetches only this row's failed checks. Shown when the row status is `unknown`. */
  onCheckAgain?: () => void;
  isChecking?: boolean;
};

const STATUS_STYLES = {
  complete: { Icon: CheckCircle2, icon: 'text-success', badge: 'status-confirmed' },
  attention: { Icon: Circle, icon: 'text-muted-foreground', badge: 'status-pending' },
  optional: { Icon: Circle, icon: 'text-muted-foreground', badge: 'secondary' },
  unknown: { Icon: AlertTriangle, icon: 'text-destructive', badge: 'status-cancelled' },
} satisfies Record<
  SetupStatus,
  { Icon: typeof Circle; icon: string; badge: BadgeProps['variant'] }
>;

const ACTION_CLASS = 'w-fit shrink-0 [@media(pointer:coarse)]:min-h-11';

/** One setup step: status icon and badge, reason, what was checked and its action. */
export function SetupChecklistCard({
  card,
  isNextStep = false,
  onCheckAgain,
  isChecking = false,
}: SetupChecklistCardProps) {
  const styles = STATUS_STYLES[card.status];
  const StatusIcon = styles.Icon;
  const titleId = `setup-step-${card.key}-title`;

  return (
    <li
      aria-labelledby={titleId}
      data-testid={`setup-step-${card.key}`}
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5"
    >
      <StatusIcon className={cn('mt-0.5 size-4 shrink-0', styles.icon)} aria-hidden />

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={titleId} className="text-sm font-medium leading-6 text-foreground">
            {card.title}
          </h3>
          <Badge variant={styles.badge}>{statusLabel(card.status)}</Badge>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{card.reason}</p>
        {card.checks.length > 0 ? (
          <ul aria-label="What was checked" className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {card.checks.map((check) => (
              <li
                key={check.label}
                className={cn(
                  'flex items-center gap-1.5 text-xs leading-5',
                  check.ok ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {check.ok ? (
                  <Check className="size-3.5 shrink-0 text-success" aria-hidden />
                ) : (
                  <Minus className="size-3.5 shrink-0" aria-hidden />
                )}
                <span className="tabular-nums">
                  {check.ok ? null : <span className="sr-only">Missing: </span>}
                  {check.label}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="col-start-2 sm:col-start-3 sm:row-start-1 sm:self-start">
        {card.status === 'unknown' && onCheckAgain ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ACTION_CLASS}
            onClick={onCheckAgain}
            disabled={isChecking}
          >
            <RefreshCw data-icon="inline-start" aria-hidden />
            {isChecking ? 'Checking…' : 'Check again'}
          </Button>
        ) : (
          <Button
            asChild
            size="sm"
            variant={isNextStep ? 'default' : 'outline'}
            className={ACTION_CLASS}
          >
            <Link href={card.href}>{card.cta}</Link>
          </Button>
        )}
      </div>
    </li>
  );
}
