'use client';

import { AlertTriangle, CheckCircle2, CornerDownLeft, Info, Send, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  decisionLabelForItem,
  formatValuePreview,
  humanFieldLabel,
  isStructuredValue,
  itemActionDisabledReason,
  itemChangeLabel,
  itemEligibilityLabel,
  workflowStatusVariant,
  type FieldDecision,
} from '../lib/sync-review';

import type {
  GoogleBusinessProfileDraftItem,
  GoogleBusinessProfileDraftSection,
} from '@/services/ops/restaurants';
import type { ReactNode } from 'react';

type FieldDecisionRowProps = {
  item: GoogleBusinessProfileDraftItem;
  section: GoogleBusinessProfileDraftSection;
  decision: FieldDecision;
  onDecisionChange: (decision: FieldDecision) => void;
  jobStatus?: string | null;
  googlePushEnabled: boolean;
};

function DecisionButton({
  active,
  disabled,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-auto min-h-10 min-w-0 justify-start whitespace-normal rounded-lg text-left transition-transform duration-200 active:scale-[0.96]',
        active && 'shadow-none',
      )}
    >
      {icon}
      <span className="min-w-0">{label}</span>
    </Button>
  );
}

function ValueCard({
  label,
  value,
  isWinner,
  isLoser,
}: {
  label: string;
  value: unknown;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl p-4 shadow-sm ring-1 transition-[background-color,opacity,box-shadow] duration-200',
        isWinner ? 'bg-primary/5 ring-primary/30' : 'bg-background ring-border/70',
        isLoser && 'bg-muted/50 opacity-70 ring-border/60',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        {isWinner ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            <CheckCircle2 className="size-3" />
            Selected
          </span>
        ) : isLoser ? (
          <span className="text-[10px] font-medium normal-case tracking-normal text-muted-foreground">
            Will be replaced
          </span>
        ) : null}
      </div>
      <pre
        className={cn(
          'max-w-full whitespace-pre-wrap break-words text-sm text-foreground',
          isStructuredValue(value) ? 'font-mono text-xs' : 'font-medium',
          isLoser && 'line-through decoration-2',
        )}
      >
        {formatValuePreview(value)}
      </pre>
    </div>
  );
}

export function FieldDecisionRow({
  item,
  section,
  decision,
  onDecisionChange,
  jobStatus,
  googlePushEnabled,
}: FieldDecisionRowProps) {
  const disabledReason = itemActionDisabledReason(item, section, decision, googlePushEnabled);
  const pullDisabled = section.status === 'stale' || !item.canPublishToNabatable;
  const pushDisabled = section.status === 'stale' || !item.canPushToGoogle || !googlePushEnabled;
  const decisionButtons = [
    {
      key: 'import_from_google' as const,
      label: 'Import to Nabatable',
      disabled: pullDisabled,
      icon: <CornerDownLeft data-icon="inline-start" />,
    },
    {
      key: 'export_to_google' as const,
      label: 'Export to Google',
      disabled: pushDisabled,
      icon: <Send data-icon="inline-start" />,
    },
    {
      key: 'ignore' as const,
      label: 'Ignore for now',
      disabled: section.status === 'stale',
      icon: <ShieldAlert data-icon="inline-start" />,
    },
  ];
  const selectedGoogle = decision === 'import_from_google';
  const selectedNabatable = decision === 'export_to_google';

  const consequence =
    decision === 'import_from_google'
      ? 'This will update Nabatable using the value from Google.'
      : decision === 'export_to_google'
        ? 'This will update the public Google Business Profile using the value from Nabatable.'
        : decision === 'ignore'
          ? 'This difference will be left unchanged for now.'
          : 'This difference needs manual handling before it can be applied.';

  return (
    <article className="min-w-0 rounded-2xl bg-background p-4 shadow-sm ring-1 ring-border/70 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="min-w-0 text-wrap text-base font-semibold tracking-tight text-foreground">
                {humanFieldLabel(item)}
              </h4>
              <Badge variant="outline">{itemChangeLabel(item)}</Badge>
              <Badge variant="secondary">{itemEligibilityLabel(item)}</Badge>
              <Badge variant={decision === 'ignore' ? 'secondary' : 'outline'}>
                {decisionLabelForItem(item, decision)}
              </Badge>
              {jobStatus ? (
                <Badge variant={workflowStatusVariant(jobStatus)}>{jobStatus}</Badge>
              ) : null}
            </div>
            {item.warnings.length > 0 ? (
              <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {item.warnings.join(' ')}
              </p>
            ) : null}
            {disabledReason ? (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                {disabledReason}
              </p>
            ) : null}
          </div>

          <div className="grid min-w-0 gap-2 sm:grid-cols-3">
            {decisionButtons.map((button) => (
              <DecisionButton
                key={button.key}
                active={decision === button.key}
                disabled={button.disabled}
                label={button.label}
                icon={button.icon}
                onClick={() => onDecisionChange(button.key)}
              />
            ))}
            {!item.canPublishToNabatable && !item.canPushToGoogle ? (
              <Badge variant="outline" className="justify-center py-2">
                <ShieldAlert className="mr-2 size-3.5" />
                Resolve manually
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          <ValueCard
            label="Nabatable value"
            value={item.currentValue}
            isWinner={selectedNabatable}
            isLoser={selectedGoogle}
          />
          <ValueCard
            label="Google value"
            value={item.providerValue}
            isWinner={selectedGoogle}
            isLoser={selectedNabatable}
          />
        </div>

        <div
          className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
            decision === 'export_to_google'
              ? 'bg-primary/5 text-foreground ring-1 ring-primary/15'
              : 'bg-muted/40 text-muted-foreground',
          )}
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {consequence}
        </div>
      </div>
    </article>
  );
}
