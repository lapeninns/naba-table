import { UtensilsCrossed } from 'lucide-react';

import { ScheduleMealWindowEditor } from './ScheduleMealWindowEditor';

import type { ScheduleDayMealEditorState } from './scheduleDayCardDomain';

type MealKey = 'lunch' | 'dinner';

type ScheduleDayServiceWindowsSectionProps = {
  dayOfWeek: number;
  dinnerEditor: ScheduleDayMealEditorState;
  lunchEditor: ScheduleDayMealEditorState;
  onMealTimeChange: (
    dayIndex: number,
    mealKey: MealKey,
    field: 'startTime' | 'endTime',
    value: string,
  ) => void;
  onMealToggle: (dayIndex: number, mealKey: MealKey, value: boolean) => void;
};

export function ScheduleDayServiceWindowsSection({
  dayOfWeek,
  dinnerEditor,
  lunchEditor,
  onMealTimeChange,
  onMealToggle,
}: ScheduleDayServiceWindowsSectionProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-primary/5">
      <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-foreground">
        <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/10">
          <UtensilsCrossed className="size-3.5 text-emerald-500" />
        </div>
        Service windows (Lunch / Dinner Sessions)
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ScheduleMealWindowEditor
          idPrefix={`day-${dayOfWeek}-lunch`}
          label="Lunch"
          meal={lunchEditor.meal}
          disabled={lunchEditor.disabled}
          errors={lunchEditor.errors}
          onToggle={(value) => onMealToggle(dayOfWeek, 'lunch', value)}
          onChange={(field, value) => onMealTimeChange(dayOfWeek, 'lunch', field, value)}
        />
        <ScheduleMealWindowEditor
          idPrefix={`day-${dayOfWeek}-dinner`}
          label="Dinner"
          meal={dinnerEditor.meal}
          disabled={dinnerEditor.disabled}
          errors={dinnerEditor.errors}
          onToggle={(value) => onMealToggle(dayOfWeek, 'dinner', value)}
          onChange={(field, value) => onMealTimeChange(dayOfWeek, 'dinner', field, value)}
        />
      </div>
    </div>
  );
}
