import { AlertCircle, CheckCircle2, Timer, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

const SUMMARY_CARDS = [
  {
    icon: Users,
    label: 'Current Occupancy',
    value: '—',
    tone: 'bg-primary/10 text-primary',
  },
  {
    icon: Timer,
    label: 'Avg. Turn Time',
    value: '—',
    tone: 'bg-muted text-muted-foreground',
  },
  {
    icon: CheckCircle2,
    label: 'Upcoming Arrivals',
    value: '—',
    tone: 'bg-accent text-accent-foreground',
  },
  {
    icon: AlertCircle,
    label: 'Table Conflicts',
    value: '—',
    tone: 'bg-destructive/10 text-destructive',
  },
];

export function TableTimelineSummaryCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SUMMARY_CARDS.map((card) => (
        <TimelineSummaryCard
          key={card.label}
          icon={card.icon}
          label={card.label}
          value={card.value}
          tone={card.tone}
        />
      ))}
    </div>
  );
}

function TimelineSummaryCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  readonly icon: typeof Users;
  readonly label: string;
  readonly tone: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={cn('rounded-lg p-2', tone)}>
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}
