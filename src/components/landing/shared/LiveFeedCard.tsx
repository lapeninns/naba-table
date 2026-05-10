'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ServiceTimelineItem {
  time: string;
  party: string;
  status: string;
  detail?: string;
}

const SERVICE_TIMELINE: ServiceTimelineItem[] = [
  { time: '18:30', party: '4 guests', status: 'Confirmed', detail: 'Window table' },
  {
    time: '19:00',
    party: '2 guests',
    status: 'Reminder sent',
    detail: 'SMS + email',
  },
  { time: '19:30', party: '6 guests', status: 'Table joined', detail: 'Turn protected' },
  { time: '20:15', party: '3 guests', status: 'Waitlist ready', detail: 'If gap opens' },
];

const FLOOR_ZONES = [
  { name: 'Bar', tables: ['T1', 'T2', 'T3'], load: 'steady' },
  { name: 'Dining', tables: ['T4', 'T5', 'T6', 'T7'], load: 'busy' },
  { name: 'Snug', tables: ['T8', 'T9'], load: 'clear' },
] as const;

interface LiveFeedCardProps {
  reduceMotion: boolean;
}

export function LiveFeedCard({ reduceMotion }: LiveFeedCardProps) {
  return (
    <Card
      variant="compact"
      className="pg-panel flex h-full flex-col overflow-hidden border-primary/15 bg-background/96 shadow-[var(--pg-shadow-md)] transition-all duration-200"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-border/70 bg-muted/35 p-4 sm:p-5 md:p-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative flex size-2 shrink-0">
            {reduceMotion ? null : (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40 opacity-75" />
            )}
            <span className="relative inline-flex size-2 animate-pulse rounded-full bg-primary" />
          </div>
          <span className="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tonight&apos;s service board
          </span>
        </div>
        <Badge variant="guest-chip" className="shrink-0">
          Live
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-4 sm:p-5 md:p-6">
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-[var(--pg-radius-lg)] border border-border/80 bg-muted/30 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-[var(--pg-font-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Floor load
              </p>
              <span className="rounded-full bg-primary/10 px-2 py-1 font-[var(--pg-font-mono)] text-[10px] uppercase tracking-[0.16em] text-primary">
                Balanced
              </span>
            </div>
            <div className="grid gap-2">
              {FLOOR_ZONES.map((zone) => (
                <div key={zone.name} className="rounded-[var(--pg-radius-md)] bg-background/82 p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{zone.name}</span>
                    <span className="font-[var(--pg-font-mono)] text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {zone.load}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {zone.tables.map((table, tableIndex) => (
                      <span
                        key={table}
                        className={cn(
                          'flex h-8 items-center justify-center rounded-[var(--pg-radius-xs)] border text-[11px] font-semibold',
                          tableIndex === 0
                            ? 'border-primary/30 bg-primary/[0.08] text-primary'
                            : 'border-border/70 bg-background text-muted-foreground',
                        )}
                      >
                        {table}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {SERVICE_TIMELINE.map((item) => (
              <div
                key={`${item.time}-${item.party}`}
                className="flex flex-col gap-2 rounded-[var(--pg-radius-md)] border border-border/80 bg-background p-3 font-mono text-xs shadow-[var(--pg-shadow-xs)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-foreground">
                    {item.time} - {item.party}
                  </div>
                  <div className="mt-0.5 text-muted-foreground">{item.detail}</div>
                </div>
                <div className="shrink-0 font-medium text-primary sm:max-w-[9rem]">
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-[var(--pg-radius-lg)] border border-primary/20 bg-primary/[0.07] p-3 font-mono text-xs text-foreground/80 sm:grid-cols-3">
          <span>
            Covers: <strong className="text-foreground">42</strong>
          </span>
          <span>
            Risk prompts: <strong className="text-foreground">8 sent</strong>
          </span>
          <span>
            Kitchen load: <strong className="text-foreground">steady</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
