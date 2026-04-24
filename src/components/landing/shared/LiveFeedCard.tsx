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
  { time: '18:30', party: '4 guests', status: 'Arrived & Seated' },
  {
    time: '19:00',
    party: '2 guests',
    status: 'Automated Reminder Sent',
    detail: '0 manual effort',
  },
  { time: '19:30', party: '6 guests', status: 'Optimised Table Assigned' },
];

interface LiveFeedCardProps {
  reduceMotion: boolean;
}

export function LiveFeedCard({ reduceMotion }: LiveFeedCardProps) {
  return (
    <Card
      variant="compact"
      className="pg-panel flex h-full flex-col overflow-hidden border-primary/15 bg-background/96 shadow-[var(--pg-shadow-soft)] transition-all duration-200"
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
            Service Live - Zero Chaos Detected
          </span>
        </div>
        <Badge variant="guest-chip" className="shrink-0">
          Live
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2.5 p-4 sm:gap-3 sm:p-5 md:p-6">
        {SERVICE_TIMELINE.map((item, index) => (
          <div
            key={`${item.time}-${item.party}`}
            className="flex flex-col gap-2 rounded-[var(--pg-radius-md)] border border-border/80 bg-background p-3 font-mono text-xs shadow-[var(--pg-shadow-xs)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-foreground">
                {item.time} - {item.party}
              </div>
              <div className="mt-0.5 text-muted-foreground">
                {index === 1 ? 'Reminder sequence handled automatically' : 'Floor plan synced'}
              </div>
            </div>
            <div
              className={cn(
                'shrink-0 font-medium text-primary',
                item.detail ? 'sm:max-w-[11rem]' : '',
              )}
            >
              {item.status}
              {item.detail ? (
                <span className="block text-[11px] text-muted-foreground">({item.detail})</span>
              ) : null}
            </div>
          </div>
        ))}
        <div className="mt-1 grid grid-cols-1 gap-2 rounded-[var(--pg-radius-lg)] border border-primary/20 bg-primary/[0.07] p-3 font-mono text-xs text-foreground/80 sm:grid-cols-3">
          <span>
            Total Covers: <strong className="text-foreground">42</strong>
          </span>
          <span>
            No-Show Loss: <strong className="text-foreground">£0</strong>
          </span>
          <span>
            Shift Ends: <strong className="text-foreground">22:00</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
