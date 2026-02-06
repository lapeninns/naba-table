'use client';

import { Calendar, Clock, Users } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

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
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          <div className="truncate text-sm font-semibold text-foreground" title={value}>
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
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
    <div className="grid grid-cols-2 gap-3">
      <MetaCard icon={Users} title="Covers" value={`${partySize}`} />
      <MetaCard
        icon={Clock}
        title="Time"
        value={`${formattedStartTime}${durationMinutes ? ` · ${durationMinutes}m` : ''}`}
      />
      <MetaCard icon={Calendar} title="Source" value={sourceLabel} />
      <MetaCard icon={Calendar} title="Occasion" value={occasionLabel} />
    </div>
  );
}

export default GuestMetaGrid;

