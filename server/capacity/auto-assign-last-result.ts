import { DateTime } from "luxon";

import { classifyPlannerReason, isDeterministicPlannerFailure } from "./planner-reason";

import type { PlannerStrategyContext } from "./planner-telemetry";
import type { Json } from "@/types/supabase";

export type AutoAssignResultSource = "inline" | "job";

export type AutoAssignLastResult = {
  source: AutoAssignResultSource;
  lastAttemptAt: string;
  success: boolean;
  reason: string | null;
  strategy: PlannerStrategyContext;
  trigger: string;
  alternates?: number;
  durationMs?: number;
  attemptId?: string | null;
  emailSent?: boolean;
  emailVariant?: "standard" | "modified" | null;
};

export const INLINE_RESULT_RECENCY_MS = 5 * 60 * 1000;
export function buildInlineLastResult(params: {
  durationMs: number;
  success: boolean;
  reason: string | null;
  strategy: PlannerStrategyContext;
  trigger: string;
  alternates?: number;
  attemptId: string;
  emailSent: boolean;
  emailVariant: "standard" | "modified" | null;
}): AutoAssignLastResult {
  return {
    source: "inline",
    lastAttemptAt: new Date().toISOString(),
    success: params.success,
    reason: params.reason,
    strategy: params.strategy,
    trigger: params.trigger,
    alternates: params.alternates,
    durationMs: params.durationMs,
    attemptId: params.attemptId,
    emailSent: params.emailSent,
    emailVariant: params.emailVariant,
  };
}

export function parseAutoAssignLastResult(payload: Json | null): AutoAssignLastResult | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.source !== "string") return null;
  if (typeof candidate.lastAttemptAt !== "string") return null;
  if (typeof candidate.success !== "boolean") return null;
  if (typeof candidate.reason !== "string" && candidate.reason !== null) return null;
  if (typeof candidate.trigger !== "string") return null;
  const strategy = candidate.strategy as PlannerStrategyContext | undefined;
  if (!strategy || typeof strategy !== "object") {
    return null;
  }
  return {
    source: candidate.source as AutoAssignResultSource,
    lastAttemptAt: candidate.lastAttemptAt,
    success: candidate.success,
    reason: candidate.reason as string | null,
    strategy,
    trigger: candidate.trigger,
    alternates: typeof candidate.alternates === "number" ? candidate.alternates : undefined,
    durationMs: typeof candidate.durationMs === "number" ? candidate.durationMs : undefined,
    attemptId: typeof candidate.attemptId === "string" ? candidate.attemptId : undefined,
    emailSent: typeof candidate.emailSent === "boolean" ? candidate.emailSent : undefined,
    emailVariant:
      candidate.emailVariant === "standard" || candidate.emailVariant === "modified"
        ? (candidate.emailVariant as "standard" | "modified")
        : null,
  };
}

export function isInlineResultRecent(result: AutoAssignLastResult | null): boolean {
  if (!result || result.source !== "inline") return false;
  const timestamp = DateTime.fromISO(result.lastAttemptAt, { setZone: true });
  if (!timestamp.isValid) return false;
  return DateTime.now().toMillis() - timestamp.toMillis() <= INLINE_RESULT_RECENCY_MS;
}

export function isInlineHardFailure(result: AutoAssignLastResult | null): boolean {
  if (!result || result.source !== "inline" || result.success) return false;
  return isDeterministicPlannerFailure(result.reason);
}

export function shouldSkipEmailForJob(result: AutoAssignLastResult | null): boolean {
  return Boolean(result && result.source === "inline" && result.success && result.emailSent);
}

export function shouldSkipFirstJobAttempt(result: AutoAssignLastResult | null): {
  skip: boolean;
  reasonCode: string | null;
} {
  if (!isInlineResultRecent(result) || !result || result.success) {
    return { skip: false, reasonCode: null };
  }
  const classification = classifyPlannerReason(result.reason ?? null);
  if (classification.category !== "hard") {
    return { skip: false, reasonCode: null };
  }
  return { skip: true, reasonCode: classification.code };
}
