import { Toggle } from 'nabatable-platform';

export const ServiceFilters = () => (
  <div className="flex flex-wrap gap-2 w-80">
    <Toggle defaultPressed>Lunch</Toggle>
    <Toggle defaultPressed>Dinner</Toggle>
    <Toggle>Brunch</Toggle>
    <Toggle>Late</Toggle>
  </div>
);

export const TableStatus = () => (
  <div className="flex flex-col gap-3 w-72">
    <span className="text-sm font-medium">Table 12 availability</span>
    <div className="flex gap-2">
      <Toggle variant="outline" defaultPressed>
        Available
      </Toggle>
      <Toggle variant="outline">Held</Toggle>
      <Toggle variant="outline">Seated</Toggle>
    </div>
  </div>
);

export const Sizes = () => (
  <div className="flex items-center gap-3">
    <Toggle variant="outline" size="sm" defaultPressed>
      2
    </Toggle>
    <Toggle variant="outline" size="default" defaultPressed>
      Party of 4
    </Toggle>
    <Toggle variant="outline" size="lg">
      Party of 6
    </Toggle>
  </div>
);

export const States = () => (
  <div className="flex items-center gap-3">
    <Toggle defaultPressed>Confirmed only</Toggle>
    <Toggle variant="outline">Include walk-ins</Toggle>
    <Toggle variant="outline" disabled>
      No-shows
    </Toggle>
  </div>
);
