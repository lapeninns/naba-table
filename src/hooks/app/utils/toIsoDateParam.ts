const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function toIsoDateParam(input?: Date | string | null): string | null {
  if (!input) {
    return null;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (DATE_ONLY_REGEX.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  if (Number.isNaN(input.getTime())) {
    return null;
  }

  return input.toISOString().slice(0, 10);
}
