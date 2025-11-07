'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '@shared/lib/cn';
import { Button } from '@shared/ui/button';
import { Separator } from '@shared/ui/separator';

import { StepSummary } from './StepSummary';
import { resolveWizardIcon } from './wizardIcons';
import { WizardProgress, type WizardStepMeta, type WizardSummary } from './WizardProgress';

import type { StepAction } from '../model/reducer';

type ActionRole = 'primary' | 'secondary' | 'support';

export interface WizardNavigationProps {
  steps: WizardStepMeta[];
  currentStep: number;
  summary: WizardSummary;
  actions: StepAction[];
  visible?: boolean;
  onHeightChange?: (height: number) => void;
  className?: string;
}

export function WizardNavigation({
  steps,
  currentStep,
  summary,
  actions,
  visible = true,
  onHeightChange,
  className,
}: WizardNavigationProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    if (!onHeightChange) return;
    const node = containerRef.current;
    if (!node) {
      onHeightChange(0);
      return;
    }

    const updateHeight = () => {
      onHeightChange(visible ? node.getBoundingClientRect().height : 0);
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
      onHeightChange(0);
    };
  }, [onHeightChange, visible]);

  React.useEffect(() => {
    if (onHeightChange && !visible) {
      onHeightChange(0);
    }
  }, [onHeightChange, visible]);

  if (!visible) {
    return null;
  }

  const { primary, secondary, support } = groupActions(actions);

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] sm:px-4 lg:px-10',
        className,
      )}
      aria-hidden={false}
    >
      <nav
        ref={containerRef}
        className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface,#ffffff)]/98 text-foreground shadow-card backdrop-blur supports-[backdrop-filter]:backdrop-blur-lg"
        aria-label="Wizard navigation"
      >
        <div className="flex flex-col gap-3 px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <WizardProgress
              steps={steps}
              currentStep={currentStep}
              summary={summary}
              className="md:flex-1"
            />
            <StepSummary summary={summary} className="md:max-w-sm" layout="inline" />
          </div>

          <Separator className="my-1 bg-[color:var(--color-border)]" decorative />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
              aria-label="Secondary actions"
            >
              {secondary.map((action) => renderActionButton(action, 'secondary'))}
            </div>
            {primary.length > 0 ? (
              <div
                className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3"
                aria-label="Primary actions"
              >
                {primary.map((action) => renderActionButton(action, 'primary'))}
              </div>
            ) : null}
          </div>

          {support.length > 0 ? (
            <div
              className="flex flex-wrap gap-2 border-t border-dashed border-[color:var(--color-border)] pt-3"
              aria-label="Additional actions"
            >
              {support.map((action) => renderActionButton(action, 'support'))}
            </div>
          ) : null}
        </div>
      </nav>
    </div>
  );
}

function groupActions(actions: StepAction[]) {
  const grouped = {
    primary: [] as StepAction[],
    secondary: [] as StepAction[],
    support: [] as StepAction[],
  } satisfies Record<ActionRole, StepAction[]>;

  actions.forEach((action, index) => {
    const fallbackRole: ActionRole = index === actions.length - 1 ? 'primary' : 'secondary';
    const role = (action.role as ActionRole) ?? fallbackRole;
    if (role === 'primary' || role === 'secondary' || role === 'support') {
      grouped[role].push(action);
      return;
    }
    grouped.support.push(action);
  });

  if (grouped.primary.length === 0 && grouped.secondary.length > 0) {
    grouped.primary.push(grouped.secondary.pop() as StepAction);
  }

  return grouped;
}

function renderActionButton(action: StepAction, role: ActionRole) {
  const IconComponent = action.icon ? resolveWizardIcon(action.icon) : null;
  const isPrimary = role === 'primary';
  const isSupport = role === 'support';

  const variant =
    action.variant ?? (isPrimary ? 'default' : role === 'secondary' ? 'outline' : 'ghost');
  const sizingClass = cn(
    'min-h-[44px] rounded-2xl text-base font-semibold transition-transform focus-visible:ring-2 focus-visible:ring-ring/60',
    isPrimary ? 'w-full sm:w-auto px-6 shadow-sm' : 'w-full sm:w-auto px-4',
    isSupport && 'text-sm font-medium',
    action.fullWidth === false && 'w-auto',
  );

  const ariaLabel = action.ariaLabel ?? action.srLabel ?? action.label;

  return (
    <Button
      key={action.id}
      variant={variant}
      size="lg"
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
      aria-label={ariaLabel}
      className={sizingClass}
      data-testid={`wizard-action-${action.id}`}
    >
      {action.loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : IconComponent ? (
        <IconComponent className="h-4 w-4" aria-hidden />
      ) : null}
      <span className="truncate">{action.label}</span>
    </Button>
  );
}
