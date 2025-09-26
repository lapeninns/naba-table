'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Icon } from '@reserve/shared/ui/icons';

import type { StepAction } from '../model/reducer';

interface StepMeta {
  id: number;
  label: string;
  helper: string;
}

type HeightChangeHandler = React.Dispatch<React.SetStateAction<number>>;

interface StickyProgressProps {
  steps: StepMeta[];
  currentStep: number;
  summary: {
    partyText: string;
    formattedTime: string;
    formattedDate: string;
    serviceLabel: string;
  };
  visible: boolean;
  actions?: StepAction[];
  onHeightChange?: HeightChangeHandler;
}

export const StickyProgress: React.FC<StickyProgressProps> = ({
  steps,
  currentStep,
  summary,
  visible,
  actions = [],
  onHeightChange,
}) => {
  const totalSteps = steps.length;
  const safeTotal = Math.max(totalSteps, 1);
  const current = totalSteps === 0 ? 0 : Math.min(Math.max(currentStep, 1), totalSteps);
  const summaryPrimaryText = summary.serviceLabel || 'Select a service';
  const summarySecondaryPartsRaw = [
    summary.partyText,
    summary.formattedTime,
    summary.formattedDate,
  ].filter(Boolean);
  const summarySecondaryParts =
    summarySecondaryPartsRaw.length > 0
      ? summarySecondaryPartsRaw
      : ['Select a date and time to continue'];
  const summaryAriaLabel = [summaryPrimaryText, summarySecondaryParts.join(', ')]
    .filter(Boolean)
    .join('. ');

  const containerClass = [
    'mx-auto w-full max-w-3xl transform transition-all duration-fast ease-srx-standard lg:max-w-4xl xl:max-w-5xl',
    visible
      ? 'pointer-events-auto translate-y-0 opacity-100'
      : 'pointer-events-none translate-y-4 opacity-0',
  ].join(' ');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hintId, setHintId] = useState<string | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  const defaultBackAction = useMemo<StepAction>(
    () => ({
      id: 'sticky-back',
      label: 'Back',
      icon: 'ChevronLeft',
      onClick: () => typeof window !== 'undefined' && window.history.back(),
    }),
    [],
  );

  const defaultRightAction = useMemo<StepAction>(
    () => ({
      id: 'sticky-continue',
      label: 'Continue',
      icon: 'Check',
      onClick: () => {},
    }),
    [],
  );

  const leftAction =
    actions.length > 1 ? actions[0] : actions.length === 0 ? defaultBackAction : null;
  const rightAction = actions.length > 0 ? actions[actions.length - 1] : defaultRightAction;
  const leftHintId = leftAction?.id ?? null;
  const rightHintId = rightAction.id;

  const showHint = (id: string) => {
    setHintId(id);
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHintId(null), 800);
  };

  useEffect(() => {
    if (!onHeightChange) return;
    const element = containerRef.current;
    if (!element) {
      onHeightChange(0);
      return;
    }

    const notify = () => {
      onHeightChange(visible ? element.getBoundingClientRect().height : 0);
    };

    notify();

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        onHeightChange(0);
      };
    }

    const observer = new ResizeObserver(() => {
      notify();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [visible, onHeightChange]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 px-3 pb-[calc(env(safe-area-inset-bottom,0)+1rem)] sm:px-6 lg:px-8">
      <div ref={containerRef} className={containerClass} aria-hidden={!visible}>
        <section
          className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-card backdrop-blur supports-[backdrop-filter]:backdrop-blur-sm"
          aria-label="Reservation progress"
        >
          <div className="flex flex-col gap-3 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3 md:gap-5">
              <div className="relative flex min-h-[44px] min-w-[44px] items-center justify-center sm:min-h-[48px] sm:min-w-[48px]">
                {leftAction &&
                  (() => {
                    const IconComponent = leftAction.icon ? Icon[leftAction.icon] : null;
                    return (
                      <Button
                        variant={leftAction.variant ?? 'outline'}
                        size="icon"
                        aria-label={leftAction.ariaLabel ?? leftAction.label}
                        title={leftAction.label}
                        onPointerDown={() => showHint(leftAction.id)}
                        onClick={leftAction.onClick}
                        className="rounded-full"
                      >
                        {leftAction.loading ? (
                          <Icon.Spinner className="h-5 w-5 animate-spin" aria-hidden />
                        ) : IconComponent ? (
                          <IconComponent className="h-5 w-5" aria-hidden />
                        ) : (
                          <span className="sr-only">{leftAction.label}</span>
                        )}
                      </Button>
                    );
                  })()}
                {hintId === leftHintId && leftAction ? (
                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-[var(--radius-sm)] bg-[color:var(--color-text-primary)] px-2 py-1 text-[12px] leading-[16px] text-white shadow-card animate-opacity">
                    {leftAction.label}
                  </div>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-center px-1 text-center md:justify-start md:px-4 md:text-left">
                {current < safeTotal ? (
                  <div
                    className="flex w-full flex-col items-center gap-1 text-[color:var(--color-text-primary)] md:items-start"
                    aria-live="polite"
                    aria-label={summaryAriaLabel}
                  >
                    <span className="max-w-full truncate text-[1.05rem] font-semibold leading-tight text-[color:var(--color-text-primary)] sm:text-lg">
                      {summaryPrimaryText}
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm leading-tight text-[color:var(--color-text-secondary)] md:justify-start">
                      {summarySecondaryParts.map((part, index) => (
                        <React.Fragment key={`${part}-${index}`}>
                          {index > 0 && (
                            <span aria-hidden className="text-[color:var(--color-text-secondary)]">
                              •
                            </span>
                          )}
                          <span>{part}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {(() => {
                      const cal = actions.find(
                        (action) => action.icon === 'Calendar' || /calendar/i.test(action.id),
                      );
                      const wal = actions.find(
                        (action) => action.icon === 'Wallet' || /wallet/i.test(action.id),
                      );
                      const candidates = [cal, wal].filter(Boolean) as StepAction[];
                      return candidates.map((action) => {
                        const IconComponent = action.icon ? Icon[action.icon] : null;
                        return (
                          <div key={action.id} className="relative">
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={action.label}
                              title={action.label}
                              onPointerDown={() => showHint(action.id)}
                              onClick={action.onClick}
                              className="rounded-full"
                            >
                              {action.loading ? (
                                <Icon.Spinner className="h-5 w-5 animate-spin" aria-hidden />
                              ) : IconComponent ? (
                                <IconComponent className="h-5 w-5" aria-hidden />
                              ) : (
                                <span className="sr-only">{action.label}</span>
                              )}
                            </Button>
                            {hintId === action.id ? (
                              <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-[var(--radius-sm)] bg-[color:var(--color-text-primary)] px-2 py-1 text-[12px] leading-[16px] text-white shadow-card animate-opacity">
                                {action.label}
                              </div>
                            ) : null}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              <div className="relative flex min-h-[44px] min-w-[44px] items-center justify-center sm:min-h-[48px] sm:min-w-[48px]">
                {(() => {
                  const IconComponent = rightAction.icon ? Icon[rightAction.icon] : null;
                  return (
                    <Button
                      variant={rightAction.variant ?? 'primary'}
                      size="icon"
                      aria-label={rightAction.ariaLabel ?? rightAction.label}
                      title={rightAction.label}
                      onPointerDown={() => showHint(rightAction.id)}
                      onClick={rightAction.onClick}
                      className="rounded-full"
                    >
                      {rightAction.loading ? (
                        <Icon.Spinner className="h-5 w-5 animate-spin" aria-hidden />
                      ) : IconComponent ? (
                        <IconComponent className="h-5 w-5" aria-hidden />
                      ) : (
                        <span className="sr-only">{rightAction.label}</span>
                      )}
                    </Button>
                  );
                })()}
                {hintId === rightHintId ? (
                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-[var(--radius-sm)] bg-[color:var(--color-text-primary)] px-2 py-1 text-[12px] leading-[16px] text-white shadow-card animate-opacity">
                    {rightAction.label}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              {Array.from({ length: safeTotal }, (_, index) => index + 1).map((index) => (
                <span
                  key={index}
                  aria-current={index === current ? 'step' : undefined}
                  className={[
                    'h-1.5 flex-1 rounded-full',
                    index <= current
                      ? 'bg-[color:var(--color-primary)]'
                      : 'bg-[color:var(--color-border)]',
                  ].join(' ')}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StickyProgress;
