import { formatDualSyncFieldPreview } from './dualSyncFieldValuePreviewDomain';

function sourceValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? 'Source details unavailable';
  } catch {
    return 'Source details unavailable';
  }
}

export function GbpFieldValue({
  value,
  context,
}: {
  readonly value: unknown;
  readonly context: string;
}) {
  const structured = value !== null && typeof value === 'object';
  const significantWhitespace =
    typeof value === 'string' && (value.trim() !== value || /\s{2}|\n/.test(value));
  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <span className="whitespace-pre-wrap">
        {value === '' ? 'Empty text' : formatDualSyncFieldPreview(value)}
      </span>
      {structured || significantWhitespace ? (
        <details className="mt-1 text-xs text-muted-foreground">
          <summary
            aria-label={`View source details: ${context}`}
            className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View source details
          </summary>
          <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 [overflow-wrap:anywhere]">
            {sourceValue(value)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
