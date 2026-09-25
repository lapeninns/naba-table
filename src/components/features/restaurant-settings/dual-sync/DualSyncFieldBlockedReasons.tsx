import { Info } from 'lucide-react';

export function DualSyncFieldBlockedReasons({
  id,
  reasons,
}: {
  readonly id?: string;
  readonly reasons: readonly string[];
}) {
  if (reasons.length === 0) {
    return null;
  }

  return (
    <ul id={id} className="flex flex-col gap-0.5 text-xs leading-5 text-muted-foreground">
      {reasons.map((reason) => (
        <li key={reason} className="flex items-start gap-1.5">
          <Info className="mt-1 size-3 shrink-0" aria-hidden />
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  );
}
