"use client";

import React, { useEffect, useRef } from "react";

import { Icon } from "@/components/reserve/icons";
import { Button } from "@/components/ui/button";
import type { StepAction } from "./state";

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
  const progressPercent = totalSteps === 0 ? 0 : (current / totalSteps) * 100;
  const currentLabel = steps.find((step) => step.id === current)?.label ?? "Current step";
  const displayedStep = totalSteps === 0 ? 0 : current;
  const progressLabel = `Step ${displayedStep} of ${safeTotal}`;
  const summaryText = [summary.partyText, summary.formattedTime, summary.formattedDate].filter(Boolean).join(" • ") || "Complete the details to continue";
  const hasActions = actions.length > 0;

  const containerClass = [
    "mx-auto w-full max-w-3xl transform transition-all duration-fast ease-srx-standard lg:max-w-4xl xl:max-w-5xl",
    visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
  ].join(" ");

  const containerRef = useRef<HTMLDivElement | null>(null);

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

    if (typeof ResizeObserver === "undefined") {
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
          className="rounded-2xl border border-srx-border-strong bg-white/95 shadow-srx-card backdrop-blur supports-[backdrop-filter]:backdrop-blur-sm"
          aria-label="Reservation progress"
        >
          <div className="flex flex-col gap-3 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-inner">
                  {progressLabel}
                </span>
                <div>
                  <p className="text-sm font-semibold text-srx-ink-strong">{currentLabel}</p>
                  <p className="text-xs text-srx-ink-soft" aria-live="polite">
                    {summaryText}
                  </p>
                </div>
              </div>
              <div
                className="relative h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-srx-surface-positive-alt/60"
                role="meter"
                aria-valuemin={totalSteps === 0 ? 0 : 1}
                aria-valuemax={safeTotal}
                aria-valuenow={current}
                aria-label={progressLabel}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 transition-all duration-fast ease-srx-standard"
                  style={{ width: `${Math.max(progressPercent, progressPercent > 0 ? 6 : 0)}%` }}
                />
              </div>
            </div>

            {hasActions && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {actions.map((action, index) => {
                  const IconComponent = action.icon ? Icon[action.icon] : null;
                  const isIconOnly = Boolean(IconComponent);
                  const variant = action.variant ?? (index === actions.length - 1 ? "default" : "outline");

                  return (
                    <Button
                      key={action.id}
                      variant={variant}
                      size={isIconOnly ? "icon" : undefined}
                      aria-label={action.ariaLabel ?? action.label}
                      title={action.ariaLabel ?? action.label}
                      disabled={action.disabled || action.loading}
                      onClick={action.onClick}
                    >
                      {action.loading ? (
                        <Icon.Spinner className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : isIconOnly && IconComponent ? (
                        <IconComponent className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        action.label
                      )}
                      {isIconOnly && !action.loading && <span className="sr-only">{action.label}</span>}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
