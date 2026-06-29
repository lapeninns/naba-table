import { CategoryTab } from 'nabatable-platform';
import { CalendarDays, Users, Clock, Armchair, ListChecks } from 'lucide-react';

export const ServiceTabs = () => (
  <div className="flex items-stretch gap-1 w-96 rounded-lg border border-border/60 bg-card p-1">
    <CategoryTab icon={<CalendarDays />} label="Today" active />
    <CategoryTab icon={<Clock />} label="Upcoming" />
    <CategoryTab icon={<Armchair />} label="Tables" />
    <CategoryTab icon={<ListChecks />} label="Waitlist" />
  </div>
);

export const ActiveVsInactive = () => (
  <div className="flex items-center gap-3">
    <CategoryTab icon={<Users />} label="All covers" active />
    <CategoryTab icon={<Users />} label="Large parties" />
  </div>
);

export const LabelOnly = () => (
  <div className="flex items-stretch gap-1 w-80 rounded-lg border border-border/60 bg-card p-1">
    <CategoryTab label="Lunch" />
    <CategoryTab label="Dinner" active />
    <CategoryTab label="Late" />
  </div>
);
