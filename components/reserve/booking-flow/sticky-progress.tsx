"use client";

import React from "react";

import { bookingHelpers } from "@/components/reserve/helpers";
import { Icon } from "@/components/reserve/icons";

interface StepMeta {
  id: number;
  label: string;
  helper: string;
}

interface StickyProgressProps {
  steps: StepMeta[];
  currentStep: number;
  summary: {
    partyText: string;
    formattedTime: string;
    formattedDate: string;
  };
  visible: boolean;
  expanded: boolean;
  onToggle: () => void;
}

export const StickyProgress: React.FC<StickyProgressProps> = ({
  steps,
  currentStep,
  summary,
  visible,
  expanded,
  onToggle,
}) => {
  const totalSteps = steps.length;
  const current = Math.min(Math.max(currentStep, 1), totalSteps);
  const progress = ((current - 1) / Math.max(totalSteps - 1, 1)) * 100;
  const stepsPanelId = "sticky-progress-steps";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 px-4 sm:bottom-6">
      <div
        className={[
          "mx-auto w-full max-w-3xl transform transition-all duration-150 ease-out",
          visible ? "pointer-events-auto opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        ].join(" ")}
        aria-hidden={!visible}
      >
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            aria-expanded={expanded}
            aria-controls={stepsPanelId}
          >
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Step {current} of {totalSteps}
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {steps.find((step) => step.id === current)?.label ?? "In progress"}
              </p>
              <p className="text-xs text-slate-500">
                {summary.partyText} · {summary.formattedTime} · {summary.formattedDate}
              </p>
            </div>
            <Icon.ChevronDown
              className={[
                "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-150",
                expanded ? "rotate-180" : "rotate-0",
              ].join(" ")}
            />
          </button>
          <div className="px-4 pb-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900 transition-all duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div
            className={[
              "grid gap-2 border-t border-slate-200 bg-white px-4 transition-all duration-150 ease-out",
              expanded ? "max-h-64 py-3 opacity-100" : "max-h-0 py-0 opacity-0",
            ].join(" ")}
            id={stepsPanelId}
            role="region"
            aria-live="polite"
          >
            {steps.map((step) => {
              const isActive = currentStep === step.id;
              const isComplete = currentStep > step.id;
              return (
                <div
                  key={step.id}
                  className={bookingHelpers.cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition",
                    isActive
                      ? "border-slate-900 bg-slate-900/5 text-slate-900"
                      : isComplete
                        ? "border-green-200 bg-green-50 text-slate-700"
                        : "border-slate-200 bg-white text-slate-500",
                  )}
                >
                  <span
                    className={bookingHelpers.cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                      isActive
                        ? "bg-slate-900 text-white"
                        : isComplete
                          ? "bg-green-500 text-white"
                          : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {isComplete ? <Icon.Check className="h-4 w-4" /> : step.id}
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-semibold leading-tight">{step.label}</p>
                    <p className="text-xs text-slate-500">{step.helper}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
