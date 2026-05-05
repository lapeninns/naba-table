'use client';

import { Calendar, Clock, Users } from 'lucide-react';

export type GuestMetaGridProps = {
  partySize: number;
  formattedStartTime: string;
  durationMinutes: number | null;
  sourceLabel: string;
  occasionLabel: string;
};

function MetaCard({
  icon,
  title,
  value,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  value: string;
}) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background p-2.5 shadow-sm ring-1 ring-border/5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted/60 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
          {title}
        </div>
        <div className="truncate text-xs font-bold text-foreground" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

export function GuestMetaGrid({
  partySize,
  formattedStartTime,
  durationMinutes,
  sourceLabel,
  occasionLabel,
}: GuestMetaGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <MetaCard icon={Users} title="Covers" value={`${partySize}`} />
      <MetaCard
        icon={Clock}
        title="Time"
        value={`${formattedStartTime}${durationMinutes ? ` · ${durationMinutes}m` : ''}`}
      />
      <MetaCard icon={Calendar} title="Source" value={sourceLabel} />
      <MetaCard icon={Calendar} title="Event" value={occasionLabel} />
    </div>
  );
}

export default GuestMetaGrid;
