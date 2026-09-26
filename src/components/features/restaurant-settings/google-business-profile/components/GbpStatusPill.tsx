import { cn } from '@/lib/utils';

import type { GbpTone } from '../gbpPageModel';

/** "Connection  Linked": a status pill whose dot and fill follow the ops semantic tones. */
export function GbpStatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: GbpTone;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[30px] items-center gap-2 rounded-full border px-3 text-sm',
        tone === 'bad' && 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          tone === 'ok' && 'bg-success',
          tone === 'off' && 'ring-[1.5px] ring-inset ring-muted-foreground',
          tone === 'bad' && 'bg-destructive',
        )}
      />
      {label} <b className="font-semibold">{value}</b>
    </span>
  );
}
