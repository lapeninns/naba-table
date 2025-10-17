const DEFAULT_TIMEZONE = "Europe/London";

type EnsureTimezoneOptions = {
  fallback?: string;
  rejectInvalid?: boolean;
};

const supportedTimezones = typeof Intl.supportedValuesOf === "function"
  ? (() => {
      const values = Intl.supportedValuesOf("timeZone");
      const map = new Map<string, string>();
      for (const value of values) {
        map.set(value.toLowerCase(), value);
      }
      return map;
    })()
  : null;

function canonicalizeTimezone(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (supportedTimezones) {
    const match = supportedTimezones.get(trimmed.toLowerCase());
    if (match) {
      return match;
    }
  }

  try {
    // Intl.DateTimeFormat throws for unknown timezones; using it keeps behaviour consistent across runtimes.
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).formatToParts();
    return trimmed;
  } catch {
    return null;
  }
}

export function ensureValidTimezone(
  value: string | null | undefined,
  options: EnsureTimezoneOptions = {},
): string {
  const fallback = options.fallback ?? DEFAULT_TIMEZONE;
  const canonical = canonicalizeTimezone(value);

  if (canonical) {
    return canonical;
  }

  if (options.rejectInvalid) {
    const provided = value?.trim() ?? "";
    if (!provided) {
      throw new Error("Timezone is required");
    }
    throw new Error(`Invalid timezone "${provided}". Provide a valid IANA timezone identifier.`);
  }

  return fallback;
}

export function assertValidTimezone(
  value: string | null | undefined,
  fallback?: string,
): string {
  return ensureValidTimezone(value, { rejectInvalid: true, fallback });
}

export function getDefaultTimezone(): string {
  return DEFAULT_TIMEZONE;
}
