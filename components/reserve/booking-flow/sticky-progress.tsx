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
    visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 px-4 pb-[calc(env(safe-area-inset-bottom,0)+1.25rem)] sm:px-6 lg:px-8">
      <div ref={containerRef} className={containerClass} aria-hidden={!visible}>
        <section
          className="rounded-3xl border border-srx-border-strong bg-white/95 shadow-srx-card backdrop-blur supports-[backdrop-filter]:backdrop-blur-sm"
          aria-label="Reservation progress"
        >
          <div className="flex flex-col gap-4 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-content-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 text-sm font-semibold text-white shadow-inner">
                  {current}
                </span>
                <div>
                  <p className="text-helper font-semibold uppercase tracking-[0.18em] text-srx-ink-soft">{progressLabel}</p>
                  <p className="text-lg font-semibold text-srx-ink-strong">{currentLabel}</p>
                </div>
              </div>
              <p className="text-right text-body-sm text-srx-ink-soft" aria-live="polite">
                {summaryText}
              </p>
            </div>

            <div
              className="relative h-1.5 w-full overflow-hidden rounded-full bg-srx-surface-positive-alt/60"
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

            {hasActions && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                {actions.map((action, index) => (
                  <Button
                    key={action.id}
                    variant={action.variant ?? (index === 0 ? "default" : "outline")}
                    disabled={action.disabled || action.loading}
                    onClick={action.onClick}
                    className="w-full sm:w-auto"
                  >
                    {action.loading && <Icon.Spinner className="mr-2 h-4 w-4 animate-spin" />}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
