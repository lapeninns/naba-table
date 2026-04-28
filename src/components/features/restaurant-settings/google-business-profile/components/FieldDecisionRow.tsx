'use client';

import { ArrowRightLeft, CornerDownLeft, Hand, MinusCircle, Send, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  decisionLabel,
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
        'h-auto min-h-9 min-w-0 justify-start whitespace-normal text-left',
        active && 'shadow-none',
      )}
    >
      {icon}
      <span className="min-w-0">{label}</span>
    </Button>
  );
}

export function FieldDecisionRow({
  item,
  section,
  decision,
  onDecisionChange,
  jobStatus,
}: FieldDecisionRowProps) {
  const disabledReason = itemActionDisabledReason(item, section, decision);
  const pullDisabled = section.status === 'stale' || !item.canPublishToNabatable;
  const pushDisabled = section.status === 'stale' || !item.canPushToGoogle;
  const decisionButtons = [
    {
      key: 'pull_from_google' as const,
      label: 'Use Google value',
      disabled: pullDisabled,
      icon: <CornerDownLeft className="mr-2 size-3.5" />,
    },
    {
      key: 'push_to_google' as const,
      label: 'Send to Google',
      disabled: pushDisabled,
      icon: <Send className="mr-2 size-3.5" />,
    },
    {
      key: 'keep_nabatable' as const,
      label: 'Keep Nabatable',
      disabled: section.status === 'stale',
      icon: <Hand className="mr-2 size-3.5" />,
    },
    {
      key: 'ignore_suggestion' as const,
      label: 'Ignore suggestion',
      disabled: section.status === 'stale',
      icon: <MinusCircle className="mr-2 size-3.5" />,
    },
    {
      key: 'manual' as const,
      label: 'Resolve manually',
      disabled: true,
      icon: <ShieldAlert className="mr-2 size-3.5" />,
    },
  ];

  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background p-3 sm:p-4">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="min-w-0 text-wrap text-sm font-semibold text-foreground">
                {humanFieldLabel(item)}
              </h4>
              <Badge variant="outline">{itemChangeLabel(item)}</Badge>
              <Badge variant="secondary">{itemEligibilityLabel(item)}</Badge>
              <Badge variant={decision === 'ignore_suggestion' ? 'secondary' : 'outline'}>
                {decisionLabel(decision)}
              </Badge>
              {jobStatus ? (
                <Badge variant={workflowStatusVariant(jobStatus)}>{jobStatus}</Badge>
              ) : null}
            </div>
            {item.warnings.length > 0 ? (
              <p className="text-xs text-muted-foreground">{item.warnings.join(' ')}</p>
            ) : null}
            {disabledReason ? <p className="text-xs text-amber-700">{disabledReason}</p> : null}
          </div>

          <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
          </div>
        </div>

        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          <div className="min-w-0 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span>Nabatable</span>
              <ArrowRightLeft className="size-3" />
              <span>current value</span>
            </div>
            <pre
              className={cn(
                'max-w-full whitespace-pre-wrap break-words text-sm text-foreground',
                isStructuredValue(item.currentValue) ? 'font-mono text-xs' : 'font-medium',
              )}
            >
              {formatValuePreview(item.currentValue)}
            </pre>
          </div>
          <div className="min-w-0 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <span>Google</span>
              <ArrowRightLeft className="size-3" />
              <span>profile value</span>
            </div>
            <pre
              className={cn(
                'max-w-full whitespace-pre-wrap break-words text-sm text-foreground',
                isStructuredValue(item.providerValue) ? 'font-mono text-xs' : 'font-medium',
              )}
            >
              {formatValuePreview(item.providerValue)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
