const SCHEMA_ERROR_PATTERNS = [
  /column.+assignment_state/i,
  /column.+assignment_state_version/i,
  /column.+assignment_strategy/i,
  /booking_assignment_state_history/i,
  /booking_assignment_attempts/i,
  /Transition created -> assignment_in_progress not permitted/i,
];

let runtimeDisabledReason: string | null = null;

function extractErrorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) {
    return error.message ?? error.toString();
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object" && "message" in (error as Record<string, unknown>)) {
    const candidate = (error as Record<string, unknown>).message;
    if (typeof candidate === "string") {
      return candidate;
    }
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isAssignmentPipelineSchemaError(error: unknown): boolean {
  const message = extractErrorMessage(error);
  if (!message) {
    return false;
  }
  return SCHEMA_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function disableAssignmentPipelineRuntime(reason: string, error?: unknown): void {
  if (runtimeDisabledReason) {
    return;
  }
  runtimeDisabledReason = reason;
  const message = extractErrorMessage(error);
  console.warn("[assignment-pipeline] runtime disabled", {
    reason,
    error: message || undefined,
  });
}

export function isAssignmentPipelineRuntimeDisabled(): boolean {
  return runtimeDisabledReason !== null;
}

export function getAssignmentPipelineRuntimeDisabledReason(): string | null {
  return runtimeDisabledReason;
}
