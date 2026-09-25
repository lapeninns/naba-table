import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export type GbpDetailListItem = {
  readonly label: string;
  readonly value: ReactNode;
  /** Machine values (codes, masks, ids) use the mono face. */
  readonly mono?: boolean;
};

/** Compact label/value list used across the Google Business Profile steps and evidence. */
export function GbpDetailList({
  items,
  className,
}: {
  readonly items: ReadonlyArray<GbpDetailListItem>;
  readonly className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              'min-w-0 break-words pb-1 text-foreground sm:pb-0',
              item.mono && 'font-mono text-xs leading-5',
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
