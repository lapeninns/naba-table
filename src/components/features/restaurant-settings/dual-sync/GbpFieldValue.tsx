import { formatDualSyncFieldPreview } from './dualSyncFieldValuePreviewDomain';

function sourceValue(value: object): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Source details unavailable';
  }
}

export function GbpFieldValue({ value }: { readonly value: unknown }) {
  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <span>{formatDualSyncFieldPreview(value)}</span>
      {value !== null && typeof value === 'object' ? (
        <details className="mt-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
