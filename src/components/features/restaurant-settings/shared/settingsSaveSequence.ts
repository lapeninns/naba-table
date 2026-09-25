'use client';

import { useCallback, useRef, useState } from 'react';

import { HttpError } from '@/lib/http/errors';

/** One independently saved part of a settings page, written through its existing endpoint. */
export type SettingsSaveStep = {
  id: string;
  /** Section name shown to staff, e.g. "Booking rules". */
  name: string;
  run: () => Promise<void>;
};

export type SettingsSaveProgress = {
  /** 1-based position of the step being written. */
  step: number;
  total: number;
  sectionName: string;
};

export type SettingsSaveFailure = {
  failedSection: string;
  saved: string[];
  notAttempted: string[];
  /** Safe, machine-readable reason. Never a raw message, which may echo guest data. */
  reasonCode: string;
};

export type SettingsSaveOutcome =
  | { ok: true; saved: string[] }
  | { ok: false; failure: SettingsSaveFailure };

const SAFE_CODE_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/;

/** The safe reason code for a failed save: the API error code, never its message. */
export function getSettingsSaveReasonCode(error: unknown): string {
  if (error instanceof HttpError) {
    return SAFE_CODE_PATTERN.test(error.code) ? error.code : `HTTP_${error.status}`;
  }
  if (error instanceof TypeError) {
    return 'network_error';
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && SAFE_CODE_PATTERN.test(code)) {
      return code;
    }
  }
  return 'unknown_error';
}

/**
 * Writes steps strictly one after another and stops at the first failure, so staff always know
 * what was saved, what failed and what was not attempted. Callers order the steps so that saved
 * settings stay valid after every step.
 */
export async function runSettingsSaveSequence(
  steps: readonly SettingsSaveStep[],
  onProgress: (progress: SettingsSaveProgress) => void = () => {},
): Promise<SettingsSaveOutcome> {
  const saved: string[] = [];
  for (const [index, step] of steps.entries()) {
    onProgress({ step: index + 1, total: steps.length, sectionName: step.name });
    try {
      await step.run();
    } catch (error) {
      return {
        ok: false,
        failure: {
          failedSection: step.name,
          saved,
          notAttempted: steps.slice(index + 1).map((item) => item.name),
          reasonCode: getSettingsSaveReasonCode(error),
        },
      };
    }
    saved.push(step.name);
  }
  return { ok: true, saved };
}

/** Page-level save state for `SettingsSaveBar` and `SettingsStatusLine`. */
export function useSettingsSaveSequence() {
  const [progress, setProgress] = useState<SettingsSaveProgress | null>(null);
  const [failure, setFailure] = useState<SettingsSaveFailure | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(async (steps: readonly SettingsSaveStep[]) => {
    if (runningRef.current) {
      return null;
    }
    runningRef.current = true;
    setFailure(null);
    try {
      const outcome = await runSettingsSaveSequence(steps, setProgress);
      if (!outcome.ok) {
        setFailure(outcome.failure);
      }
      return outcome;
    } finally {
      runningRef.current = false;
      setProgress(null);
    }
  }, []);

  const clearFailure = useCallback(() => setFailure(null), []);

  return { progress, failure, isSaving: progress !== null, run, clearFailure };
}

/** "Brand, Booking page link and Manager alerts" */
export function formatSettingsSectionList(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
