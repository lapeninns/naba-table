import { Calendar, Clock, CreditCard, MessageSquare, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ElementType, ReactNode } from 'react';

export interface GuestProfileStatsGridProps {
  formattedStartTime: string;
  durationMinutes: number | null;
  partySize: number;
  occasionLabel: string;
  depositLabel: string | null;
  sourceLabel: string;
}

export function GuestProfileStatsGrid({
  formattedStartTime,
  durationMinutes,
  partySize,
  occasionLabel,
  depositLabel,
  sourceLabel,
}: GuestProfileStatsGridProps) {
  return (
    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-2">
      <StatChip
        icon={Clock}
        label="Time"
        value={
          <span>
            {formattedStartTime}
            {durationMinutes ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {formatDurationMinutes(durationMinutes)}
              </span>
            ) : null}
          </span>
        }
        accent
      />
      <StatChip icon={Users} label="Party" value={`${partySize} guests`} accent />
      <StatChip
        icon={Calendar}
        label="Occasion"
        value={<span className="capitalize">{occasionLabel}</span>}
      />
      <StatChip
        icon={CreditCard}
        label="Deposit"
        value={
          depositLabel ?? <span className="text-xs font-normal text-muted-foreground">None</span>
        }
      />
      <StatChip
        icon={MessageSquare}
        label="Source"
        value={<span className="capitalize">{sourceLabel}</span>}
      />
    </section>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: ElementType;
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-2xl border p-4 transition-colors',
        accent
          ? 'border-primary/20 bg-primary/5 hover:bg-primary/10'
          : 'border-border/40 bg-background/40 backdrop-blur-md hover:bg-background/60',
      )}
    >
      <div className="mb-0.5 flex items-center gap-1.5 text-muted-foreground">
        <Icon className={cn('size-3.5', accent ? 'text-primary' : 'text-muted-foreground')} />
        <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
      </div>
      <div className="text-sm leading-snug font-bold text-foreground">{value}</div>
    </div>
  );
}

function formatDurationMinutes(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  if (hours > 0) return `${hours}h ${durationMinutes % 60}m`;
  return `${durationMinutes}m`;
}
