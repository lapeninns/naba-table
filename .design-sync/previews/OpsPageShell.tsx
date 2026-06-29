import {
  OpsPageShell,
  OpsPageHeader,
  OpsStatusBadge,
  Button,
  Card,
} from 'nabatable-platform';
import { Plus, Users } from 'lucide-react';

const bookings = [
  { table: 'T12', guest: 'Priya Nair', party: 4, time: '8:00 PM', tone: 'success', label: 'Seated' },
  { table: 'T4', guest: 'Tom Hill', party: 2, time: '7:30 PM', tone: 'info', label: 'Confirmed' },
  { table: 'T7', guest: 'Walk-in', party: 3, time: '7:45 PM', tone: 'warning', label: 'Overdue' },
  { table: 'T1', guest: 'Aisha Khan', party: 6, time: '6:00 PM', tone: 'danger', label: 'No-show' },
] as const;

export const BookingsPage = () => (
  <div data-theme="app" className="w-[56rem] bg-background">
    <OpsPageShell className="!py-6">
      <div className="space-y-5">
        <OpsPageHeader
          eyebrow="The Crown & Anchor"
          title="Bookings"
          subtitle="Saturday dinner service · 84 covers across 21 reservations"
          primaryAction={
            <Button size="sm">
              <Plus /> New booking
            </Button>
          }
          secondaryActions={
            <Button size="sm" variant="outline">
              Export
            </Button>
          }
        />
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Covers</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">84</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Seated</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">52</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">No-shows</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">3</p>
          </Card>
        </div>
        <Card className="divide-y divide-border/60">
          {bookings.map((b) => (
            <div key={b.table} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">{b.table}</span>
                <span className="text-muted-foreground">
                  {b.guest} · {b.party} covers · {b.time}
                </span>
              </div>
              <OpsStatusBadge tone={b.tone} label={b.label} />
            </div>
          ))}
        </Card>
      </div>
    </OpsPageShell>
  </div>
);

export const HeaderAndMetrics = () => (
  <div data-theme="app" className="w-[48rem] bg-background">
    <OpsPageShell className="!py-6">
      <div className="space-y-5">
        <OpsPageHeader
          eyebrow="Tonight"
          title="Floor overview"
          subtitle="Pacing looks healthy — 4 tables turning in the next 30 minutes."
          primaryAction={
            <Button size="sm">
              <Users /> Seat next party
            </Button>
          }
        />
        <div className="grid grid-cols-4 gap-3">
          {[
            ['Available', '6'],
            ['Seated', '14'],
            ['Held', '2'],
            ['Avg turn', '96m'],
          ].map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            </Card>
          ))}
        </div>
      </div>
    </OpsPageShell>
  </div>
);
