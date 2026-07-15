'use client';

import { ChevronUp, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@shared/lib/cn';

import { wizardIconMap } from './wizardIcons';
import { groupActions } from '../utils/groupActions';

import type { WizardStepMeta, WizardSummary } from './WizardProgress';
import type { StepAction } from '../model/reducer';
import type { ActionRole } from '../utils/groupActions';

export interface WizardNavigationProps {
  steps: WizardStepMeta[];
  currentStep: number;
  summary: WizardSummary;
  actions: StepAction[];
  visible?: boolean;
  onHeightChange?: (height: number) => void;
  className?: string;
  onStepSelect?: (step: number) => void;
}

const PANEL_ID = 'wizard-summary-sheet';
const VARIANT_BY_ROLE: Record<ActionRole, 'guest-primary' | 'guest-outline' | 'guest-ghost'> = {
  primary: 'guest-primary',
  secondary: 'guest-outline',
  support: 'guest-ghost',
};

function useHeightObserver(
  ref: React.RefObject<HTMLElement | null>,
  visible: boolean,
  onHeightChange?: (height: number) => void,
): void {
  React.useLayoutEffect(() => {
    if (!onHeightChange) return;

    const node = ref.current;
    if (!node || !visible) {
      onHeightChange(0);
      return;
    }

    const updateHeight = () => onHeightChange(node.getBoundingClientRect().height);
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [onHeightChange, ref, visible]);
}

function ActionButton({ action, role }: { action: StepAction; role: ActionRole }) {
  const Icon = action.icon ? (wizardIconMap[action.icon] ?? null) : null;
  const isLoading = action.loading === true;

  return (
    <Button
      type="button"
      variant={VARIANT_BY_ROLE[role]}
      size={role === 'support' ? 'guest-sm' : 'guest-lg'}
      onClick={action.onClick}
      disabled={action.disabled === true || isLoading}
      aria-label={action.ariaLabel ?? action.srLabel ?? action.label}
      aria-busy={isLoading}
      data-testid={`wizard-action-${action.id}`}
      className={cn(
        'pg-focus-ring min-h-11',
        role === 'primary' && 'w-full px-6 sm:w-auto sm:flex-none',
        role === 'secondary' && 'flex-none px-4',
        role === 'support' && 'flex-none',
      )}
    >
      {isLoading ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="size-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{action.label}</span>
    </Button>
  );
}

export function WizardNavigation({
  steps,
  currentStep,
  summary,
  actions,
  visible = true,
  onHeightChange,
  className,
  onStepSelect,
}: WizardNavigationProps) {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  useHeightObserver(railRef, visible, onHeightChange);

  const total = steps.length || 1;
  const current = Math.min(Math.max(currentStep, 1), total);
  const line = (summary.details ?? []).filter(Boolean).join(' · ');
  const facts = summary.facts ?? [];
  const canExpand = facts.length > 0;
  const isOpen = open && canExpand;
  const { primary, secondary, support } = React.useMemo(() => groupActions(actions), [actions]);

  React.useEffect(() => setOpen(false), [current]);
  if (!visible) return null;

  return (
    <div
      data-booking-wizard-navigation
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50',
        'pb-[env(safe-area-inset-bottom,0px)] sm:px-[var(--pg-gutter)] sm:pb-4',
        className,
      )}
    >
      <nav
        aria-label="Booking wizard navigation"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && isOpen) setOpen(false);
        }}
        className={cn(
          'pg-panel pointer-events-auto mx-auto w-full text-[color:var(--pg-text)] backdrop-blur-xl',
          'rounded-t-[var(--pg-radius-xl)] sm:max-w-3xl sm:rounded-[var(--pg-radius-xl)]',
          isOpen && 'shadow-[var(--pg-shadow-lg)]',
        )}
      >
        {canExpand ? (
          <div
            id={PANEL_ID}
            role="region"
            aria-label="Booking summary"
            inert={!isOpen}
            className={cn(
              'px-4 sm:px-5',
              isOpen
                ? 'max-h-[min(60dvh,24rem)] overflow-y-auto overscroll-contain'
                : 'max-h-0 overflow-hidden',
            )}
          >
            <div className="flex flex-col gap-3 pb-3 pt-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                {facts.map((fact) => (
                  <div key={fact.label} className="flex flex-col gap-0.5">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--pg-text-muted)]">
                      {fact.label}
                    </dt>
                    <dd className="text-sm font-semibold text-[color:var(--pg-text)]">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {onStepSelect && current > 1 ? (
                <nav
                  aria-label="Go to a previous step"
                  className="flex flex-wrap gap-1.5 border-t border-[color:var(--pg-border)] pt-3"
                >
                  {steps.slice(0, current - 1).map((step, index) => (
                    <Button
                      key={step.id}
                      type="button"
                      variant="guest-ghost"
                      size="guest-sm"
                      onClick={() => onStepSelect(index + 1)}
                      aria-label={`${step.label} (${index + 1} of ${total})`}
                      className="pg-focus-ring min-h-11 gap-2"
                    >
                      <span className="flex size-5 items-center justify-center rounded-full bg-[color:var(--pg-action)] text-[10px] font-bold text-[color:var(--pg-action-contrast)]">
                        {index + 1}
                      </span>
                      {step.label}
                    </Button>
                  ))}
                </nav>
              ) : null}

              {support.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 border-t border-[color:var(--pg-border)] pt-3">
                  {support.map((action) => (
                    <ActionButton key={action.id} action={action} role="support" />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          ref={railRef}
          data-wizard-navigation-rail
          className="flex flex-col gap-2.5 px-4 pb-3 pt-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
        >
          {canExpand ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={isOpen}
              aria-controls={PANEL_ID}
              aria-label={isOpen ? 'Hide booking summary' : 'Show booking summary'}
              className="pg-focus-ring -mx-1 min-h-11 w-full justify-start gap-3 rounded-[var(--pg-radius-md)] px-1 py-1 font-normal sm:flex-1"
            >
              <span className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate text-sm font-semibold text-[color:var(--pg-text)]">
                  {summary.primary}
                </span>
                {line ? (
                  <span className="truncate text-xs text-[color:var(--pg-text-muted)]">{line}</span>
                ) : null}
              </span>
              <ChevronUp
                className={cn(
                  'size-4 shrink-0 text-[color:var(--pg-text-muted)] transition-transform',
                  isOpen && 'rotate-180',
                )}
                aria-hidden="true"
              />
            </Button>
          ) : (
            <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
              <span className="truncate text-sm font-semibold text-[color:var(--pg-text)]">
                {summary.primary}
              </span>
              {line ? (
                <span className="truncate text-xs text-[color:var(--pg-text-muted)]">{line}</span>
              ) : null}
            </div>
          )}

          {primary.length > 0 || secondary.length > 0 ? (
            <div
              className="flex flex-wrap items-stretch justify-end gap-2 sm:w-auto sm:flex-nowrap sm:shrink-0"
              role="group"
              aria-label="Step actions"
            >
              {secondary.map((action) => (
                <ActionButton key={action.id} action={action} role="secondary" />
              ))}
              {primary.map((action) => (
                <ActionButton key={action.id} action={action} role="primary" />
              ))}
            </div>
          ) : null}
        </div>

        <div className="sr-only" aria-live="polite">
          {`Step ${current} of ${total}. ${summary.srLabel ?? summary.primary}`}
        </div>
      </nav>
    </div>
  );
}
