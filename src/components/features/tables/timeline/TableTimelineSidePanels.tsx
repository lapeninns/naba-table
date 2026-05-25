import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const CAPACITY_BREAKDOWN = [
  { label: '2-Tops', current: 0, total: 0 },
  { label: '4-Tops', current: 0, total: 0 },
  { label: '6+ Tops', current: 0, total: 0 },
];

export function TableTimelineSidePanels() {
  return (
    <div className="flex w-full shrink-0 flex-col gap-4 lg:w-96">
      <ActionRequiredPanel />
      <CapacityBreakdownPanel />
    </div>
  );
}

function ActionRequiredPanel() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Action Required</h3>
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            — Alerts
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Alerts will appear here once live data is loaded.
        </p>
        <Button className="mt-4 w-full" variant="secondary" disabled>
          View All Notifications
        </Button>
      </CardContent>
    </Card>
  );
}

function CapacityBreakdownPanel() {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold">Capacity Breakdown</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Breakdown will be computed from table inventory and bookings.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {CAPACITY_BREAKDOWN.map((item) => {
            const progress = item.total ? (item.current / item.total) * 100 : 0;

            return (
              <div key={item.label} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold text-foreground">
                    {item.total ? `${item.current}/${item.total}` : '—'}
                  </span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
