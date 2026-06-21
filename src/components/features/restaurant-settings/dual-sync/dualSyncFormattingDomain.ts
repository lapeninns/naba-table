export interface FormatDualSyncTimestampOptions {
  readonly emptyFallback: string;
}

export function formatDualSyncTimestamp(
  value: string | null | undefined,
  { emptyFallback }: FormatDualSyncTimestampOptions,
): string {
  if (!value) return emptyFallback;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  } catch {
    return value;
  }
}
