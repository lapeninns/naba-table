'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '@shared/lib/cn';
import { Button } from '@shared/ui/button';
import { Separator } from '@shared/ui/separator';

import { resolveWizardIcon } from './wizardIcons';
import { WizardProgress, type WizardStepMeta, type WizardSummary } from './WizardProgress';

import type { StepAction } from '../model/reducer';

const DEFAULT_VARIANT_MAP: Record<
  NonNullable<StepAction['variant']> | 'default',
  StepAction['variant']
> = {
  default: 'default',
  outline: 'outline',
  ghost: 'ghost',
  destructive: 'destructive',
};

const ACTION_SIZE_MAP: Record<'primary' | 'secondary', 'primary' | 'default'> = {
  primary: 'primary',
  secondary: 'default',
};

export interface WizardFooterProps {
  steps: WizardStepMeta[];
  currentStep: number;
  summary: WizardSummary;
  actions: StepAction[];
  visible: boolean;
  onHeightChange?: (height: number) => void;
}

export function WizardFooter({
  steps,
  currentStep,
  summary,
  actions,
  visible,
  onHeightChange,
}: WizardFooterProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    if (!onHeightChange) return;
    const node = containerRef.current;
    if (!node) {
      onHeightChange(0);
      return;
    }

    const update = () => {
      onHeightChange(visible ? node.getBoundingClientRect().height : 0);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [visible, onHeightChange]);

  React.useEffect(() => {
    if (!onHeightChange) return;
    if (!visible) {
      onHeightChange(0);
    }
  }, [visible, onHeightChange]);

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] transition-all duration-fast ease-srx-standard sm:px-6 lg:px-10',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
      )}
      aria-hidden={!visible}
    >
      <div
        ref={containerRef}
        className="pointer-events-auto mx-auto w-full max-w-5xl rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface,#ffffff)] shadow-card backdrop-blur supports-[backdrop-filter]:backdrop-blur-md"
      >
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <WizardProgress steps={steps} currentStep={currentStep} summary={summary} />
          <Separator className="bg-[color:var(--color-border)]" decorative />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {actions
                .slice(0, actions.length - 1)
                .map((action) => renderActionButton(action, 'secondary'))}
            </div>
            <div className="flex w-full justify-end gap-2 sm:w-auto">
              {actions.length > 0
                ? renderActionButton(actions[actions.length - 1], 'primary')
                : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderActionButton(action: StepAction, emphasis: 'primary' | 'secondary') {
  const IconComponent = resolveWizardIcon(action.icon ?? undefined);
  const variant = DEFAULT_VARIANT_MAP[action.variant ?? 'default'] ?? 'default';
  const size = ACTION_SIZE_MAP[emphasis];
  return (
    <Button
      key={action.id}
      variant={variant === 'default' ? (emphasis === 'primary' ? 'primary' : 'default') : variant}
      size={size}
      onClick={action.onClick}
      aria-label={action.ariaLabel ?? action.label}
      disabled={action.disabled || action.loading}
      className={cn(
        'min-w-[min(100%,160px)] sm:min-w-[140px]',
        action.loading && 'cursor-progress',
      )}
    >
      {action.loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      ) : IconComponent ? (
        <IconComponent className="mr-2 h-4 w-4" aria-hidden />
      ) : null}
      <span className="truncate">{action.label}</span>
    </Button>
  );
}
